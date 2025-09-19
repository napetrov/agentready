import JSZip from 'jszip'
import axios from 'axios'
import { FileSizeAnalyzer, FileSizeAnalysis } from './file-size-analyzer'
import { 
  BusinessType, 
  BUSINESS_TYPE_CONFIGS,
  detectBusinessType,
  analyzeAgenticFlows,
  analyzeAIRelevantChecks,
  generateAIReadinessInsights,
  AIAgentReadinessResult
} from './business-type-analyzer'

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

export interface WebsiteAnalysisResult extends AIAgentReadinessResult {
  // Basic website info
  websiteUrl: string
  pageTitle: string
  metaDescription: string
  
  // Content Analysis (AI-relevant only)
  contentLength: number
  linkCount: number
  
  // Technology & Integration (AI-relevant only)
  technologies: string[]
  socialMediaLinks: string[]
  contactInfo: string[]
  navigationStructure: string[]
  
  // Legacy fields for backward compatibility (deprecated)
  hasStructuredData: boolean
  hasOpenGraph: boolean
  hasTwitterCards: boolean
  hasSitemap: boolean
  hasRobotsTxt: boolean
  agenticFlows: any
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
      if (isTextFile(file)) {
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

function isTextFile(filename: string): boolean {
  if (!filename) return false
  
  // Check for extensionless files first
  const extensionlessFiles = [
    'dockerfile', 'makefile', 'cmake', 'gradle', 'maven', 'pom', 'sbt', 
    'build', 'gulpfile', 'gruntfile', 'rakefile', 'gemfile', 'vagrantfile',
    'procfile', 'heroku', 'gitignore', 'gitattributes', 'dockerignore'
  ]
  
  const basename = filename.toLowerCase().split('/').pop() || ''
  if (extensionlessFiles.includes(basename)) return true
  
  // Check for files with extensions
  const extension = filename.split('.').pop()?.toLowerCase()
  if (!extension) return false
  
  const textExtensions = [
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp',
    'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r',
    'm', 'mm', 'pl', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat',
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'xml', 'json',
    'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'md', 'txt',
    'rst', 'tex', 'sql'
  ]
  
  return textExtensions.includes(extension)
}

// Legacy functions removed - now using business-type-analyzer.ts

// Legacy function removed - now using analyzeWebsite() with business-type-aware system

export async function analyzeWebsite(websiteUrl: string): Promise<WebsiteAnalysisResult> {
  try {
    console.log('🌐 Starting business-type-aware AI agent readiness analysis for:', websiteUrl)
    
    // SSRF guard
    const parsed = new URL(websiteUrl)
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http/https URLs are allowed')
    const host = parsed.hostname
    if (
      /(localhost|^127\.|^0\.0\.0\.0)/i.test(host) ||
      /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^(\[?::1\]?|::1)$/.test(host)
    ) throw new Error('Refusing to fetch private/loopback hosts')

    // DNS-level guard: block private, link-local, and unique-local IPs
    const { lookup } = await import('node:dns/promises')
    const addrs = await lookup(host, { all: true })
    const isPrivate = (ip: string) =>
      /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) || /^169\.254\./.test(ip) ||
      ip === '0.0.0.0' || /^::1$/.test(ip) || /^fe80:/i.test(ip) || /^fc00:|^fd00:/i.test(ip)
    if (addrs.some(a => isPrivate(a.address))) throw new Error('Refusing to fetch hosts resolving to private/link-local IPs')

    // Import cheerio dynamically
    const { load } = await import('cheerio')
    
    // Fetch the website content with retry logic for malformed headers
    let response
    try {
      response = await axios.get(websiteUrl, {
        timeout: 30000,
        maxRedirects: 3,
        maxContentLength: 5 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-Analyzer/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        // Add HTTP parser options to handle malformed headers
        httpAgent: new (await import('http')).Agent({
          keepAlive: true,
          timeout: 30000,
        }),
        httpsAgent: new (await import('https')).Agent({
          keepAlive: true,
          timeout: 30000,
        }),
      })
    } catch (error: any) {
      // Handle HTTP header parsing errors by trying with a different approach
      if (error.code === 'HPE_INVALID_HEADER_TOKEN' || error.message?.includes('Parse Error: Invalid header value char')) {
        console.warn(`⚠️  HTTP header parsing error for ${websiteUrl}, trying alternative approach...`)
        
        try {
          // Try multiple fallback strategies
          console.log(`🔄 Attempting fallback strategies for ${websiteUrl}...`)
          
          // Strategy 1: Try with minimal headers using axios
          try {
            console.log(`🔄 Strategy 1: Minimal axios request...`)
            response = await axios.get(websiteUrl, {
              timeout: 30000,
              maxRedirects: 3,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              // Disable automatic decompression to avoid header parsing issues
              decompress: false,
            })
            console.log(`✅ Strategy 1 (minimal axios) successful for ${websiteUrl}`)
          } catch (strategy1Error: any) {
            console.warn(`⚠️  Strategy 1 failed: ${strategy1Error.message}`)
            
            // Strategy 2: Try with Node.js built-in fetch (if available)
            try {
              console.log(`🔄 Strategy 2: Native fetch...`)
              if (typeof fetch !== 'undefined') {
                const fetchResponse = await fetch(websiteUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  },
                  // Set a timeout using AbortController
                  signal: AbortSignal.timeout(30000),
                })
                
                if (!fetchResponse.ok) {
                  throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
                }
                
                const html = await fetchResponse.text()
                
                // Create a mock axios response object to maintain compatibility
                response = {
                  data: html,
                  status: fetchResponse.status,
                  statusText: fetchResponse.statusText,
                  headers: Object.fromEntries(fetchResponse.headers.entries()),
                  config: {},
                  request: {},
                }
                console.log(`✅ Strategy 2 (native fetch) successful for ${websiteUrl}`)
              } else {
                throw new Error('Native fetch not available')
              }
            } catch (strategy2Error: any) {
              console.warn(`⚠️  Strategy 2 failed: ${strategy2Error.message}`)
              
              // Strategy 3: Try with node-fetch (if available)
              try {
                console.log(`🔄 Strategy 3: node-fetch...`)
                const nodeFetch = await import('node-fetch')
                const fetchResponse = await nodeFetch.default(websiteUrl, {
                  method: 'GET',
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  },
                  timeout: 30000,
                })
                
                if (!fetchResponse.ok) {
                  throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`)
                }
                
                const html = await fetchResponse.text()
                
                // Create a mock axios response object to maintain compatibility
                response = {
                  data: html,
                  status: fetchResponse.status,
                  statusText: fetchResponse.statusText,
                  headers: Object.fromEntries(fetchResponse.headers.entries()),
                  config: {},
                  request: {},
                }
                console.log(`✅ Strategy 3 (node-fetch) successful for ${websiteUrl}`)
              } catch (strategy3Error: any) {
                console.warn(`⚠️  Strategy 3 failed: ${strategy3Error.message}`)
                
                // Strategy 4: Try with curl-like approach using child_process
                try {
                  console.log(`🔄 Strategy 4: curl fallback...`)
                  const { exec } = await import('child_process')
                  const { promisify } = await import('util')
                  const execAsync = promisify(exec)
                  
                  const curlCommand = `curl -s -L -m 30 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${websiteUrl}"`
                  const { stdout } = await execAsync(curlCommand)
                  
                  response = {
                    data: stdout,
                    status: 200,
                    statusText: 'OK',
                    headers: {},
                    config: {},
                    request: {},
                  }
                  console.log(`✅ Strategy 4 (curl) successful for ${websiteUrl}`)
                } catch (strategy4Error: any) {
                  console.warn(`⚠️  Strategy 4 failed: ${strategy4Error.message}`)
                  throw new Error(`All fallback strategies failed. Last error: ${strategy4Error.message}`)
                }
              }
            }
          }
        } catch (fallbackError: any) {
          console.error(`❌ All HTTP request strategies failed for ${websiteUrl}:`, {
            primaryError: error.message,
            fallbackError: fallbackError.message,
          })
          
          // Final fallback: Provide basic analysis based on URL structure
          console.warn(`🔄 Attempting URL-based analysis fallback for ${websiteUrl}...`)
          return await createURLBasedAnalysis(websiteUrl, error.message)
        }
      } else {
        throw new Error(`Failed to fetch website content: ${error.message}`)
      }
    }

    const html = response.data
    const $ = load(html)
    const url = new URL(websiteUrl)

    // Detect business type using new system
    const businessType = detectBusinessType($, html, websiteUrl)
    const businessTypeConfig = BUSINESS_TYPE_CONFIGS[businessType]
    
    // Calculate business type confidence
    let businessTypeConfidence = 0
    const text = $('body').text().toLowerCase()
    const title = $('title').text().toLowerCase()
    const domain = url.hostname.toLowerCase()
    
    for (const keyword of businessTypeConfig.keywords) {
      if (text.includes(keyword)) businessTypeConfidence += 1
      if (title.includes(keyword)) businessTypeConfidence += 2
      if (domain.includes(keyword)) businessTypeConfidence += 3
    }
    businessTypeConfidence = Math.min(100, Math.round((businessTypeConfidence / businessTypeConfig.keywords.length) * 100))

    // Analyze agentic flows using business-type-aware system
    const agenticFlows = analyzeAgenticFlows($, html, businessType)
    
    // Calculate weighted overall score based on business type
    const overallScore = Math.round(
      (agenticFlows.informationGathering.score * businessTypeConfig.agenticFlowWeights.informationGathering) +
      (agenticFlows.directBooking.score * businessTypeConfig.agenticFlowWeights.directBooking) +
      (agenticFlows.faqSupport.score * businessTypeConfig.agenticFlowWeights.faqSupport) +
      (agenticFlows.taskManagement.score * businessTypeConfig.agenticFlowWeights.taskManagement) +
      (agenticFlows.personalization.score * businessTypeConfig.agenticFlowWeights.personalization)
    )

    // Analyze AI-relevant checks only
    const aiChecks = analyzeAIRelevantChecks($, html)
    
    // Check for sitemap and robots.txt (AI-relevant for crawling)
    try {
      const robotsResponse = await axios.get(new URL('/robots.txt', websiteUrl).toString(), { 
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Agent-Analyzer/1.0)',
        },
      })
      aiChecks.hasRobotsTxt = true
      aiChecks.hasSitemap = robotsResponse.data.toLowerCase().includes('sitemap')
    } catch (error: any) {
      // Handle HTTP header parsing errors for robots.txt as well
      if (error.code === 'HPE_INVALID_HEADER_TOKEN' || error.message?.includes('Parse Error: Invalid header value char')) {
        console.warn(`⚠️  HTTP header parsing error for robots.txt at ${websiteUrl}, skipping...`)
      }
      // robots.txt not found or other error - continue without it
    }

    // Generate insights
    const insights = generateAIReadinessInsights(businessType, agenticFlows, aiChecks)

    // Detect technologies (AI-relevant for integration)
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

    // Extract social media links (deduplicated)
    const socialLinks: string[] = []
    const socialSet = new Set<string>() // Use Set to prevent duplicates
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        if (href.includes('facebook.com') && !socialSet.has('Facebook')) {
          socialLinks.push('Facebook')
          socialSet.add('Facebook')
        }
        if ((href.includes('twitter.com') || href.includes('x.com')) && !socialSet.has('Twitter/X')) {
          socialLinks.push('Twitter/X')
          socialSet.add('Twitter/X')
        }
        if (href.includes('linkedin.com') && !socialSet.has('LinkedIn')) {
          socialLinks.push('LinkedIn')
          socialSet.add('LinkedIn')
        }
        if (href.includes('instagram.com') && !socialSet.has('Instagram')) {
          socialLinks.push('Instagram')
          socialSet.add('Instagram')
        }
        if (href.includes('youtube.com') && !socialSet.has('YouTube')) {
          socialLinks.push('YouTube')
          socialSet.add('YouTube')
        }
      }
    })

    // Extract contact information (deduplicated)
    const contactInfo: string[] = []
    const contactSet = new Set<string>() // Use Set to prevent duplicates
    
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        const phoneNumber = href.replace('tel:', '').trim()
        if (phoneNumber && !contactSet.has(phoneNumber)) {
          contactInfo.push(phoneNumber)
          contactSet.add(phoneNumber)
        }
      }
    })
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        const email = href.replace('mailto:', '').trim()
        if (email && !contactSet.has(email)) {
          contactInfo.push(email)
          contactSet.add(email)
        }
      }
    })

    // Analyze navigation structure (deduplicated)
    const navItems: string[] = []
    const navSet = new Set<string>() // Use Set to prevent duplicates
    
    $('nav a, .nav a, .navigation a, .menu a').each((_, el) => {
      const text = $(el).text().trim()
      if (text && !navSet.has(text)) {
        navItems.push(text)
        navSet.add(text)
      }
    })

    // Create the new business-type-aware analysis result
    const analysis: WebsiteAnalysisResult = {
      // Basic website info
      websiteUrl: websiteUrl,
      pageTitle: $('title').text().trim() || 'No title found',
      metaDescription: $('meta[name="description"]').attr('content') || '',
      
      // AI Agent Readiness (new system)
      businessType,
      businessTypeConfidence,
      overallScore,
      agenticFlows,
      aiRelevantChecks: aiChecks,
      findings: insights.findings,
      recommendations: insights.recommendations,
      
      // Content Analysis (AI-relevant only)
      contentLength: html.length,
      linkCount: $('a[href]').length,
      
      // Technology & Integration (AI-relevant only)
      technologies: Array.from(techSet),
      socialMediaLinks: [...new Set(socialLinks)],
      contactInfo: contactInfo,
      navigationStructure: navItems,
      
      // Legacy fields for backward compatibility
      hasStructuredData: aiChecks.hasStructuredData,
      hasOpenGraph: $('meta[property^="og:"]').length > 0,
      hasTwitterCards: $('meta[name^="twitter:"]').length > 0,
      hasSitemap: aiChecks.hasSitemap,
      hasRobotsTxt: aiChecks.hasRobotsTxt,
    }

    if (process.env.DEBUG_AI_ANALYZER === '1') console.log('✅ Business-type-aware AI agent readiness analysis completed:', {
      url: websiteUrl,
      businessType: businessTypeConfig.displayName,
      businessTypeConfidence,
      overallScore,
      informationGathering: agenticFlows.informationGathering.score,
      directBooking: agenticFlows.directBooking.score,
      faqSupport: agenticFlows.faqSupport.score,
      taskManagement: agenticFlows.taskManagement.score,
      personalization: agenticFlows.personalization.score,
      structuredData: aiChecks.hasStructuredData,
      contentAccessibility: aiChecks.contentAccessibility,
      technologies: analysis.technologies.length,
      contactInfo: analysis.contactInfo.length
    })

    return analysis
  } catch (error) {
    console.error('Website analysis error:', error)
    throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Create a basic analysis when HTTP requests fail
 * This provides minimal but useful information based on URL structure
 */
async function createURLBasedAnalysis(websiteUrl: string, errorMessage: string): Promise<WebsiteAnalysisResult> {
  const url = new URL(websiteUrl)
  const domain = url.hostname
  
  // Basic business type detection based on domain and path
  let businessType: BusinessType = 'unknown'
  let businessTypeConfidence = 30
  
  const domainLower = domain.toLowerCase()
  const pathLower = url.pathname.toLowerCase()
  
  // Simple keyword-based detection
  if (domainLower.includes('health') || domainLower.includes('medical') || domainLower.includes('clinic') || 
      pathLower.includes('health') || pathLower.includes('medical') || pathLower.includes('clinic') ||
      pathLower.includes('patient') || pathLower.includes('doctor')) {
    businessType = 'healthcare'
    businessTypeConfidence = 70
  } else if (domainLower.includes('food') || domainLower.includes('restaurant') || domainLower.includes('cafe') ||
             pathLower.includes('food') || pathLower.includes('restaurant') || pathLower.includes('cafe')) {
    businessType = 'food_service'
    businessTypeConfidence = 70
  } else if (domainLower.includes('hotel') || domainLower.includes('travel') || domainLower.includes('booking') ||
             pathLower.includes('hotel') || pathLower.includes('travel') || pathLower.includes('booking')) {
    businessType = 'hospitality'
    businessTypeConfidence = 70
  }
  
  // Create minimal agentic flows with low scores
  const agenticFlows = {
    informationGathering: { score: 20, details: {} },
    directBooking: { score: 15, details: {} },
    faqSupport: { score: 10, details: {} },
    taskManagement: { score: 15, details: {} },
    personalization: { score: 10, details: {} }
  }
  
  // Calculate minimal overall score
  const businessTypeConfig = BUSINESS_TYPE_CONFIGS[businessType]
  const overallScore = Math.round(
    (agenticFlows.informationGathering.score * businessTypeConfig.agenticFlowWeights.informationGathering) +
    (agenticFlows.directBooking.score * businessTypeConfig.agenticFlowWeights.directBooking) +
    (agenticFlows.faqSupport.score * businessTypeConfig.agenticFlowWeights.faqSupport) +
    (agenticFlows.taskManagement.score * businessTypeConfig.agenticFlowWeights.taskManagement) +
    (agenticFlows.personalization.score * businessTypeConfig.agenticFlowWeights.personalization)
  )
  
  // Create minimal AI checks
  const aiChecks = {
    hasStructuredData: false,
    hasOpenGraph: false,
    hasTwitterCards: false,
    hasSitemap: false,
    hasRobotsTxt: false,
    hasContactInfo: false,
    hasSocialMediaLinks: false,
    hasNavigationStructure: false,
    hasPageTitle: false,
    hasMetaDescription: false,
    contentAccessibility: 10 // Very low since we can't access content
  }
  
  // Generate minimal insights
  const insights = {
    findings: [
      `Unable to fetch website content due to HTTP header parsing error: ${errorMessage}`,
      `Basic analysis based on URL structure only`,
      `Domain: ${domain}`,
      `Detected business type: ${businessType} (confidence: ${businessTypeConfidence}%)`
    ],
    recommendations: [
      'Fix HTTP header formatting issues on the website',
      'Ensure all HTTP headers comply with RFC standards',
      'Consider using a web scraping service for problematic websites',
      'Add structured data (JSON-LD) to improve AI agent compatibility',
      'Implement proper error handling for malformed HTTP responses'
    ]
  }
  
  return {
    websiteUrl,
    businessType,
    businessTypeConfidence,
    overallScore,
    agenticFlows,
    aiRelevantChecks: aiChecks,
    technologies: [],
    socialMediaLinks: [],
    contactInfo: [],
    navigationStructure: [],
    contentLength: 0,
    pageTitle: domain,
    metaDescription: '',
    findings: insights.findings,
    recommendations: insights.recommendations,
    // Legacy fields for backward compatibility
    hasStructuredData: false,
    hasOpenGraph: false,
    hasTwitterCards: false,
    hasSitemap: false,
    hasRobotsTxt: false,
    linkCount: 0
  }
}