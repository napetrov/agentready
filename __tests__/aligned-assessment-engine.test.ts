import { AlignedAssessmentEngine } from '../lib/aligned-assessment-engine'
import { StaticAnalysisResult } from '../lib/analyzer'

// Mock the dependencies
jest.mock('../lib/analyzer')
jest.mock('../lib/enhanced-ai-assessment')
jest.mock('../lib/unified-metrics-engine')
jest.mock('../lib/metrics-validator')

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
        largeFiles: [],
        criticalFiles: [],
        agentCompatibility: {
          overall: 95,
          criticalFiles: 90,
          largeFiles: 100,
          contextEfficiency: 85
        },
        contextConsumption: {
          estimatedTokens: 50000,
          contextWindowUsage: 0.3,
          efficiency: 85
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

      // Mock the unified metrics engine
      const { UnifiedMetricsEngine } = require('../lib/unified-metrics-engine')
      const mockUnifiedEngine = {
        createUnifiedAssessment: jest.fn().mockReturnValue({
          overallScore: { value: 85, confidence: 85, source: 'hybrid' },
          categories: {
            documentation: {
              score: { value: 18, confidence: 85, source: 'hybrid' },
              findings: ['Good documentation'],
              recommendations: ['Add more examples']
            }
          }
        })
      }
      UnifiedMetricsEngine.mockImplementation(() => mockUnifiedEngine)

      // Mock the metrics validator
      const { MetricsValidator } = require('../lib/metrics-validator')
      const mockValidator = {
        validateOverallAssessment: jest.fn().mockReturnValue({
          passed: true,
          alignmentScore: 90,
          issues: []
        })
      }
      MetricsValidator.mockImplementation(() => mockValidator)

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
      const mockUnifiedEngine = {
        createUnifiedAssessment: jest.fn().mockReturnValue({
          overallScore: { value: 70, confidence: 60, source: 'fallback' },
          categories: {}
        })
      }
      UnifiedMetricsEngine.mockImplementation(() => mockUnifiedEngine)

      const result = await engine.assessRepository('https://github.com/test/repo')

      expect(result).toBeDefined()
      expect(result.assessmentStatus.aiAnalysisEnabled).toBe(false)
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