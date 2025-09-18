import JSZip from 'jszip'
import axios from 'axios'
import { FileSizeAnalyzer, FileSizeAnalysis } from './file-size-analyzer'
import * as cheerio from 'cheerio'

export interface StaticAnalysisResult {
  hasReadme: boolean
  hasContributing: boolean
  hasAgents: boolean
  hasLicense: boolean
  hasWorkflows: boolean
  hasTests: boolean
  languages: string[]
  errorHandling: boolean
  fileCount: number
  linesOfCode: number
  repositorySizeMB: number
  readmeContent?: string
  contributingContent?: string
  agentsContent?: string
  workflowFiles: string[]
  testFiles: string[]
  fileSizeAnalysis?: FileSizeAnalysis
  // Website-specific fields
  websiteUrl?: string
  pageTitle?: string
  metaDescription?: string
  hasStructuredData?: boolean
  hasOpenGraph?: boolean
  hasTwitterCards?: boolean
  hasSitemap?: boolean
  hasRobotsTxt?: boolean
  hasFavicon?: boolean
  hasManifest?: boolean
  hasServiceWorker?: boolean
  pageLoadSpeed?: number
  mobileFriendly?: boolean
  accessibilityScore?: number
  seoScore?: number
  contentLength?: number
  imageCount?: number
  linkCount?: number
  headingStructure?: {
    [key: string]: number
  }
  technologies?: string[]
  securityHeaders?: string[]
  socialMediaLinks?: string[]
  contactInfo?: string[]
  navigationStructure?: string[]
}

export interface WebsiteAnalysisResult {
  // Basic website info
  websiteUrl: string
  pageTitle: string
  metaDescription: string
  
  // AI Agent Readiness - Core Metrics
  hasStructuredData: boolean
  hasOpenGraph: boolean
  hasTwitterCards: boolean
  hasSitemap: boolean
  hasRobotsTxt: boolean
  hasFavicon: boolean
  hasManifest: boolean
  hasServiceWorker: boolean
  
  // Performance & Accessibility
  pageLoadSpeed: number
  mobileFriendly: boolean
  accessibilityScore: number
  seoScore: number
  
  // Content Analysis
  contentLength: number
  imageCount: number
  linkCount: number
  headingStructure: {
    [key: string]: number
  }
  
  // Technology & Integration
  technologies: string[]
  securityHeaders: string[]
  socialMediaLinks: string[]
  contactInfo: string[]
  navigationStructure: string[]
  
  // Website Type Detection
  websiteType: 'restaurant' | 'documentation' | 'ecommerce' | 'business' | 'blog' | 'portfolio' | 'unknown'
  
  // Type-specific metrics
  restaurantMetrics?: {
    hasHours: boolean
    hasMenu: boolean
    hasReservations: boolean
    hasOrdering: boolean
    hasIngredients: boolean
    hasCalories: boolean
    hasLocation: boolean
    hasPhone: boolean
    hasDelivery: boolean
    hasReviews: boolean
  }
  
  documentationMetrics?: {
    hasApiDocs: boolean
    hasExamples: boolean
    hasTutorials: boolean
    hasChangelog: boolean
    hasVersioning: boolean
    hasCodeSamples: boolean
    hasInstallationGuide: boolean
    hasQuickStart: boolean
    hasReference: boolean
    hasCommunity: boolean
  }
  
  ecommerceMetrics?: {
    hasProductCatalog: boolean
    hasSearch: boolean
    hasFilters: boolean
    hasReviews: boolean
    hasWishlist: boolean
    hasCart: boolean
    hasCheckout: boolean
    hasPayment: boolean
    hasShipping: boolean
    hasReturns: boolean
  }
}

export async function analyzeRepository(repoUrl: string): Promise<StaticAnalysisResult> {
  try {
    // Extract owner and repo from URL
    const urlParts = repoUrl.replace('https://github.com/', '').split('/')
    const owner = urlParts[0]
    const repo = urlParts[1]

    if (!owner || !repo) {
      throw new Error('Invalid GitHub repository URL format')
    }

    // Try to download repository as ZIP - first try main branch, then master
    let response
    let branch = 'main'
    
    try {
      const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`
      response = await axios.get(zipUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      })
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Try master branch if main doesn't exist
        try {
          const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`
          response = await axios.get(zipUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })
          branch = 'master'
        } catch (masterError: any) {
          throw new Error(`Repository not found. Tried both 'main' and 'master' branches. Error: ${masterError.response?.status || 'Unknown error'}`)
        }
      } else {
        throw new Error(`Failed to download repository: ${error.message}`)
      }
    }

    // Extract ZIP contents
    const zip = await JSZip.loadAsync(response.data)
    const files = Object.keys(zip.files)

    // Analyze files
    const analysis: StaticAnalysisResult = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: [],
      errorHandling: false,
      fileCount: files.length,
      linesOfCode: 0,
      repositorySizeMB: 0,
      workflowFiles: [],
      testFiles: [],
    }

    // Check for documentation files
    for (const file of files) {
      const fileName = file.toLowerCase()
      
      if (fileName.includes('readme.md')) {
        analysis.hasReadme = true
        try {
          const content = await zip.files[file].async('text')
          analysis.readmeContent = content
        } catch (e) {
          console.warn('Could not read README content:', e)
        }
      }
      
      if (fileName.includes('contributing.md')) {
        analysis.hasContributing = true
        try {
          const content = await zip.files[file].async('text')
          analysis.contributingContent = content
        } catch (e) {
          console.warn('Could not read CONTRIBUTING content:', e)
        }
      }
      
      if (fileName.includes('agents.md')) {
        analysis.hasAgents = true
        try {
          const content = await zip.files[file].async('text')
          analysis.agentsContent = content
        } catch (e) {
          console.warn('Could not read AGENTS content:', e)
        }
      }
      
      if (fileName.includes('license')) {
        analysis.hasLicense = true
      }
    }

    // Check for GitHub Actions workflows
    const workflowFiles = files.filter(file => 
      file.includes('.github/workflows/') && file.endsWith('.yml')
    )
    analysis.hasWorkflows = workflowFiles.length > 0
    analysis.workflowFiles = workflowFiles

    // Detect test files, languages, and count lines of code
    const languageMap = new Map<string, number>()
    let totalLines = 0
    
    for (const file of files) {
      const fileName = file.toLowerCase()
      
      // Test file detection - look for test files, not directories with 'test' in name
      if (fileName.includes('test.') || fileName.includes('spec.') || fileName.includes('__tests__/') || 
          fileName.endsWith('.test.') || fileName.endsWith('.spec.') || fileName.includes('/test/')) {
        analysis.hasTests = true
        analysis.testFiles.push(file)
      }
      
      // Language detection based on file extensions
      const extension = file.split('.').pop()?.toLowerCase()
      if (extension) {
        const language = getLanguageFromExtension(extension)
        if (language) {
          languageMap.set(language, (languageMap.get(language) || 0) + 1)
        }
      }
      
      // Count lines of code for text files
      if (isTextFile(extension)) {
        try {
          const content = await zip.files[file].async('text')
          const lines = content.split('\n').length
          totalLines += lines
        } catch (e) {
          // Skip files that can't be read as text
        }
      }
    }
    
    analysis.linesOfCode = totalLines

    // Sort languages by file count
    analysis.languages = Array.from(languageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang)

    // Check for error handling patterns
    analysis.errorHandling = await checkErrorHandling(zip, files)

    // Calculate repository size
    try {
      analysis.repositorySizeMB = await calculateRepositorySize(zip, files)
    } catch (error) {
      console.warn('Repository size calculation failed:', error)
      // Continue with 0 size if calculation fails
    }

    // Perform file size analysis
    try {
      const fileData = await extractFileData(zip, files)
      analysis.fileSizeAnalysis = await FileSizeAnalyzer.analyzeFileSizes(fileData)
    } catch (error) {
      console.warn('File size analysis failed:', error)
      // Continue without file size analysis if it fails
    }

    return analysis
  } catch (error) {
    console.error('Repository analysis error:', error)
    // Re-throw the original error to preserve error messages
    throw error
  }
}

function getLanguageFromExtension(ext: string): string | null {
  const languageMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React',
    'tsx': 'React TypeScript',
    'py': 'Python',
    'java': 'Java',
    'go': 'Go',
    'rs': 'Rust',
    'cpp': 'C++',
    'c': 'C',
    'cs': 'C#',
    'php': 'PHP',
    'rb': 'Ruby',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'scala': 'Scala',
    'r': 'R',
    'm': 'Objective-C',
    'sh': 'Shell',
    'sql': 'SQL',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'Less',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'md': 'Markdown',
    'txt': 'Text',
  }
  
  return languageMap[ext] || null
}

async function checkErrorHandling(zip: JSZip, files: string[]): Promise<boolean> {
  const errorHandlingPatterns = [
    'try {',
    'catch (',
    'throw new',
    'console.error',
    'console.warn',
    'logger.error',
    'logger.warn',
    'assert(',
    'expect(',
    'raise',
    'except',
    'logging.error',
    'logging.warning',
  ]

  let hasErrorHandling = false
  let filesChecked = 0
  const maxFilesToCheck = 20 // Limit to avoid timeout

  for (const file of files) {
    if (filesChecked >= maxFilesToCheck) break
    
    // Skip non-code files
    const fileName = file.toLowerCase()
    if (fileName.includes('node_modules') || 
        fileName.includes('.git') || 
        fileName.includes('package-lock.json') ||
        fileName.includes('yarn.lock') ||
        fileName.includes('.png') ||
        fileName.includes('.jpg') ||
        fileName.includes('.gif') ||
        fileName.includes('.svg')) {
      continue
    }

    try {
      const content = await zip.files[file].async('text')
      const hasPattern = errorHandlingPatterns.some(pattern => 
        content.includes(pattern)
      )
      
      if (hasPattern) {
        hasErrorHandling = true
        break
      }
      
      filesChecked++
    } catch (e) {
      // Skip files that can't be read as text
      continue
    }
  }

  return hasErrorHandling
}

async function extractFileData(zip: JSZip, files: string[]): Promise<Array<{ path: string; content: string; size: number }>> {
  const fileData: Array<{ path: string; content: string; size: number }> = []
  
  // Limit to first 100 files to avoid memory issues
  const filesToProcess = files.slice(0, 100)
  
  for (const file of filesToProcess) {
    try {
      // Skip directories and very large files (>50MB) to avoid memory issues
      if (file.endsWith('/') || zip.files[file].dir) {
        continue
      }
      
      const zipFile = zip.files[file]
      // Get file size by reading the content and measuring it
      let size = 0
      try {
        const content = await zipFile.async('uint8array')
        size = content.length
      } catch (e) {
        // Skip files that can't be read
        continue
      }
      
      // Skip files larger than 50MB to avoid memory issues
      if (size > 50 * 1024 * 1024) {
        continue
      }
      
      // Try to read as text, skip if it fails (binary files)
      let content = ''
      try {
        content = await zipFile.async('text')
      } catch (e) {
        // Skip binary files
        continue
      }
      
      fileData.push({
        path: file,
        content,
        size
      })
    } catch (error) {
      // Skip files that can't be processed
      continue
    }
  }
  
  return fileData
}

async function calculateRepositorySize(zip: JSZip, files: string[]): Promise<number> {
  let totalSizeBytes = 0
  
  for (const file of files) {
    try {
      // Skip directories
      if (file.endsWith('/') || zip.files[file].dir) {
        continue
      }
      
      const zipFile = zip.files[file]
      // Get file size by reading the content and measuring it
      try {
        const content = await zipFile.async('uint8array')
        totalSizeBytes += content.length
      } catch (e) {
        // Skip files that can't be read
        continue
      }
    } catch (error) {
      // Skip files that can't be processed
      continue
    }
  }
  
  // Convert bytes to MB and round to 2 decimal places
  return Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100
}

function isTextFile(extension: string | undefined): boolean {
  if (!extension) return false
  
  const textExtensions = [
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp',
    'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r',
    'm', 'mm', 'pl', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat',
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'json',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'md', 'txt',
    'rst', 'tex', 'sql', 'dockerfile', 'makefile', 'cmake',
    'gradle', 'maven', 'pom', 'sbt', 'build', 'gulpfile', 'gruntfile'
  ]
  
  return textExtensions.includes(extension.toLowerCase())
}

function detectWebsiteType($: cheerio.CheerioAPI, html: string, url: string): 'restaurant' | 'documentation' | 'ecommerce' | 'business' | 'blog' | 'portfolio' | 'unknown' {
  const text = $('body').text().toLowerCase()
  const title = $('title').text().toLowerCase()
  const domain = new URL(url).hostname.toLowerCase()
  
  // Restaurant detection
  const restaurantKeywords = ['menu', 'restaurant', 'food', 'dining', 'reservation', 'order', 'delivery', 'takeout', 'cuisine', 'chef', 'kitchen']
  const restaurantIndicators = restaurantKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // Documentation detection
  const docKeywords = ['api', 'documentation', 'docs', 'guide', 'tutorial', 'reference', 'changelog', 'version', 'install', 'getting started', 'quick start']
  const docIndicators = docKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // E-commerce detection
  const ecommerceKeywords = ['shop', 'store', 'buy', 'cart', 'checkout', 'product', 'price', 'sale', 'shopping', 'purchase', 'order']
  const ecommerceIndicators = ecommerceKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // Blog detection
  const blogKeywords = ['blog', 'post', 'article', 'news', 'update', 'published', 'author', 'comment']
  const blogIndicators = blogKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // Portfolio detection
  const portfolioKeywords = ['portfolio', 'work', 'projects', 'about', 'contact', 'resume', 'cv', 'skills', 'experience']
  const portfolioIndicators = portfolioKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // Business detection (generic business website)
  const businessKeywords = ['services', 'company', 'about us', 'contact us', 'team', 'mission', 'vision', 'careers', 'jobs']
  const businessIndicators = businessKeywords.some(keyword => 
    text.includes(keyword) || title.includes(keyword) || domain.includes(keyword)
  )
  
  // Priority order: restaurant > documentation > ecommerce > blog > portfolio > business > unknown
  if (restaurantIndicators) return 'restaurant'
  if (docIndicators) return 'documentation'
  if (ecommerceIndicators) return 'ecommerce'
  if (blogIndicators) return 'blog'
  if (portfolioIndicators) return 'portfolio'
  if (businessIndicators) return 'business'
  
  return 'unknown'
}

function analyzeRestaurantMetrics($: cheerio.CheerioAPI, html: string) {
  const text = $('body').text().toLowerCase()
  
  return {
    hasHours: /hours?|open|closed|monday|tuesday|wednesday|thursday|friday|saturday|sunday|am|pm/i.test(text),
    hasMenu: /menu|food|dish|appetizer|entree|dessert|beverage|wine|beer|drink/i.test(text) || $('a[href*="menu"], .menu, #menu').length > 0,
    hasReservations: /reservation|book|table|reserve|opentable|resy/i.test(text) || $('a[href*="reservation"], a[href*="book"], a[href*="opentable"], a[href*="resy"]').length > 0,
    hasOrdering: /order|delivery|takeout|pickup|online ordering|grubhub|doordash|ubereats/i.test(text) || $('a[href*="order"], a[href*="delivery"], a[href*="takeout"]').length > 0,
    hasIngredients: /ingredient|allergen|gluten|dairy|vegan|vegetarian|organic|fresh|local/i.test(text),
    hasCalories: /calorie|nutrition|nutritional|kcal/i.test(text),
    hasLocation: /address|location|map|directions|street|avenue|road/i.test(text) || $('a[href*="maps"], a[href*="google"], .address, .location').length > 0,
    hasPhone: $('a[href^="tel:"]').length > 0 || /phone|call|\(\d{3}\)|\d{3}-\d{3}-\d{4}/i.test(text),
    hasDelivery: /delivery|deliver|delivery area|delivery zone/i.test(text) || $('a[href*="delivery"]').length > 0,
    hasReviews: /review|rating|stars?|yelp|google|tripadvisor|foursquare/i.test(text) || $('a[href*="yelp"], a[href*="google"], a[href*="tripadvisor"]').length > 0
  }
}

function analyzeDocumentationMetrics($: cheerio.CheerioAPI, html: string) {
  const text = $('body').text().toLowerCase()
  
  return {
    hasApiDocs: /api|endpoint|reference|swagger|openapi|graphql|rest/i.test(text) || $('a[href*="api"], a[href*="reference"], a[href*="swagger"]').length > 0,
    hasExamples: /example|sample|demo|tutorial|how to|getting started/i.test(text) || $('a[href*="example"], a[href*="sample"], a[href*="demo"]').length > 0,
    hasTutorials: /tutorial|guide|walkthrough|step by step|learn|training/i.test(text) || $('a[href*="tutorial"], a[href*="guide"]').length > 0,
    hasChangelog: /changelog|changelog|release notes|version history|what's new/i.test(text) || $('a[href*="changelog"], a[href*="release"]').length > 0,
    hasVersioning: /version|v\d+\.\d+|semantic versioning|semver/i.test(text) || $('a[href*="version"], .version').length > 0,
    hasCodeSamples: /code|snippet|example|copy|run|execute|bash|shell|curl|javascript|python|java|php|ruby|go/i.test(text) || $('pre, code, .code, .snippet').length > 0,
    hasInstallationGuide: /install|setup|getting started|quick start|prerequisites|requirements/i.test(text) || $('a[href*="install"], a[href*="setup"]').length > 0,
    hasQuickStart: /quick start|getting started|5 minute|hello world|first steps/i.test(text) || $('a[href*="quick"], a[href*="getting-started"]').length > 0,
    hasReference: /reference|api reference|documentation|docs|manual/i.test(text) || $('a[href*="reference"], a[href*="docs"]').length > 0,
    hasCommunity: /community|forum|discord|slack|github|discussions|chat|support/i.test(text) || $('a[href*="discord"], a[href*="slack"], a[href*="github"]').length > 0
  }
}

function analyzeEcommerceMetrics($: cheerio.CheerioAPI, html: string) {
  const text = $('body').text().toLowerCase()
  
  return {
    hasProductCatalog: /product|catalog|item|shop|store|buy|price|sale/i.test(text) || $('.product, .item, .catalog, [data-product]').length > 0,
    hasSearch: $('input[type="search"], .search, #search, [placeholder*="search"]').length > 0 || /search|find|look for/i.test(text),
    hasFilters: /filter|sort|category|brand|price range|size|color/i.test(text) || $('.filter, .sort, .category, [data-filter]').length > 0,
    hasReviews: /review|rating|stars?|customer review|testimonial/i.test(text) || $('.review, .rating, .stars, [data-review]').length > 0,
    hasWishlist: /wishlist|favorite|save|bookmark/i.test(text) || $('a[href*="wishlist"], .wishlist, .favorite').length > 0,
    hasCart: /cart|shopping cart|basket|checkout/i.test(text) || $('.cart, .basket, a[href*="cart"]').length > 0,
    hasCheckout: /checkout|payment|billing|shipping|order/i.test(text) || $('a[href*="checkout"], .checkout').length > 0,
    hasPayment: /payment|credit card|paypal|stripe|apple pay|google pay/i.test(text) || $('a[href*="payment"], .payment').length > 0,
    hasShipping: /shipping|delivery|shipping info|shipping policy/i.test(text) || $('a[href*="shipping"], .shipping').length > 0,
    hasReturns: /return|refund|exchange|return policy/i.test(text) || $('a[href*="return"], .return').length > 0
  }
}

export async function analyzeWebsiteForAIReadiness(websiteUrl: string): Promise<StaticAnalysisResult> {
  try {
    console.log('🌐 Starting website analysis for:', websiteUrl)
    
    // Fetch the website content
    const response = await axios.get(websiteUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-Analyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    })

    const html = response.data
    const $ = cheerio.load(html)
    const url = new URL(websiteUrl)

    // Initialize analysis result
    const analysis: StaticAnalysisResult = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: [],
      errorHandling: false,
      fileCount: 1, // Single page
      linesOfCode: 0,
      repositorySizeMB: 0,
      workflowFiles: [],
      testFiles: [],
      websiteUrl: websiteUrl,
      pageTitle: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      hasStructuredData: false,
      hasOpenGraph: false,
      hasTwitterCards: false,
      hasSitemap: false,
      hasRobotsTxt: false,
      hasFavicon: false,
      hasManifest: false,
      hasServiceWorker: false,
      pageLoadSpeed: 0,
      mobileFriendly: false,
      accessibilityScore: 0,
      seoScore: 0,
      contentLength: html.length,
      imageCount: 0,
      linkCount: 0,
      headingStructure: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
      technologies: [],
      securityHeaders: [],
      socialMediaLinks: [],
      contactInfo: [],
      navigationStructure: []
    }

    // Analyze page content
    analysis.linesOfCode = html.split('\n').length
    analysis.repositorySizeMB = Math.round((html.length / (1024 * 1024)) * 100) / 100

    // Check for structured data
    analysis.hasStructuredData = $('script[type="application/ld+json"]').length > 0

    // Check for Open Graph meta tags
    analysis.hasOpenGraph = $('meta[property^="og:"]').length > 0

    // Check for Twitter Cards
    analysis.hasTwitterCards = $('meta[name^="twitter:"]').length > 0

    // Check for favicon
    analysis.hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"]').length > 0

    // Check for web app manifest
    analysis.hasManifest = $('link[rel="manifest"]').length > 0

    // Check for service worker
    analysis.hasServiceWorker = $('script').text().includes('serviceWorker') || 
                               $('script').text().includes('navigator.serviceWorker')

    // Count images and links
    analysis.imageCount = $('img').length
    analysis.linkCount = $('a[href]').length

    // Analyze heading structure
    for (let i = 1; i <= 6; i++) {
      analysis.headingStructure![`h${i}`] = $(`h${i}`).length
    }

    // Detect technologies
    const technologies: string[] = []
    
    // Check for common frameworks and libraries
    if ($('script[src*="react"]').length > 0 || html.includes('React')) technologies.push('React')
    if ($('script[src*="vue"]').length > 0 || html.includes('Vue')) technologies.push('Vue')
    if ($('script[src*="angular"]').length > 0 || html.includes('Angular')) technologies.push('Angular')
    if ($('script[src*="jquery"]').length > 0 || html.includes('jQuery')) technologies.push('jQuery')
    if ($('script[src*="bootstrap"]').length > 0 || html.includes('Bootstrap')) technologies.push('Bootstrap')
    if ($('script[src*="tailwind"]').length > 0 || html.includes('tailwind')) technologies.push('Tailwind CSS')
    if (html.includes('WordPress')) technologies.push('WordPress')
    if (html.includes('Drupal')) technologies.push('Drupal')
    if (html.includes('Joomla')) technologies.push('Joomla')
    if (html.includes('Shopify')) technologies.push('Shopify')
    if (html.includes('Wix')) technologies.push('Wix')
    if (html.includes('Squarespace')) technologies.push('Squarespace')
    if (html.includes('Webflow')) technologies.push('Webflow')
    if (html.includes('Next.js')) technologies.push('Next.js')
    if (html.includes('Nuxt')) technologies.push('Nuxt')
    if (html.includes('Gatsby')) technologies.push('Gatsby')
    if (html.includes('Svelte')) technologies.push('Svelte')
    if (html.includes('Alpine')) technologies.push('Alpine.js')
    if (html.includes('Stimulus')) technologies.push('Stimulus')
    if (html.includes('Turbo')) technologies.push('Turbo')
    if (html.includes('Hotwire')) technologies.push('Hotwire')
    
    analysis.technologies = technologies

    // Extract social media links
    const socialLinks: string[] = []
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href') || ''
      if (href.includes('facebook.com')) socialLinks.push('Facebook')
      if (href.includes('twitter.com') || href.includes('x.com')) socialLinks.push('Twitter/X')
      if (href.includes('linkedin.com')) socialLinks.push('LinkedIn')
      if (href.includes('instagram.com')) socialLinks.push('Instagram')
      if (href.includes('youtube.com')) socialLinks.push('YouTube')
      if (href.includes('github.com')) socialLinks.push('GitHub')
      if (href.includes('discord.com')) socialLinks.push('Discord')
      if (href.includes('telegram.org')) socialLinks.push('Telegram')
    })
    analysis.socialMediaLinks = [...new Set(socialLinks)]

    // Extract contact information
    const contactInfo: string[] = []
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g
    
    const textContent = $('body').text()
    const emails = textContent.match(emailRegex) || []
    const phones = textContent.match(phoneRegex) || []
    
    contactInfo.push(...emails.slice(0, 3)) // Limit to 3 emails
    contactInfo.push(...phones.slice(0, 3)) // Limit to 3 phone numbers
    
    analysis.contactInfo = contactInfo

    // Extract navigation structure
    const navItems: string[] = []
    $('nav a, .nav a, .navigation a, .menu a').each((_, element) => {
      const text = $(element).text().trim()
      if (text && text.length > 0 && text.length < 50) {
        navItems.push(text)
      }
    })
    analysis.navigationStructure = navItems.slice(0, 10) // Limit to 10 nav items

    // Check for robots.txt and sitemap
    try {
      const robotsResponse = await axios.get(`${url.origin}/robots.txt`, { timeout: 5000 })
      analysis.hasRobotsTxt = true
      
      // Check if sitemap is mentioned in robots.txt
      if (robotsResponse.data.includes('Sitemap:')) {
        analysis.hasSitemap = true
      }
    } catch {
      // robots.txt not found or not accessible
    }

    // Check for sitemap.xml
    try {
      await axios.get(`${url.origin}/sitemap.xml`, { timeout: 5000 })
      analysis.hasSitemap = true
    } catch {
      // sitemap.xml not found
    }

    // Basic mobile-friendliness check
    const viewport = $('meta[name="viewport"]').attr('content')
    analysis.mobileFriendly = !!viewport && viewport.includes('width=device-width')

    // Basic accessibility checks
    let accessibilityScore = 0
    if (analysis.pageTitle) accessibilityScore += 20
    if (analysis.metaDescription) accessibilityScore += 10
    if (analysis.headingStructure!.h1 === 1) accessibilityScore += 20
    if ($('img[alt]').length > 0) accessibilityScore += 15
    if ($('a[href]').length > 0) accessibilityScore += 10
    if (analysis.headingStructure!.h2 > 0) accessibilityScore += 10
    if ($('form label').length > 0) accessibilityScore += 15
    analysis.accessibilityScore = Math.min(accessibilityScore, 100)

    // Basic SEO score
    let seoScore = 0
    if (analysis.pageTitle && analysis.pageTitle.length > 10 && analysis.pageTitle.length < 60) seoScore += 20
    if (analysis.metaDescription && analysis.metaDescription.length > 120 && analysis.metaDescription.length < 160) seoScore += 20
    if (analysis.hasOpenGraph) seoScore += 15
    if (analysis.hasTwitterCards) seoScore += 10
    if (analysis.hasStructuredData) seoScore += 15
    if (analysis.hasSitemap) seoScore += 10
    if (analysis.hasRobotsTxt) seoScore += 5
    if (analysis.headingStructure!.h1 === 1) seoScore += 5
    analysis.seoScore = Math.min(seoScore, 100)

    // Simulate page load speed (basic estimation)
    analysis.pageLoadSpeed = Math.max(1, Math.min(10, Math.round(html.length / 50000))) // Rough estimation

    // Set languages based on detected technologies
    if (technologies.length > 0) {
      analysis.languages = technologies
    } else {
      analysis.languages = ['HTML', 'CSS', 'JavaScript']
    }

    // Check for error handling patterns in JavaScript
    const scripts = $('script').text()
    analysis.errorHandling = scripts.includes('try') && scripts.includes('catch') || 
                           scripts.includes('console.error') || 
                           scripts.includes('throw')

    console.log('✅ Website analysis completed:', {
      title: analysis.pageTitle,
      technologies: analysis.technologies,
      accessibilityScore: analysis.accessibilityScore,
      seoScore: analysis.seoScore,
      mobileFriendly: analysis.mobileFriendly
    })

    return analysis
  } catch (error) {
    console.error('Website analysis error:', error)
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function analyzeWebsite(websiteUrl: string): Promise<WebsiteAnalysisResult> {
  try {
    console.log('🌐 Starting website AI agent readiness analysis for:', websiteUrl)
    
    // Fetch the website content
    const response = await axios.get(websiteUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-Analyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    })

    const html = response.data
    const $ = cheerio.load(html)
    const url = new URL(websiteUrl)

    // Detect website type
    const websiteType = detectWebsiteType($, html, websiteUrl)
    
    // Initialize clean website analysis result
    const analysis: WebsiteAnalysisResult = {
      // Basic website info
      websiteUrl: websiteUrl,
      pageTitle: $('title').text().trim() || 'No title found',
      metaDescription: $('meta[name="description"]').attr('content') || '',
      
      // AI Agent Readiness - Core Metrics
      hasStructuredData: $('script[type="application/ld+json"]').length > 0,
      hasOpenGraph: $('meta[property^="og:"]').length > 0,
      hasTwitterCards: $('meta[name^="twitter:"]').length > 0,
      hasSitemap: false,
      hasRobotsTxt: false,
      hasFavicon: $('link[rel="icon"], link[rel="shortcut icon"]').length > 0,
      hasManifest: $('link[rel="manifest"]').length > 0,
      hasServiceWorker: false,
      
      // Performance & Accessibility
      pageLoadSpeed: 0,
      mobileFriendly: $('meta[name="viewport"]').length > 0,
      accessibilityScore: 0,
      seoScore: 0,
      
      // Content Analysis
      contentLength: html.length,
      imageCount: $('img').length,
      linkCount: $('a[href]').length,
      headingStructure: {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length,
        h4: $('h4').length,
        h5: $('h5').length,
        h6: $('h6').length,
      },
      
      // Technology & Integration
      technologies: [],
      securityHeaders: [],
      socialMediaLinks: [],
      contactInfo: [],
      navigationStructure: [],
      
      // Website Type Detection
      websiteType: websiteType
    }

    // Check for sitemap and robots.txt (crawling support)
    try {
      const robotsResponse = await axios.get(new URL('/robots.txt', websiteUrl).toString(), { timeout: 5000 })
      analysis.hasRobotsTxt = true
      analysis.hasSitemap = robotsResponse.data.toLowerCase().includes('sitemap')
    } catch {
      // robots.txt not found
    }

    // Check for service worker (PWA capabilities)
    const swScripts = $('script').filter((_, el) => {
      const scriptContent = $(el).html() || ''
      return scriptContent.includes('serviceWorker') || scriptContent.includes('navigator.serviceWorker')
    })
    analysis.hasServiceWorker = swScripts.length > 0

    // Calculate accessibility score
    let accessibilityScore = 0
    if ($('h1').length > 0) accessibilityScore += 20 // Single H1
    if ($('nav').length > 0) accessibilityScore += 20 // Navigation structure
    if ($('main').length > 0) accessibilityScore += 20 // Main content area
    if ($('img[alt]').length > 0) accessibilityScore += 20 // Alt text for images
    if ($('a[href]').length > 0) accessibilityScore += 20 // Links have href
    analysis.accessibilityScore = accessibilityScore

    // Calculate SEO score
    let seoScore = 0
    if (analysis.pageTitle && analysis.pageTitle.length > 10 && analysis.pageTitle.length < 60) seoScore += 25
    if (analysis.metaDescription && analysis.metaDescription.length > 120 && analysis.metaDescription.length < 160) seoScore += 25
    if (analysis.hasStructuredData) seoScore += 25
    if (analysis.hasOpenGraph) seoScore += 25
    analysis.seoScore = seoScore

    // Detect technologies
    const techSet = new Set<string>()
    $('meta[name="generator"]').each((_, el) => {
      const content = $(el).attr('content')
      if (content) techSet.add(content)
    })
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src')
      if (src) {
        if (src.includes('jquery')) techSet.add('jQuery')
        if (src.includes('react')) techSet.add('React')
        if (src.includes('vue')) techSet.add('Vue.js')
        if (src.includes('angular')) techSet.add('Angular')
        if (src.includes('bootstrap')) techSet.add('Bootstrap')
        if (src.includes('tailwind')) techSet.add('Tailwind CSS')
      }
    })
    analysis.technologies = Array.from(techSet)

    // Extract social media links
    const socialLinks: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        if (href.includes('facebook.com')) socialLinks.push('Facebook')
        if (href.includes('twitter.com') || href.includes('x.com')) socialLinks.push('Twitter/X')
        if (href.includes('linkedin.com')) socialLinks.push('LinkedIn')
        if (href.includes('instagram.com')) socialLinks.push('Instagram')
        if (href.includes('youtube.com')) socialLinks.push('YouTube')
      }
    })
    analysis.socialMediaLinks = [...new Set(socialLinks)]

    // Extract contact information
    const contactInfo: string[] = []
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) contactInfo.push(href.replace('tel:', ''))
    })
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) contactInfo.push(href.replace('mailto:', ''))
    })
    analysis.contactInfo = contactInfo

    // Analyze navigation structure
    const navItems: string[] = []
    $('nav a, .nav a, .navigation a, .menu a').each((_, el) => {
      const text = $(el).text().trim()
      if (text) navItems.push(text)
    })
    analysis.navigationStructure = navItems

    // Add type-specific metrics based on detected website type
    if (analysis.websiteType === 'restaurant') {
      analysis.restaurantMetrics = analyzeRestaurantMetrics($, html)
    } else if (analysis.websiteType === 'documentation') {
      analysis.documentationMetrics = analyzeDocumentationMetrics($, html)
    } else if (analysis.websiteType === 'ecommerce') {
      analysis.ecommerceMetrics = analyzeEcommerceMetrics($, html)
    }

    console.log('✅ Website AI agent readiness analysis completed:', {
      url: websiteUrl,
      title: analysis.pageTitle,
      type: analysis.websiteType,
      structuredData: analysis.hasStructuredData,
      openGraph: analysis.hasOpenGraph,
      accessibility: analysis.accessibilityScore,
      seo: analysis.seoScore,
      technologies: analysis.technologies.length,
      socialLinks: analysis.socialMediaLinks.length,
      contactInfo: analysis.contactInfo.length
    })

    return analysis
  } catch (error) {
    console.error('Website analysis error:', error)
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}