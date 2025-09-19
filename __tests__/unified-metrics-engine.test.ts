import { UnifiedMetricsEngine, DEFAULT_METRICS_CONFIG } from '../lib/unified-metrics-engine'

describe('UnifiedMetricsEngine', () => {
  let engine: UnifiedMetricsEngine

  beforeEach(() => {
    engine = new UnifiedMetricsEngine()
  })

  describe('constructor', () => {
    it('should use default configuration', () => {
      expect(engine).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customEngine = new UnifiedMetricsEngine({
        staticWeight: 0.4,
        aiWeight: 0.6,
        maxScoreVariance: 20
      })
      expect(customEngine).toBeDefined()
    })
  })

  describe('normalizeToCategoryScale', () => {
    it('should normalize values to 0-20 scale', () => {
      expect(engine.normalizeToCategoryScale(10, 20)).toBe(10)
      expect(engine.normalizeToCategoryScale(5, 10)).toBe(10)
      expect(engine.normalizeToCategoryScale(0, 20)).toBe(0)
      expect(engine.normalizeToCategoryScale(25, 20)).toBe(20)
    })
  })

  describe('normalizeToOverallScale', () => {
    it('should normalize values to 0-100 scale', () => {
      expect(engine.normalizeToOverallScale(10, 20)).toBe(50)
      expect(engine.normalizeToOverallScale(5, 10)).toBe(50)
      expect(engine.normalizeToOverallScale(0, 20)).toBe(0)
      expect(engine.normalizeToOverallScale(25, 20)).toBe(100)
    })
  })

  describe('createUnifiedMetric', () => {
    it('should create unified metric with static and AI values', () => {
      const metric = engine.createUnifiedMetric(15, 18, 80, 85)
      
      expect(metric.value).toBeGreaterThanOrEqual(0)
      expect(metric.value).toBeLessThanOrEqual(20)
      expect(metric.confidence).toBeGreaterThanOrEqual(0)
      expect(metric.confidence).toBeLessThanOrEqual(100)
      expect(metric.source).toBe('hybrid')
      expect(metric.staticValue).toBe(15)
      expect(metric.aiValue).toBe(18)
      expect(metric.variance).toBe(3)
    })

    it('should handle missing AI values', () => {
      const metric = engine.createUnifiedMetric(15, undefined, 80, 0)
      
      expect(metric.value).toBe(15)
      expect(metric.source).toBe('static')
      expect(metric.aiValue).toBe(undefined)
    })

    it('should handle zero AI values as valid scores', () => {
      const metric = engine.createUnifiedMetric(15, 0, 80, 70)
      
      // With default weights (0.3 static, 0.7 AI): 15 * 0.3 + 0 * 0.7 = 4.5 -> 5 (rounded)
      expect(metric.value).toBe(5)
      expect(metric.source).toBe('hybrid')
      expect(metric.aiValue).toBe(0)
    })
  })

  describe('calculateOverallScore', () => {
    it('should calculate weighted overall score', () => {
      const categoryScores = {
        documentation: {
          score: { 
            value: 18, 
            confidence: 85, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        instructionClarity: {
          score: { 
            value: 16, 
            confidence: 80, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        workflowAutomation: {
          score: { 
            value: 15, 
            confidence: 75, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        riskCompliance: {
          score: { 
            value: 17, 
            confidence: 85, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        integrationStructure: {
          score: { 
            value: 14, 
            confidence: 70, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        fileSizeOptimization: {
          score: { 
            value: 16, 
            confidence: 80, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const overallScore = engine.calculateOverallScore(categoryScores)
      
      expect(overallScore.value).toBeGreaterThanOrEqual(0)
      expect(overallScore.value).toBeLessThanOrEqual(100)
      expect(overallScore.confidence).toBeGreaterThanOrEqual(0)
      expect(overallScore.confidence).toBeLessThanOrEqual(100)
      expect(overallScore.source).toBe('hybrid')
    })
  })

  describe('validateMetricsConsistency', () => {
    it('should validate consistent metrics', () => {
      const staticScores = { documentation: 15, instructionClarity: 16 }
      const aiScores = { documentation: 17, instructionClarity: 18 }
      
      const validation = engine.validateMetricsConsistency(staticScores, aiScores)
      
      expect(validation.isValid).toBe(true)
      expect(validation.variances).toBeDefined()
      expect(validation.recommendations).toBeDefined()
    })

    it('should detect high variance', () => {
      const staticScores = { documentation: 5, instructionClarity: 16 }
      const aiScores = { documentation: 20, instructionClarity: 18 }
      
      const validation = engine.validateMetricsConsistency(staticScores, aiScores)
      
      expect(validation.isValid).toBe(false)
      expect(validation.variances.documentation).toBeGreaterThan(10)
    })
  })

  describe('generateStandardizedInsights', () => {
    it('should generate findings for low scores', () => {
      const categoryScores = {
        documentation: {
          score: { 
            value: 5, 
            confidence: 80, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const insights = engine.generateStandardizedInsights(categoryScores, {}, {})
      
      expect(insights.findings).toContain('documentation score is low (5/20) - needs improvement')
      expect(insights.recommendations).toContain('Focus on improving documentation through targeted enhancements')
    })

    it('should generate findings for high scores', () => {
      const categoryScores = {
        documentation: {
          score: { 
            value: 18, 
            confidence: 90, 
            source: 'hybrid' as const,
            lastUpdated: new Date(),
            metadata: { isValidated: true }
          },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const insights = engine.generateStandardizedInsights(categoryScores, {}, {})
      
      expect(insights.findings).toContain('documentation score is excellent (18/20) - well optimized')
    })
  })

  describe('createUnifiedAssessment', () => {
    it('should create complete unified assessment', () => {
      const staticAnalysis = {
        hasReadme: true,
        hasAgents: true,
        hasWorkflows: true,
        hasTests: true,
        fileCount: 25,
        languages: ['TypeScript']
      }

      const aiAnalysis = {
        categories: {
          documentation: 18,
          instructionClarity: 16,
          workflowAutomation: 17,
          riskCompliance: 15,
          integrationStructure: 19,
          fileSizeOptimization: 20
        },
        confidence: {
          documentation: 85,
          instructionClarity: 80,
          workflowAutomation: 75,
          riskCompliance: 90,
          integrationStructure: 85,
          fileSizeOptimization: 88
        }
      }

      const assessment = engine.createUnifiedAssessment(staticAnalysis, aiAnalysis)
      
      expect(assessment.overallScore).toBeDefined()
      expect(assessment.categories).toBeDefined()
      expect(assessment.validation).toBeDefined()
      expect(assessment.insights).toBeDefined()
    })
  })

  describe('DEFAULT_METRICS_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_METRICS_CONFIG.categoryScale).toBe(20)
      expect(DEFAULT_METRICS_CONFIG.overallScale).toBe(100)
      expect(DEFAULT_METRICS_CONFIG.staticWeight).toBe(0.3)
      expect(DEFAULT_METRICS_CONFIG.aiWeight).toBe(0.7)
      expect(DEFAULT_METRICS_CONFIG.maxScoreVariance).toBe(15)
      expect(DEFAULT_METRICS_CONFIG.minConfidenceThreshold).toBe(60)
    })
  })
})