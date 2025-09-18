import { MetricsValidator, DEFAULT_VALIDATOR_CONFIG } from '../lib/metrics-validator'

describe('MetricsValidator', () => {
  let validator: MetricsValidator

  beforeEach(() => {
    validator = new MetricsValidator()
  })

  describe('constructor', () => {
    it('should use default configuration', () => {
      expect(validator).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customValidator = new MetricsValidator({
        maxVariance: 20,
        minConfidence: 70,
        criticalVariance: 25
      })
      expect(customValidator).toBeDefined()
    })
  })

  describe('validateMetric', () => {
    it('should validate consistent metrics', () => {
      const issues = validator.validateMetric('documentation', 15, 17, 85)
      
      expect(issues).toHaveLength(0)
    })

    it('should detect high variance', () => {
      const issues = validator.validateMetric('documentation', 5, 20, 85)
      
      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('variance')
      expect(issues[0].severity).toBe('high')
      expect(issues[0].metric).toBe('documentation')
    })

    it('should detect low confidence', () => {
      const issues = validator.validateMetric('documentation', 15, 17, 30)
      
      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('confidence')
      expect(issues[0].severity).toBe('medium')
      expect(issues[0].metric).toBe('documentation')
    })

    it('should detect critical variance', () => {
      const issues = validator.validateMetric('documentation', 0, 20, 85)
      
      expect(issues).toHaveLength(1)
      expect(issues[0].type).toBe('variance')
      expect(issues[0].severity).toBe('critical')
    })
  })

  describe('validateOverallAssessment', () => {
    it('should validate well-aligned assessment', () => {
      const overallScore = {
        value: 85,
        confidence: 90,
        source: 'hybrid' as const,
        lastUpdated: new Date(),
        metadata: { isValidated: true }
      }

      const categories = {
        documentation: {
          name: 'documentation',
          score: { value: 18, confidence: 85, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        instructionClarity: {
          name: 'instructionClarity',
          score: { value: 16, confidence: 80, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const result = validator.validateOverallAssessment(overallScore, categories)
      
      expect(result.passed).toBe(true)
      expect(result.alignmentScore).toBeGreaterThan(80)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect alignment issues', () => {
      const overallScore = {
        value: 85,
        confidence: 90,
        source: 'hybrid' as const,
        lastUpdated: new Date(),
        metadata: { isValidated: true }
      }

      const categories = {
        documentation: {
          name: 'documentation',
          score: { value: 5, confidence: 30, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        },
        instructionClarity: {
          name: 'instructionClarity',
          score: { value: 20, confidence: 90, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const result = validator.validateOverallAssessment(overallScore, categories)
      
      expect(result.passed).toBe(false)
      expect(result.alignmentScore).toBeLessThan(90)
      expect(result.issues.length).toBeGreaterThan(0)
    })
  })

  describe('validateCategoryScores', () => {
    it('should validate consistent category scores', () => {
      const categories = {
        documentation: {
          name: 'documentation',
          score: { value: 18, confidence: 85, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const issues = validator.validateCategoryScores(categories)
      
      expect(issues).toHaveLength(0)
    })

    it('should detect category issues', () => {
      const categories = {
        documentation: {
          name: 'documentation',
          score: { value: 5, confidence: 30, source: 'hybrid' as const, lastUpdated: new Date(), metadata: {} },
          subMetrics: {},
          findings: [],
          recommendations: []
        }
      }

      const issues = validator.validateCategoryScores(categories)
      
      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some(issue => issue.type === 'confidence')).toBe(true)
    })
  })

  describe('validateSubMetrics', () => {
    it('should validate sub-metrics', () => {
      const subMetrics = {
        stepByStepQuality: {
          value: 4,
          confidence: 85,
          source: 'ai' as const,
          lastUpdated: new Date(),
          metadata: {}
        },
        commandClarity: {
          value: 4,
          confidence: 80,
          source: 'ai' as const,
          lastUpdated: new Date(),
          metadata: {}
        }
      }

      const issues = validator.validateSubMetrics('instructionClarity', subMetrics)
      
      expect(issues).toHaveLength(0)
    })

    it('should detect sub-metric issues', () => {
      const subMetrics = {
        stepByStepQuality: {
          value: 1,
          confidence: 30,
          source: 'ai' as const,
          lastUpdated: new Date(),
          metadata: {}
        }
      }

      const issues = validator.validateSubMetrics('instructionClarity', subMetrics)
      
      expect(issues.length).toBeGreaterThan(0)
    })
  })

  describe('DEFAULT_VALIDATOR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_VALIDATOR_CONFIG.maxVariance).toBe(15)
      expect(DEFAULT_VALIDATOR_CONFIG.minConfidence).toBe(60)
      expect(DEFAULT_VALIDATOR_CONFIG.criticalVariance).toBe(20)
      expect(DEFAULT_VALIDATOR_CONFIG.lowConfidenceThreshold).toBe(40)
    })
  })
})