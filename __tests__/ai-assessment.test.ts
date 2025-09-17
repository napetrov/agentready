import { generateAIAssessment } from '../lib/ai-assessment'

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  }
})

const mockOpenAI = require('openai').default

describe('AI Assessment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should generate assessment with valid AI response', async () => {
    const mockStaticAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['JavaScript', 'TypeScript'],
      errorHandling: true,
      fileCount: 25,
      readmeContent: '# Test Project\nA well-documented project',
      contributingContent: '# Contributing\nGuidelines here',
      workflowFiles: ['ci.yml', 'deploy.yml'],
      testFiles: ['test1.js', 'test2.js']
    }

    const mockAIResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            readinessScore: 85,
            categories: {
              documentation: 18,
              instructionClarity: 16,
              workflowAutomation: 17,
              riskCompliance: 15,
              integrationStructure: 19
            },
            findings: [
              'Well-documented project with comprehensive README',
              'Good CI/CD setup with multiple workflows',
              'Comprehensive test coverage detected'
            ],
            recommendations: [
              'Add AGENTS.md for AI agent interaction guidelines',
              'Consider adding more detailed API documentation',
              'Implement automated security scanning'
            ]
          })
        }
      }]
    }

    const mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockAIResponse)
        }
      }
    }

    mockOpenAI.mockImplementation(() => mockOpenAIInstance)

    const result = await generateAIAssessment(mockStaticAnalysis)

    expect(result).toEqual({
      readinessScore: 85,
      categories: {
        documentation: 18,
        instructionClarity: 16,
        workflowAutomation: 17,
        riskCompliance: 15,
        integrationStructure: 19
      },
      findings: [
        'Well-documented project with comprehensive README',
        'Good CI/CD setup with multiple workflows',
        'Comprehensive test coverage detected'
      ],
      recommendations: [
        'Add AGENTS.md for AI agent interaction guidelines',
        'Consider adding more detailed API documentation',
        'Implement automated security scanning'
      ]
    })
  })

  test('should fallback to static analysis when AI fails', async () => {
    const mockStaticAnalysis = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 5,
      readmeContent: undefined,
      contributingContent: undefined,
      workflowFiles: [],
      testFiles: []
    }

    const mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }
    }

    mockOpenAI.mockImplementation(() => mockOpenAIInstance)

    const result = await generateAIAssessment(mockStaticAnalysis)

    // Should use fallback assessment
    expect(result.readinessScore).toBeLessThan(50) // Low score for poor static analysis
    expect(result.findings).toContain('No README.md file found')
    expect(result.recommendations).toContain('Create a comprehensive README.md with setup instructions and usage examples')
  })

  test('should handle malformed AI response', async () => {
    const mockStaticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      readmeContent: '# Test',
      contributingContent: undefined,
      workflowFiles: [],
      testFiles: []
    }

    const mockAIResponse = {
      choices: [{
        message: {
          content: 'This is not valid JSON'
        }
      }]
    }

    const mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockAIResponse)
        }
      }
    }

    mockOpenAI.mockImplementation(() => mockOpenAIInstance)

    const result = await generateAIAssessment(mockStaticAnalysis)

    // Should fallback to static analysis
    expect(result.readinessScore).toBeGreaterThan(0)
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })
})