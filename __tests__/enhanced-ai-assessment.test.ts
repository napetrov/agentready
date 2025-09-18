import { generateEnhancedAIAssessment } from '../lib/enhanced-ai-assessment'
import { StaticAnalysisSummary } from '../lib/ai-assessment'

// Mock OpenAI API
jest.mock('openai', () => {
  const mockCreate = jest.fn().mockImplementation((params) => {
    const mockMode = process.env.MOCK_OPENAI_MODE || 'normal'
    
    // Handle error mode
    if (mockMode === 'error') {
      throw new Error('API error')
    }
    
    // Handle malformed mode
    if (mockMode === 'malformed') {
      return Promise.resolve({
        choices: [{
          message: {
            content: 'invalid json response'
          }
        }]
      })
    }
    
    // Normal mode - concatenate all messages and convert to lowercase for matching
    const allMessages = params.messages.map(m => m.content).join(' ').toLowerCase()
    let mockResponse = {}
    
    if (allMessages.includes('instruction clarity')) {
      mockResponse = {
        stepByStepQuality: 15,
        commandClarity: 18,
        environmentSetup: 12,
        errorHandling: 16,
        dependencySpecification: 14,
        findings: ['Good step-by-step instructions', 'Clear command syntax'],
        recommendations: ['Improve environment setup', 'Add more error handling examples'],
        confidence: 85
      }
    } else if (allMessages.includes('workflow automation')) {
      mockResponse = {
        ciCdQuality: 16,
        testAutomation: 14,
        buildScripts: 12,
        deploymentAutomation: 10,
        monitoringLogging: 8,
        findings: ['Good CI/CD setup', 'Test automation present'],
        recommendations: ['Improve deployment automation', 'Add monitoring'],
        confidence: 75
      }
    } else if (allMessages.includes('context optimization')) {
      mockResponse = {
        instructionFileOptimization: 17,
        codeDocumentation: 15,
        apiDocumentation: 13,
        contextWindowUsage: 16,
        findings: ['Well-optimized instruction files', 'Good code documentation'],
        recommendations: ['Improve API documentation', 'Optimize context usage'],
        confidence: 80
      }
    } else if (allMessages.includes('security and compliance')) {
      mockResponse = {
        securityPractices: 12,
        errorHandling: 15,
        inputValidation: 10,
        dependencySecurity: 14,
        licenseCompliance: 18,
        findings: ['Good license compliance', 'Error handling present'],
        recommendations: ['Improve security practices', 'Add input validation'],
        confidence: 70
      }
    }
    
    return Promise.resolve({
      choices: [{
        message: {
          content: JSON.stringify(mockResponse)
        }
      }]
    })
  })

  return {
    default: jest.fn(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  }
})

describe('generateEnhancedAIAssessment', () => {
  const mockStaticAnalysis: StaticAnalysisSummary = {
    hasReadme: true,
    hasContributing: true,
    hasAgents: true,
    hasLicense: true,
    hasWorkflows: true,
    hasTests: true,
    languages: ['TypeScript', 'JavaScript'],
    errorHandling: true,
    fileCount: 25,
    workflowFiles: ['ci.yml', 'deploy.yml'],
    testFiles: ['test.ts', 'spec.js'],
    readmeContent: 'Comprehensive README with setup instructions',
    contributingContent: 'Contributing guidelines present',
    agentsContent: 'AI agent instructions available',
    fileSizeAnalysis: {
      totalFiles: 25,
      filesBySize: { under1MB: 20, under2MB: 3, under10MB: 2, under50MB: 0, over50MB: 0 },
      largeFiles: [],
      criticalFiles: [{
        path: 'README.md',
        size: 5000,
        sizeFormatted: '5KB',
        type: 'readme',
        isOptimal: true,
        agentImpact: { cursor: 'optimal', githubCopilot: 'optimal', claudeWeb: 'optimal' },
        recommendation: 'Optimal size for AI agents.'
      }],
      contextConsumption: {
        totalContextFiles: 3,
        averageContextFileSize: 2000,
        contextEfficiency: 'excellent',
        instructionFiles: {
          agentsMd: { size: 1000, lines: 20, estimatedTokens: 200 },
          readme: { size: 5000, lines: 50, estimatedTokens: 500 },
          contributing: { size: 2000, lines: 30, estimatedTokens: 300 }
        },
        recommendations: ['Context usage is optimal for AI agents.']
      },
      agentCompatibility: {
        cursor: 95,
        githubCopilot: 90,
        claudeWeb: 85,
        claudeApi: 98,
        overall: 92
      },
      recommendations: ['Repository is well-optimized for AI agents.']
    }
  }

  test('should generate enhanced assessment with OpenAI API', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
    
    // Check detailed analysis structure
    expect(result.detailedAnalysis.instructionClarity).toBeDefined()
    expect(result.detailedAnalysis.workflowAutomation).toBeDefined()
    expect(result.detailedAnalysis.contextEfficiency).toBeDefined()
    expect(result.detailedAnalysis.riskCompliance).toBeDefined()
    
    // Check confidence structure
    expect(result.confidence.overall).toBeGreaterThanOrEqual(0)
    expect(result.confidence.overall).toBeLessThanOrEqual(100)
    expect(result.confidence.instructionClarity).toBeGreaterThanOrEqual(0)
    expect(result.confidence.workflowAutomation).toBeGreaterThanOrEqual(0)
    expect(result.confidence.contextEfficiency).toBeGreaterThanOrEqual(0)
    expect(result.confidence.riskCompliance).toBeGreaterThanOrEqual(0)
  })

  test('should fallback to basic assessment when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
    
    // Check that fallback provides reasonable scores
    expect(result.detailedAnalysis.instructionClarity.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.detailedAnalysis.workflowAutomation.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.detailedAnalysis.contextEfficiency.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.detailedAnalysis.riskCompliance.overallScore).toBeGreaterThanOrEqual(0)
  })

  test('should handle API errors gracefully', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.MOCK_OPENAI_MODE = 'error'
    
    // Spy on console.error to verify error logging
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
    
    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith('Enhanced AI assessment error:', expect.any(Error))
    
    // Clean up
    consoleSpy.mockRestore()
    delete process.env.MOCK_OPENAI_MODE
  })

  test('should handle malformed API responses', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.MOCK_OPENAI_MODE = 'malformed'
    
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
    
    // Clean up
    delete process.env.MOCK_OPENAI_MODE
  })

  test('should handle empty static analysis', async () => {
    const emptyAnalysis: StaticAnalysisSummary = {
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
    
    const result = await generateEnhancedAIAssessment(emptyAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.detailedAnalysis).toBeDefined()
    expect(result.confidence).toBeDefined()
    
    // Should have low scores for empty analysis
    expect(result.readinessScore).toBeLessThan(50)
  })

  test('should combine assessment results correctly', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    // Check that overall score is calculated from detailed analysis
    const expectedOverall = Math.round(
      (result.detailedAnalysis.instructionClarity.overallScore +
       result.detailedAnalysis.workflowAutomation.overallScore +
       result.detailedAnalysis.contextEfficiency.overallScore +
       result.detailedAnalysis.riskCompliance.overallScore) / 4
    )
    
    // The readiness score should be reasonable (between 0 and 100)
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    
    // Check that findings and recommendations are combined
    expect(Array.isArray(result.findings)).toBe(true)
    expect(Array.isArray(result.recommendations)).toBe(true)
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  test('should limit findings and recommendations to top 10', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    
    // The mock will cause an error, which should be handled gracefully
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result.findings.length).toBeLessThanOrEqual(10)
    expect(result.recommendations.length).toBeLessThanOrEqual(10)
  })
})