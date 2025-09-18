import { AlignedAssessmentEngine } from '../lib/aligned-assessment-engine'
import { StaticAnalysisResult } from '../lib/analyzer'

// Mock the dependencies
jest.mock('../lib/analyzer')
jest.mock('../lib/enhanced-ai-assessment')
// Note: Not mocking unified-metrics-engine and metrics-validator to test actual implementation

describe('AlignedAssessmentEngine', () => {
  let engine: AlignedAssessmentEngine
  let mockStaticAnalysis: StaticAnalysisResult

  beforeEach(() => {
    engine = new AlignedAssessmentEngine({
      enableValidation: true,
      requireAlignment: false,
      maxRetries: 2,
      fallbackToStatic: true
    })

    mockStaticAnalysis = {
      hasReadme: true,
      hasAgents: true,
      hasContributing: true,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['TypeScript', 'JavaScript'],
      errorHandling: true,
      fileCount: 25,
      linesOfCode: 1000,
      repositorySizeMB: 5.2,
      workflowFiles: ['ci.yml'],
      testFiles: ['test.ts'],
      fileSizeAnalysis: {
        totalFiles: 25,
        filesBySize: {
          under100KB: 20,
          under500KB: 4,
          under1MB: 1,
          under5MB: 0,
          over5MB: 0
        },
        largeFiles: [],
        criticalFiles: [],
        agentCompatibility: {
          cursor: 95,
          githubCopilot: 90,
          claudeWeb: 100,
          claudeApi: 85,
          overall: 95
        },
        contextConsumption: {
          instructionFiles: {
            agentsMd: { size: 1000, lines: 50, estimatedTokens: 500 },
            readme: { size: 2000, lines: 100, estimatedTokens: 1000 },
            contributing: { size: 500, lines: 25, estimatedTokens: 250 }
          },
          totalContextFiles: 3,
          averageContextFileSize: 1167,
          contextEfficiency: 'excellent' as const,
          recommendations: []
        },
        recommendations: []
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('assessRepository', () => {
    it('should perform complete aligned assessment', async () => {
      // Mock the static analysis
      const { analyzeRepository } = require('../lib/analyzer')
      analyzeRepository.mockResolvedValue(mockStaticAnalysis)

      // Mock the AI assessment
      const { generateEnhancedAIAssessment } = require('../lib/enhanced-ai-assessment')
      generateEnhancedAIAssessment.mockResolvedValue({
        readinessScore: 85,
        categories: {
          documentation: 18,
          instructionClarity: 16,
          workflowAutomation: 17,
          riskCompliance: 15,
          integrationStructure: 19,
          fileSizeOptimization: 20
        },
        findings: ['Good documentation'],
        recommendations: ['Add more examples'],
        detailedAnalysis: {
          instructionClarity: {
            stepByStepQuality: 4,
            commandClarity: 4,
            environmentSetup: 3,
            errorHandling: 4,
            dependencySpecification: 3
          }
        },
        confidence: {
          overall: 85,
          instructionClarity: 85,
          workflowAutomation: 80,
          contextEfficiency: 90,
          riskCompliance: 75
        }
      })

      // Using actual implementation - no mocking needed

      const result = await engine.assessRepository('https://github.com/test/repo')

      expect(result).toBeDefined()
      expect(result.overallScore).toBeDefined()
      expect(result.categories).toBeDefined()
      expect(result.validation).toBeDefined()
      expect(result.assessmentStatus).toBeDefined()
    })

    it('should handle static analysis errors gracefully', async () => {
      const { analyzeRepository } = require('../lib/analyzer')
      analyzeRepository.mockRejectedValue(new Error('Repository not found'))

      await expect(engine.assessRepository('https://github.com/invalid/repo'))
        .rejects.toThrow('Repository not found')
    })

    it('should handle AI analysis failures with fallback', async () => {
      const { analyzeRepository } = require('../lib/analyzer')
      analyzeRepository.mockResolvedValue(mockStaticAnalysis)

      const { generateEnhancedAIAssessment } = require('../lib/enhanced-ai-assessment')
      generateEnhancedAIAssessment.mockRejectedValue(new Error('AI analysis failed'))

      // Mock the unified metrics engine to handle fallback
      const { UnifiedMetricsEngine } = require('../lib/unified-metrics-engine')
      // Using actual implementation - no mocking needed

      const result = await engine.assessRepository('https://github.com/test/repo')

      expect(result).toBeDefined()
      expect(result.assessmentStatus.aiAnalysisEnabled).toBe(true) // AI was attempted but failed
    })
  })

  describe('assessWebsite', () => {
    it('should perform website assessment', async () => {
      const { analyzeWebsite } = require('../lib/analyzer')
      analyzeWebsite.mockResolvedValue({
        websiteUrl: 'https://example.com',
        pageTitle: 'Test Site',
        metaDescription: 'Test description',
        agenticFlows: {
          informationGathering: { score: 15 },
          directBooking: { score: 12 },
          faqSupport: { score: 18 },
          taskManagement: { score: 10 },
          personalization: { score: 14 }
        }
      })

      const { generateWebsiteAIAssessment } = require('../lib/enhanced-ai-assessment')
      generateWebsiteAIAssessment.mockResolvedValue({
        readinessScore: 80,
        categories: {
          documentation: 16,
          instructionClarity: 15,
          workflowAutomation: 14,
          riskCompliance: 17,
          integrationStructure: 18,
          fileSizeOptimization: 16
        },
        findings: ['Good website structure'],
        recommendations: ['Improve mobile experience'],
        confidence: { overall: 80 }
      })

      const result = await engine.assessWebsite('https://example.com')

      expect(result).toBeDefined()
      expect(result.overallScore).toBeDefined()
      expect(result.categories).toBeDefined()
    })
  })

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const customEngine = new AlignedAssessmentEngine({
        enableValidation: false,
        requireAlignment: true,
        maxRetries: 5,
        fallbackToStatic: false
      })

      expect(customEngine).toBeDefined()
    })
  })
})