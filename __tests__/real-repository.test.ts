import { analyzeRepository } from '../lib/analyzer'
import { generateAIAssessment } from '../lib/ai-assessment'
import { generateEnhancedAIAssessment } from '../lib/enhanced-ai-assessment'

// Mock axios to prevent real HTTP requests
jest.mock('axios')
const axios = require('axios')

describe('Real Repository Analysis', () => {
  // Mock the GitHub API calls to avoid rate limiting in tests
  beforeEach(() => {
    // Mock axios for GitHub API
    axios.get = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should analyze napetrov/daal repository correctly', async () => {
    // Mock the GitHub API response
    const mockZipData = new ArrayBuffer(1024) // Mock zip data
    ;(axios.get as jest.Mock).mockResolvedValueOnce({
      data: mockZipData,
      status: 200
    })

    // Mock JSZip with realistic file sizes
    const mockZip = {
      files: {
        'daal-main/README.md': {
          async: jest.fn().mockResolvedValue('# oneAPI Data Analytics Library\n'.repeat(100)), // ~2KB
          dir: false
        },
        'daal-main/AGENTS.md': {
          async: jest.fn().mockResolvedValue('# AI Agents Context\n'.repeat(50)), // ~1KB
          dir: false
        },
        'daal-main/CONTRIBUTING.md': {
          async: jest.fn().mockResolvedValue('# How to Contribute\n'.repeat(200)), // ~4KB
          dir: false
        },
        'daal-main/LICENSE': {
          async: jest.fn().mockResolvedValue('Apache License\n'.repeat(100)), // ~2KB
          dir: false
        },
        'daal-main/.github/workflows/ci.yml': {
          async: jest.fn().mockResolvedValue('name: CI\n'.repeat(50)), // ~1KB
          dir: false
        },
        'daal-main/test/test.cpp': {
          async: jest.fn().mockResolvedValue('#include <test>\n'.repeat(1000)), // ~20KB
          dir: false
        },
        'daal-main/src/main.cpp': {
          async: jest.fn().mockResolvedValue('#include <iostream>\n'.repeat(2000)), // ~40KB
          dir: false
        }
      }
    }

    const JSZip = require('jszip')
    JSZip.loadAsync = jest.fn().mockResolvedValue(mockZip)

    const result = await analyzeRepository('https://github.com/napetrov/daal')

    // Verify basic analysis results
    expect(result).toBeDefined()
    expect(result.hasReadme).toBe(true)
    expect(result.hasAgents).toBe(true)
    expect(result.hasContributing).toBe(true)
    expect(result.hasLicense).toBe(true)
    expect(result.hasWorkflows).toBe(true)
    expect(result.hasTests).toBe(true)
    expect(result.fileCount).toBeGreaterThan(0)
    expect(result.linesOfCode).toBeGreaterThan(0)
    expect(result.repositorySizeMB).toBeGreaterThan(0)
    expect(result.languages).toContain('C++')
    expect(result.languages).toContain('Markdown')
  }, 30000) // 30 second timeout for real repository analysis

  test('should generate AI assessment for real repository', async () => {
    const mockStaticAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: true,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['C++', 'Markdown', 'Python'],
      errorHandling: true,
      fileCount: 1000,
      linesOfCode: 50000,
      repositorySizeMB: 10.5,
      workflowFiles: ['ci.yml'],
      testFiles: ['test.cpp'],
      readmeContent: 'Comprehensive README',
      contributingContent: 'Contributing guidelines',
      agentsContent: 'AI agent instructions'
    }

    const result = await generateAIAssessment(mockStaticAnalysis)

    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThan(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  test('should generate enhanced AI assessment for real repository', async () => {
    const mockStaticAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: true,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['C++', 'Markdown', 'Python'],
      errorHandling: true,
      fileCount: 1000,
      linesOfCode: 50000,
      repositorySizeMB: 10.5,
      workflowFiles: ['ci.yml'],
      testFiles: ['test.cpp'],
      readmeContent: 'Comprehensive README',
      contributingContent: 'Contributing guidelines',
      agentsContent: 'AI agent instructions'
    }

    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)

    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThan(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.categories.instructionClarity).toBeGreaterThan(0)
    expect(result.categories.workflowAutomation).toBeGreaterThan(0)
    expect(result.categories.riskCompliance).toBeGreaterThan(0)
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
  })

  test('should handle repository analysis errors gracefully', async () => {
    // Mock a failed GitHub API response
    ;(axios.get as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    await expect(analyzeRepository('https://github.com/invalid/repo')).rejects.toThrow()
  })

  test('should handle invalid repository URLs', async () => {
    await expect(analyzeRepository('not-a-url')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://github.com')).rejects.toThrow('Invalid GitHub repository URL format')
  })
})