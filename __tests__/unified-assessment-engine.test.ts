/**
 * @jest-environment node
 */

import { UnifiedAssessmentEngine } from '../lib/unified-assessment-engine'
import { AssessmentInput, AssessmentResult } from '../lib/unified-types'

// Mock the plugin-based orchestrator
jest.mock('../lib/plugin-based-orchestrator', () => ({
  orchestrator: {
    assess: jest.fn()
  }
}))

// Mock the plugin registry
jest.mock('../lib/plugin-registry', () => ({
  registerDefaultPlugins: jest.fn()
}))

import { orchestrator } from '../lib/plugin-based-orchestrator'
import { registerDefaultPlugins } from '../lib/plugin-registry'

describe('UnifiedAssessmentEngine', () => {
  let engine: UnifiedAssessmentEngine

  beforeEach(() => {
    engine = new UnifiedAssessmentEngine()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(engine['config']).toEqual({
        fallbackToStatic: true,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000
      })
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        fallbackToStatic: false,
        maxRetries: 1,
        retryDelay: 500,
        timeout: 15000
      }
      
      const customEngine = new UnifiedAssessmentEngine(customConfig)
      expect(customEngine['config']).toEqual(customConfig)
    })
  })

  describe('assess', () => {
    const mockResult: AssessmentResult = {
      scores: {
        overall: {
          value: 85,
          maxValue: 100,
          percentage: 85,
          confidence: 80
        },
        categoryScores: {
          documentation: {
            value: 18,
            maxValue: 20,
            percentage: 90,
            confidence: 85
          },
          instructionClarity: {
            value: 16,
            maxValue: 20,
            percentage: 80,
            confidence: 80
          },
          workflowAutomation: {
            value: 14,
            maxValue: 20,
            percentage: 70,
            confidence: 75
          },
          riskCompliance: {
            value: 12,
            maxValue: 20,
            percentage: 60,
            confidence: 70
          },
          integrationStructure: {
            value: 15,
            maxValue: 20,
            percentage: 75,
            confidence: 80
          },
          fileSizeOptimization: {
            value: 10,
            maxValue: 20,
            percentage: 50,
            confidence: 65
          }
        },
        confidenceScores: {
          overall: 80,
          staticAnalysis: 85,
          aiAssessment: 75
        }
      },
      findings: [
        {
          id: 'finding-1',
          category: 'documentation',
          severity: 'medium',
          title: 'Good documentation',
          description: 'Repository has comprehensive documentation',
          evidence: ['README.md', 'CONTRIBUTING.md'],
          impact: 'Positive impact on maintainability',
          confidence: 85
        }
      ],
      recommendations: [
        {
          id: 'rec-1',
          category: 'workflow',
          priority: 'medium',
          title: 'Improve CI/CD',
          description: 'Add automated testing and deployment',
          implementation: ['Add GitHub Actions', 'Configure automated tests'],
          impact: 'Medium impact on development workflow',
          effort: 'medium',
          timeline: '2-3 weeks'
        }
      ],
      metadata: {
        version: '1.0.0',
        analysisTime: 1000,
        staticAnalysisTime: 500,
        aiAnalysisTime: 500,
        totalAnalysisTime: 1000,
        retryCount: 0,
        fallbackUsed: false,
        errors: [],
        warnings: []
      }
    }

    it('should perform successful assessment', async () => {
      ;(orchestrator.assess as jest.Mock).mockResolvedValue(mockResult)

      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const result = await engine.assess(input)

      expect(registerDefaultPlugins).toHaveBeenCalled()
      expect(orchestrator.assess).toHaveBeenCalledWith(input)
      expect(result).toEqual({
        ...mockResult,
        metadata: {
          ...mockResult.metadata,
          duration: expect.any(Number)
        }
      })
    })

    it('should handle orchestrator errors and return fallback when configured', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const error = new Error('Orchestrator failed')
      ;(orchestrator.assess as jest.Mock).mockRejectedValue(error)

      const result = await engine.assess(input)

      expect(registerDefaultPlugins).toHaveBeenCalled()
      expect(orchestrator.assess).toHaveBeenCalledWith(input)
      expect(result.scores.overall.value).toBe(0)
      expect(result.metadata.fallbackUsed).toBe(true)
      expect(result.metadata.errors).toHaveLength(1)
    })

    it('should throw error when fallback is disabled', async () => {
      const customEngine = new UnifiedAssessmentEngine({
        fallbackToStatic: false
      })

      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const error = new Error('Orchestrator failed')
      ;(orchestrator.assess as jest.Mock).mockRejectedValue(error)

      await expect(customEngine.assess(input)).rejects.toThrow('Orchestrator failed')
    })

    it('should handle plugin registration errors gracefully', async () => {
      ;(registerDefaultPlugins as jest.Mock).mockImplementation(() => {
        throw new Error('Plugin registration failed')
      })
      ;(orchestrator.assess as jest.Mock).mockResolvedValue(mockResult)

      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const result = await engine.assess(input)

      expect(registerDefaultPlugins).toHaveBeenCalled()
      expect(orchestrator.assess).toHaveBeenCalledWith(input)
      expect(result).toEqual({
        ...mockResult,
        metadata: {
          ...mockResult.metadata,
          duration: expect.any(Number)
        }
      })
    })
  })

  describe('performStaticAnalysis', () => {
    it('should perform repository analysis', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const result = await engine['performStaticAnalysis'](input)

      expect(result.type).toBe('repository')
      expect(result.data).toHaveProperty('repository')
    })

    it('should perform website analysis', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const result = await engine['performStaticAnalysis'](input)

      expect(result.type).toBe('website')
      expect(result.data).toHaveProperty('website')
    })
  })

  describe('generateScores', () => {
    it('should generate scores from analysis result', () => {
      const analysisResult = {
        type: 'repository' as const,
        data: {
          repository: {
            hasReadme: true,
            hasContributing: true,
            hasAgents: false,
            hasLicense: true,
            hasWorkflows: true,
            hasTests: false,
            languages: ['TypeScript'],
            errorHandling: true,
            fileCount: 100,
            linesOfCode: 5000,
            repositorySizeMB: 2.5
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const scores = engine['generateScores'](analysisResult)

      expect(scores.overall).toBeDefined()
      expect(scores.categoryScores).toBeDefined()
      expect(scores.confidenceScores).toBeDefined()
    })
  })

  describe('generateFindings', () => {
    it('should generate findings from analysis result', () => {
      const analysisResult = {
        type: 'repository' as const,
        data: {
          repository: {
            hasReadme: true,
            hasContributing: true,
            hasAgents: false,
            hasLicense: true,
            hasWorkflows: true,
            hasTests: false,
            languages: ['TypeScript'],
            errorHandling: true,
            fileCount: 100,
            linesOfCode: 5000,
            repositorySizeMB: 2.5
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const findings = engine['generateFindings'](analysisResult)

      expect(Array.isArray(findings)).toBe(true)
      expect(findings.length).toBeGreaterThan(0)
    })
  })

  describe('generateRecommendations', () => {
    it('should generate recommendations from analysis result', () => {
      const analysisResult = {
        type: 'repository' as const,
        data: {
          repository: {
            hasReadme: true,
            hasContributing: true,
            hasAgents: false,
            hasLicense: true,
            hasWorkflows: true,
            hasTests: false,
            languages: ['TypeScript'],
            errorHandling: true,
            fileCount: 100,
            linesOfCode: 5000,
            repositorySizeMB: 2.5
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const recommendations = engine['generateRecommendations'](analysisResult)

      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })

  describe('generateFallbackResult', () => {
    it('should generate fallback result for repository', () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const error = new Error('Test error')
      const startTime = Date.now()

      const result = engine['generateFallbackResult'](input, error, startTime)

      expect(result.scores.overall.value).toBe(0)
      expect(result.metadata.fallbackUsed).toBe(true)
      expect(result.metadata.errors).toHaveLength(1)
      expect(result.metadata.errors[0].message).toBe('Test error')
    })

    it('should generate fallback result for website', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const error = new Error('Test error')
      const startTime = Date.now()

      const result = engine['generateFallbackResult'](input, error, startTime)

      expect(result.scores.overall.value).toBe(0)
      expect(result.metadata.fallbackUsed).toBe(true)
      expect(result.metadata.errors).toHaveLength(1)
      expect(result.metadata.errors[0].message).toBe('Test error')
    })
  })

  describe('convertToLegacyFormat', () => {
    it('should convert unified result to legacy format', () => {
      const unifiedResult: AssessmentResult = {
        scores: {
          overall: {
            value: 85,
            maxValue: 100,
            percentage: 85,
            confidence: 80
          },
          categoryScores: {
            documentation: {
              value: 18,
              maxValue: 20,
              percentage: 90,
              confidence: 85
            },
            instructionClarity: {
              value: 16,
              maxValue: 20,
              percentage: 80,
              confidence: 80
            },
            workflowAutomation: {
              value: 14,
              maxValue: 20,
              percentage: 70,
              confidence: 75
            },
            riskCompliance: {
              value: 12,
              maxValue: 20,
              percentage: 60,
              confidence: 70
            },
            integrationStructure: {
              value: 15,
              maxValue: 20,
              percentage: 75,
              confidence: 80
            },
            fileSizeOptimization: {
              value: 10,
              maxValue: 20,
              percentage: 50,
              confidence: 65
            }
          },
          confidenceScores: {
            overall: 80,
            staticAnalysis: 85,
            aiAssessment: 75
          }
        },
        findings: [
          {
            id: 'finding-1',
            category: 'documentation',
            severity: 'medium',
            title: 'Good documentation',
            description: 'Repository has comprehensive documentation',
            evidence: ['README.md'],
            impact: 'Positive impact',
            confidence: 85
          }
        ],
        recommendations: [
          {
            id: 'rec-1',
            category: 'workflow',
            priority: 'medium',
            title: 'Improve CI/CD',
            description: 'Add automated testing',
            implementation: ['Add GitHub Actions'],
            impact: 'Medium impact',
            effort: 'medium',
            timeline: '2-3 weeks'
          }
        ],
        metadata: {
          version: '1.0.0',
          analysisTime: 1000,
          staticAnalysisTime: 500,
          aiAnalysisTime: 500,
          totalAnalysisTime: 1000,
          retryCount: 0,
          fallbackUsed: false,
          errors: [],
          warnings: []
        }
      }

      const legacyResult = engine['convertToLegacyFormat'](unifiedResult)

      expect(legacyResult.readinessScore).toBe(85)
      expect(legacyResult.categories).toBeDefined()
      expect(legacyResult.findings).toBeDefined()
      expect(legacyResult.recommendations).toBeDefined()
      expect(legacyResult.staticAnalysis).toBeDefined()
    })
  })
})