import { generateAIAssessment } from '../lib/ai-assessment'

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                readinessScore: 85,
                categories: {
                  documentation: 18,
                  instructionClarity: 17,
                  workflowAutomation: 16,
                  riskCompliance: 17,
                  integrationStructure: 17,
                  fileSizeOptimization: 16
                },
                findings: ['Good documentation', 'Clear instructions'],
                recommendations: ['Add more tests', 'Improve error handling']
              })
            }
          }]
        })
      }
    }
  }))
})

describe('generateAIAssessment', () => {
  const originalEnv = process.env.OPENAI_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv
  })

  test('should generate assessment with OpenAI API', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['TypeScript', 'JavaScript'],
      errorHandling: true,
      fileCount: 50,
      workflowFiles: ['ci.yml'],
      testFiles: ['test.js'],
      readmeContent: 'Test README',
      contributingContent: 'Test CONTRIBUTING',
      agentsContent: 'Test AGENTS'
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(result.readinessScore).toBe(85)
    expect(result.categories.documentation).toBe(18)
    expect(result.categories.fileSizeOptimization).toBe(16)
    expect(result.findings).toContain('Good documentation')
    expect(result.recommendations).toContain('Add more tests')
  })

  test('should fallback to deterministic assessment when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['TypeScript'],
      errorHandling: true,
      fileCount: 25,
      workflowFiles: ['ci.yml'],
      testFiles: ['test.js']
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories)).toHaveLength(6)
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  test('should handle file size analysis in fallback assessment', async () => {
    delete process.env.OPENAI_API_KEY

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: [],
      fileSizeAnalysis: {
        totalFiles: 10,
        filesBySize: {
          under1MB: 8,
          under2MB: 9,
          under10MB: 10,
          under50MB: 10,
          over50MB: 0
        },
        largeFiles: [
          {
            path: 'large-file.js',
            size: 3 * 1024 * 1024,
            sizeFormatted: '3.00 MB',
            type: 'code',
            agentImpact: {
              cursor: 'blocked',
              githubCopilot: 'blocked',
              claudeWeb: 'limited',
              claudeApi: 'supported'
            },
            recommendation: 'Consider splitting large files'
          }
        ],
        criticalFiles: [
          {
            path: 'README.md',
            size: 600 * 1024,
            sizeFormatted: '600.00 KB',
            type: 'readme',
            isOptimal: false,
            agentImpact: {
              cursor: 'problematic',
              githubCopilot: 'problematic',
              claudeWeb: 'problematic'
            },
            recommendation: 'File size exceeds optimal size'
          }
        ],
        contextConsumption: {
          instructionFiles: {
            agentsMd: null,
            readme: { size: 600 * 1024, lines: 20, estimatedTokens: 150 },
            contributing: null
          },
          totalContextFiles: 5,
          averageContextFileSize: 200 * 1024,
          contextEfficiency: 'moderate',
          recommendations: ['Optimize file sizes for better AI agent processing']
        },
        agentCompatibility: {
          cursor: 60,
          githubCopilot: 50,
          claudeWeb: 70,
          claudeApi: 80,
          overall: 65
        },
        recommendations: ['Split large files', 'Optimize README size']
      }
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(result.categories.fileSizeOptimization).toBeDefined()
    expect(result.categories.fileSizeOptimization).toBeLessThan(20) // Should be penalized for large files
    expect(result.findings).toContain('1 files exceed 2MB, limiting AI agent compatibility')
    expect(result.recommendations).toContain('Consider splitting large files or using repository-level processing tools')
  })

  test('should handle API errors gracefully', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const OpenAI = require('openai')
    const mockOpenAI = new OpenAI()
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: []
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories)).toHaveLength(6)
  })

  test('should handle malformed API responses', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const OpenAI = require('openai')
    const mockOpenAI = new OpenAI()
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: 'Invalid JSON response'
        }
      }]
    })

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: []
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.categories).toBeDefined()
  })

  test('should validate API response structure', async () => {
    process.env.OPENAI_API_KEY = 'test-key'

    const OpenAI = require('openai')
    const mockOpenAI = new OpenAI()
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            readinessScore: 150, // Invalid score
            categories: {
              documentation: 25, // Invalid score
              instructionClarity: 20,
              workflowAutomation: 20,
              riskCompliance: 20,
              integrationStructure: 20,
              fileSizeOptimization: 20
            },
            findings: 'Not an array', // Invalid type
            recommendations: ['Valid recommendation']
          })
        }
      }]
    })

    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: []
    }

    const result = await generateAIAssessment(staticAnalysis)

    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.categories).toBeDefined()
  })

  test('should handle empty static analysis', async () => {
    delete process.env.OPENAI_API_KEY

    const emptyStaticAnalysis = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: [],
      errorHandling: false,
      fileCount: 0,
      workflowFiles: [],
      testFiles: []
    }

    const result = await generateAIAssessment(emptyStaticAnalysis)

    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories)).toHaveLength(6)
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })
})