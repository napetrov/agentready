import JSZip from 'jszip'
import axios from 'axios'
import { FileSizeAnalyzer, FileSizeAnalysis } from './file-size-analyzer'

// Common extensionless files that should be treated as code files
const EXTENSIONLESS_FILES = [
  'dockerfile', 'makefile', 'cmake', 'gradle', 'maven', 'pom', 'sbt', 
  'build', 'gulpfile', 'gruntfile', 'rakefile', 'gemfile', 'vagrantfile',
  'procfile', 'heroku', 'gitignore', 'gitattributes', 'dockerignore'
]

/**
 * Group locations by city/region for better organization
 */
function groupLocations(locations: string[]): Array<{city: string, addresses: string[]}> {
  const grouped = new Map<string, string[]>()
  
  for (const location of locations) {
    // Extract city from location string
    let city = 'Unknown'
    
    // Try to extract city from various formats
    const cityMatch = location.match(/([A-Za-z\s]+),\s*([A-Z]{2})/)
    if (cityMatch) {
      city = cityMatch[1].trim()
    } else {
      // Look for city patterns in addresses
      const addressCityMatch = location.match(/\b([A-Za-z\s]{3,20}),\s*[A-Z]{2}\b/)
      if (addressCityMatch) {
        city = addressCityMatch[1].trim()
      } else {
        // If no clear city, use first part before comma or just the location
        const parts = location.split(',')
        if (parts.length > 1) {
          city = parts[parts.length - 2]?.trim() || parts[0].trim()
        } else {
          city = location.trim()
        }
      }
    }
    
    if (!grouped.has(city)) {
      grouped.set(city, [])
    }
    grouped.get(city)!.push(location)
  }
  
  return Array.from(grouped.entries()).map(([city, addresses]) => ({
    city,
    addresses: [...new Set(addresses)] // Remove duplicates within city
  }))
}
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
  socialMediaLinks?: Array<{platform: string, url: string}>
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
  socialMediaLinks: Array<{platform: string, url: string}>
  contactInfo: string[]
  navigationStructure: string[]
  locations: string[]
  
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
      console.error(`❌ Failed to download main branch for ${owner}/${repo}:`, error.message)
      
      if (error.response?.status === 404) {
        // Try master branch if main doesn't exist
        try {
          console.log(`🔄 Trying master branch for ${owner}/${repo}`)
          const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`
          response = await axios.get(zipUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
          })
          branch = 'master'
          console.log(`✅ Successfully downloaded master branch for ${owner}/${repo}`)
        } catch (masterError: any) {
          console.error(`❌ Failed to download master branch for ${owner}/${repo}:`, masterError.message)
          if (masterError.response?.status === 404) {
            throw new Error('Repository not found or is private')
          } else if (masterError.code === 'ECONNABORTED') {
            throw new Error('Repository download timed out - repository may be too large')
          } else if (masterError.response?.status === 403) {
            throw new Error('Repository access forbidden - may be private or rate limited')
          } else {
            throw new Error(`Failed to download repository: ${masterError.message}`)
          }
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Repository download timed out - repository may be too large')
      } else if (error.response?.status === 403) {
        throw new Error('Repository access forbidden - may be private or rate limited')
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - please try again later')
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
    // Use the module-level constant for extensionless files
  
  const basename = filename.toLowerCase().split('/').pop() || ''
  if (EXTENSIONLESS_FILES.includes(basename)) return true
  
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
    // This provides protection against DNS rebinding attacks by ensuring we only connect to public IPs
    const { lookup } = await import('node:dns/promises')
    const addrs = await lookup(host, { all: true })
    const isPrivate = (ip: string) =>
      /^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) || /^169\.254\./.test(ip) ||
      ip === '0.0.0.0' || /^::1$/.test(ip) || /^fe80:/i.test(ip) || /^fc00:|^fd00:/i.test(ip)
    
    // Additional DNS rebinding protection: ensure all resolved addresses are public
    if (addrs.some(a => isPrivate(a.address))) {
      throw new Error('Refusing to fetch hosts resolving to private/link-local IPs (DNS rebinding protection)')
    }

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
                  
                  // Escape the URL to prevent command injection
                  const escapedUrl = websiteUrl.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')
                  const curlCommand = `curl -s -L -m 30 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${escapedUrl}"`
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

    // Extract social media links (deduplicated with URLs)
    const socialLinks: Array<{platform: string, url: string}> = []
    const socialSet = new Set<string>() // Use Set to prevent duplicates
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href) {
        // Facebook
        if (href.includes('facebook.com') && !socialSet.has('facebook.com')) {
          socialLinks.push({ platform: 'Facebook', url: href })
          socialSet.add('facebook.com')
        }
        // Twitter/X
        if ((href.includes('twitter.com') || href.includes('x.com')) && !socialSet.has('twitter.com') && !socialSet.has('x.com')) {
          socialLinks.push({ platform: 'Twitter/X', url: href })
          socialSet.add(href.includes('x.com') ? 'x.com' : 'twitter.com')
        }
        // LinkedIn
        if (href.includes('linkedin.com') && !socialSet.has('linkedin.com')) {
          socialLinks.push({ platform: 'LinkedIn', url: href })
          socialSet.add('linkedin.com')
        }
        // Instagram
        if (href.includes('instagram.com') && !socialSet.has('instagram.com')) {
          socialLinks.push({ platform: 'Instagram', url: href })
          socialSet.add('instagram.com')
        }
        // YouTube
        if (href.includes('youtube.com') && !socialSet.has('youtube.com')) {
          socialLinks.push({ platform: 'YouTube', url: href })
          socialSet.add('youtube.com')
        }
        // GitHub
        if (href.includes('github.com') && !socialSet.has('github.com')) {
          socialLinks.push({ platform: 'GitHub', url: href })
          socialSet.add('github.com')
        }
      }
    })

    // Extract contact information (deduplicated)
    const contactInfo: string[] = []
    const contactSet = new Set<string>() // Use Set to prevent duplicates
    
    // Extract location information (deduplicated)
    const locations: string[] = []
    const locationSet = new Set<string>() // Use Set to prevent duplicates
    
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
    
    // Also extract email addresses from text content (common pattern for tech sites)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const textContent = $('body').text()
    let emailMatch
    while ((emailMatch = emailRegex.exec(textContent)) !== null) {
      const email = emailMatch[0].toLowerCase()
      if (!contactSet.has(email)) {
        contactInfo.push(email)
        contactSet.add(email)
      }
    }
    
    // Extract phone numbers from text content (common patterns)
    const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g
    let phoneMatch
    while ((phoneMatch = phoneRegex.exec(textContent)) !== null) {
      const phone = phoneMatch[0].trim()
      if (!contactSet.has(phone)) {
        contactInfo.push(phone)
        contactSet.add(phone)
      }
    }

    // Extract location information from structured data and content
    // 1. Check for structured data (JSON-LD, microdata)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).html() || '')
        if (jsonData.address) {
          let address = ''
          if (typeof jsonData.address === 'string') {
            address = jsonData.address
          } else if (jsonData.address.streetAddress) {
            address = [
              jsonData.address.streetAddress,
              jsonData.address.addressLocality,
              jsonData.address.addressRegion,
              jsonData.address.postalCode
            ].filter(Boolean).join(', ')
          }
          if (address && !locationSet.has(address.toLowerCase())) {
            locations.push(address)
            locationSet.add(address.toLowerCase())
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    })

    // 2. Check for microdata address information
    $('[itemscope][itemtype*="PostalAddress"], .address, [class*="address"]').each((_, el) => {
      const addressText = $(el).text().trim()
      if (addressText && addressText.length > 10 && !locationSet.has(addressText.toLowerCase())) {
        locations.push(addressText)
        locationSet.add(addressText.toLowerCase())
      }
    })

    // 3. Extract addresses from text content using regex patterns
    const addressRegex = /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[\s,.-]*(?:[A-Za-z\s,.-]+)?(?:[A-Z]{2,3})?[\s,.-]*(?:\d{5}(?:-\d{4})?)?/gi
    let addressMatch
    while ((addressMatch = addressRegex.exec(textContent)) !== null) {
      const address = addressMatch[0].trim()
      if (address.length > 15 && !locationSet.has(address.toLowerCase())) {
        locations.push(address)
        locationSet.add(address.toLowerCase())
      }
    }

    // 4. Look for city, state patterns
    const cityStateRegex = /\b([A-Za-z\s]+),\s*([A-Z]{2})\b/g
    let cityStateMatch
    while ((cityStateMatch = cityStateRegex.exec(textContent)) !== null) {
      const location = cityStateMatch[0].trim()
      if (!locationSet.has(location.toLowerCase())) {
        locations.push(location)
        locationSet.add(location.toLowerCase())
      }
    }

    // 5. Check for Google Maps or other map links
    $('a[href*="maps.google"], a[href*="goo.gl/maps"], a[href*="maps.apple"]').each((_, el) => {
      const linkText = $(el).text().trim()
      if (linkText && linkText.length > 5 && !locationSet.has(linkText.toLowerCase())) {
        locations.push(linkText)
        locationSet.add(linkText.toLowerCase())
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

    // Analyze key pages to get comprehensive information
    console.log('🔍 Analyzing key pages for additional contact info and social media...')
    const keyPageData = await analyzeKeyPages(websiteUrl, $)
    
    // Merge key page data with main page data
    const allContactInfo = [...new Set([...contactInfo, ...keyPageData.contactInfo])]
    const allSocialLinks = [...socialLinks, ...keyPageData.socialMediaLinks]
    const allNavItems = [...new Set([...navItems, ...keyPageData.navigationStructure])]
    const allLocations = [...new Set([...locations, ...keyPageData.locations])]

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
      socialMediaLinks: allSocialLinks,
      contactInfo: allContactInfo,
      navigationStructure: allNavItems,
      locations: allLocations,
      
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
 * Follow key navigation links to gather comprehensive site information
 */
async function analyzeKeyPages(websiteUrl: string, $: any): Promise<{
  contactInfo: string[],
  socialMediaLinks: Array<{platform: string, url: string}>,
  navigationStructure: string[],
  locations: string[]
}> {
  const baseUrl = new URL(websiteUrl)
  const contactInfo = new Set<string>()
  const socialMediaLinks: Array<{platform: string, url: string}> = []
  const socialSet = new Set<string>()
  const navigationStructure = new Set<string>()
  const locations = new Set<string>()
  
  // Key pages to check for additional information
  const keyPagePatterns = [
    /contact/i,
    /about/i,
    /services/i,
    /pricing/i,
    /support/i,
    /help/i,
    /team/i,
    /company/i
  ]
  
  // Find links to key pages
  const keyPageLinks: string[] = []
  $('a[href]').each((_: number, el: any) => {
    const href = $(el).attr('href')
    if (href) {
      try {
        const linkUrl = new URL(href, websiteUrl)
        // Only follow internal links
        if (linkUrl.hostname === baseUrl.hostname) {
          const linkText = $(el).text().toLowerCase().trim()
          const hrefLower = href.toLowerCase()
          
          // Check if this looks like a key page
          if (keyPagePatterns.some(pattern => pattern.test(linkText) || pattern.test(hrefLower))) {
            keyPageLinks.push(linkUrl.href)
          }
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  })
  
  // Limit to first 3 key pages to avoid overwhelming the system
  const pagesToAnalyze = keyPageLinks.slice(0, 3)
  
  console.log(`🔍 Found ${keyPageLinks.length} potential key pages, analyzing ${pagesToAnalyze.length}`)
  
  // Analyze each key page
  for (const pageUrl of pagesToAnalyze) {
    try {
      console.log(`📄 Analyzing key page: ${pageUrl}`)
      
      // Use the same HTTP strategies as the main page
      let pageResponse
      try {
        pageResponse = await axios.get(pageUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'AI-Agent-Readiness-Assessment/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
          }
        })
      } catch (error: any) {
        if (error.code === 'HPE_INVALID_HEADER_TOKEN' || error.message?.includes('Parse Error: Invalid header value char')) {
          // Try fallback strategies for this page too
          try {
            pageResponse = await axios.get(pageUrl, { 
              decompress: false,
              timeout: 10000,
              headers: { 'User-Agent': 'AI-Agent-Readiness-Assessment/1.0' }
            })
          } catch (strategy1Error: any) {
            // Skip this page if all strategies fail
            continue
          }
        } else {
          continue
        }
      }
      
      const { load } = await import('cheerio')
      const page$ = load(pageResponse.data)
      
      // Extract contact info from this page
      page$('a[href^="tel:"]').each((_: number, el: any) => {
        const href = page$(el).attr('href')
        if (href) {
          const phoneNumber = href.replace('tel:', '').trim()
          if (phoneNumber) contactInfo.add(phoneNumber)
        }
      })
      
      page$('a[href^="mailto:"]').each((_: number, el: any) => {
        const href = page$(el).attr('href')
        if (href) {
          const email = href.replace('mailto:', '').trim()
          if (email) contactInfo.add(email)
        }
      })

      // Extract location info from this page
      const pageText = page$('body').text()
      
      // Check for structured data
      page$('script[type="application/ld+json"]').each((_: number, el: any) => {
        try {
          const jsonData = JSON.parse(page$(el).html() || '')
          if (jsonData.address) {
            let address = ''
            if (typeof jsonData.address === 'string') {
              address = jsonData.address
            } else if (jsonData.address.streetAddress) {
              address = [
                jsonData.address.streetAddress,
                jsonData.address.addressLocality,
                jsonData.address.addressRegion,
                jsonData.address.postalCode
              ].filter(Boolean).join(', ')
            }
            if (address) locations.add(address)
          }
        } catch (e) {
          // Skip invalid JSON
        }
      })

      // Extract addresses from text content
      const addressRegex = /\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[\s,.-]*(?:[A-Za-z\s,.-]+)?(?:[A-Z]{2,3})?[\s,.-]*(?:\d{5}(?:-\d{4})?)?/gi
      let addressMatch
      while ((addressMatch = addressRegex.exec(pageText)) !== null) {
        const address = addressMatch[0].trim()
        if (address.length > 15) locations.add(address)
      }

      // Extract city, state patterns
      const cityStateRegex = /\b([A-Za-z\s]+),\s*([A-Z]{2})\b/g
      let cityStateMatch
      while ((cityStateMatch = cityStateRegex.exec(pageText)) !== null) {
        const location = cityStateMatch[0].trim()
        locations.add(location)
      }
      
      // Extract social media links from this page
      page$('a[href]').each((_: number, el: any) => {
        const href = page$(el).attr('href')
        if (href) {
          // GitHub
          if (href.includes('github.com') && !socialSet.has('github.com')) {
            socialMediaLinks.push({ platform: 'GitHub', url: href })
            socialSet.add('github.com')
          }
          // Facebook
          if (href.includes('facebook.com') && !socialSet.has('facebook.com')) {
            socialMediaLinks.push({ platform: 'Facebook', url: href })
            socialSet.add('facebook.com')
          }
          // Twitter/X
          if ((href.includes('twitter.com') || href.includes('x.com')) && !socialSet.has('twitter.com') && !socialSet.has('x.com')) {
            socialMediaLinks.push({ platform: 'Twitter/X', url: href })
            socialSet.add(href.includes('x.com') ? 'x.com' : 'twitter.com')
          }
          // LinkedIn
          if (href.includes('linkedin.com') && !socialSet.has('linkedin.com')) {
            socialMediaLinks.push({ platform: 'LinkedIn', url: href })
            socialSet.add('linkedin.com')
          }
        }
      })
      
      // Extract navigation structure
      page$('nav a, .nav a, .navigation a, .menu a').each((_: number, el: any) => {
        const text = page$(el).text().trim()
        if (text && text.length < 50) { // Reasonable navigation item length
          navigationStructure.add(text)
        }
      })
      
    } catch (error) {
      console.warn(`⚠️ Failed to analyze key page ${pageUrl}:`, error)
      continue
    }
  }
  
  return {
    contactInfo: Array.from(contactInfo),
    socialMediaLinks,
    navigationStructure: Array.from(navigationStructure),
    locations: Array.from(locations)
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
    locations: [],
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