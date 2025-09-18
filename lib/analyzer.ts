import JSZip from 'jszip'
import axios from 'axios'
import { FileSizeAnalyzer, FileSizeAnalysis } from './file-size-analyzer'
import { GitHubAPIClient, GitHubRepositoryData } from './github-api-client'

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
  githubData?: GitHubRepositoryData
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

    // Initialize GitHub API client if token is available
    let githubData: GitHubRepositoryData | undefined
    if (process.env.GITHUB_TOKEN) {
      try {
        console.log('🔍 Fetching GitHub repository data...')
        const githubClient = new GitHubAPIClient(process.env.GITHUB_TOKEN)
        githubData = await githubClient.getRepositoryData(repoUrl)
        console.log('✅ GitHub data fetched successfully')
      } catch (error) {
        console.warn('⚠️ Failed to fetch GitHub data, continuing with local analysis only:', error)
      }
    } else {
      console.log('ℹ️ No GitHub token provided, skipping GitHub API data collection')
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

    // Add GitHub data to analysis
    analysis.githubData = githubData

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