import { UnifiedAIAssessmentEngine } from '../lib/unified-ai-assessment'

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  overallScore: 85,
                  confidence: 90,
                  categories: {
                    documentation: 80,
                    instructionClarity: 85,
                    workflowAutomation: 90,
                    riskCompliance: 75,
                    integrationStructure: 85,
                    fileSizeOptimization: 80
                  },
                  detailedAnalysis: {
                    instructionClarity: {
                      stepByStepQuality: 18,
                      commandClarity: 17,
                      environmentSetup: 16,
                      errorHandling: 19,
                      dependencySpecification: 15,
                      findings: ['Clear step-by-step instructions found'],
                      recommendations: ['Add more environment setup details'],
                      confidence: 85
                    },
                    workflowAutomation: {
                      ciCdQuality: 19,
                      testAutomation: 18,
                      buildScripts: 17,
                      deploymentAutomation: 16,
                      monitoringLogging: 15,
                      findings: ['Excellent CI/CD setup'],
                      recommendations: ['Add more monitoring'],
                      confidence: 90
                    },
                    contextEfficiency: {
                      instructionFileOptimization: 17,
                      codeDocumentation: 18,
                      apiDocumentation: 16,
                      contextWindowUsage: 19,
                      findings: ['Good context optimization'],
                      recommendations: ['Improve API docs'],
                      confidence: 85
                    },
                    riskCompliance: {
                      securityPractices: 16,
                      errorHandling: 18,
                      inputValidation: 17,
                      dependencySecurity: 15,
                      licenseCompliance: 19,
                      findings: ['Good security practices'],
                      recommendations: ['Update dependencies'],
                      confidence: 75
                    }
                  },
                  findings: ['Overall good AI agent readiness'],
                  recommendations: ['Continue improving documentation']
                })
              }
            }]
          })
        }
      }
    }))
  }
})

describe('UnifiedAIAssessmentEngine', () => {
  let engine: UnifiedAIAssessmentEngine

  beforeEach(() => {
    engine = new UnifiedAIAssessmentEngine()
  })

  describe('assessRepository', () => {
    it('should generate detailed analysis for repository', async () => {
      const staticAnalysis = {
        hasReadme: true,
        hasContributing: true,
        hasAgents: true,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['TypeScript', 'JavaScript'],
        errorHandling: true,
        fileCount: 50,
        linesOfCode: 1000,
        repositorySizeMB: 5,
        readmeContent: 'Test README',
        contributingContent: 'Test CONTRIBUTING',
        agentsContent: 'Test AGENTS',
        workflowFiles: ['ci.yml'],
        testFiles: ['test.js']
      }

      const result = await engine.assessRepository(staticAnalysis)

      expect(result.overallScore).toBe(85)
      expect(result.confidence).toBe(90)
      expect(result.categories.documentation).toBe(80)
      expect(result.detailedAnalysis).toBeDefined()
      expect(result.detailedAnalysis?.instructionClarity).toBeDefined()
      expect(result.detailedAnalysis?.instructionClarity.stepByStepQuality).toBe(18)
      expect(result.detailedAnalysis?.workflowAutomation.ciCdQuality).toBe(19)
      expect(result.detailedAnalysis?.contextEfficiency.instructionFileOptimization).toBe(17)
      expect(result.detailedAnalysis?.riskCompliance.securityPractices).toBe(16)
      expect(result.findings).toContain('Overall good AI agent readiness')
      expect(result.recommendations).toContain('Continue improving documentation')
    })
  })

  describe('assessWebsite', () => {
    it('should generate detailed analysis for website', async () => {
      const staticAnalysis = {
        hasReadme: false,
        hasContributing: false,
        hasAgents: false,
        hasLicense: false,
        hasWorkflows: false,
        hasTests: false,
        languages: [],
        errorHandling: false,
        fileCount: 0,
        websiteUrl: 'https://example.com',
        pageTitle: 'Example Website',
        metaDescription: 'Example description',
        hasStructuredData: true,
        hasOpenGraph: true,
        hasTwitterCards: false,
        hasSitemap: true,
        hasRobotsTxt: true,
        hasFavicon: true,
        contentLength: 5000,
        imageCount: 10,
        linkCount: 25,
        technologies: ['React', 'Next.js'],
        socialMediaLinks: [{ platform: 'Twitter', url: 'https://twitter.com/example' }],
        contactInfo: ['contact@example.com'],
        navigationStructure: ['Home', 'About', 'Contact']
      }

      const result = await engine.assessWebsite(staticAnalysis)

      expect(result.overallScore).toBe(85)
      expect(result.confidence).toBe(90)
      expect(result.detailedAnalysis).toBeDefined()
      expect(result.detailedAnalysis?.instructionClarity).toBeDefined()
      expect(result.detailedAnalysis?.workflowAutomation).toBeDefined()
      expect(result.detailedAnalysis?.contextEfficiency).toBeDefined()
      expect(result.detailedAnalysis?.riskCompliance).toBeDefined()
    })
  })

  describe('fallback assessment', () => {
    it('should create fallback assessment when AI fails', async () => {
      // Mock OpenAI to throw an error
      const mockOpenAI = require('openai').default
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }))

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
        linesOfCode: 100,
        repositorySizeMB: 1
      }

      const result = await engine.assessRepository(staticAnalysis)

      expect(result.overallScore).toBeGreaterThan(0)
      expect(result.confidence).toBe(60) // Lower confidence for fallback
      expect(result.metadata.success).toBe(false)
      expect(result.findings).toContain('AI assessment unavailable - using static analysis only')
    })
  })
})