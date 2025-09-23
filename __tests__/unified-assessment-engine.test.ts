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
        enableAIAssessment: true,
        enableValidation: true,
        requireAlignment: false,
        maxRetries: 2,
        fallbackToStatic: true,
        timeout: 30000,
        includeDetailedAnalysis: true,
        metricsConfig: {
          scoringScale: 100,
          categoryWeights: {
            documentation: 0.2,
            instructionClarity: 0.2,
            workflowAutomation: 0.2,
            riskCompliance: 0.2,
            integrationStructure: 0.1,
            fileSizeOptimization: 0.1
          },
          confidenceThresholds: {
            low: 0.4,
            medium: 0.6,
            high: 0.8
          },
          validationRules: []
        }
      })
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        fallbackToStatic: false,
        maxRetries: 1,
        timeout: 15000
      }
      
      const customEngine = new UnifiedAssessmentEngine(customConfig)
      expect(customEngine['config']).toMatchObject(customConfig)
    })
  })

  describe('assess', () => {
    const mockResult: AssessmentResult = {
      id: 'test-assessment',
      type: 'repository',
      url: 'https://github.com/test/repo',
      timestamp: new Date(),
      analysis: {
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
          repositorySizeMB: 2.5,
          workflowFiles: ['ci.yml'],
          testFiles: ['test.js']
        }
      },
      scores: {
        overall: {
          value: 85,
          maxValue: 100,
          percentage: 85,
          confidence: 80
        },
        categories: {
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
        confidence: {
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

      expect(result).toHaveProperty('repository')
      expect(result.repository).toBeDefined()
    })

    it('should perform website analysis', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const result = await engine['performStaticAnalysis'](input)

      expect(result).toHaveProperty('website')
      expect(result.website).toBeDefined()
    })
  })

  describe('generateScores', () => {
    it('should generate scores from analysis result', () => {
      const analysisData = {
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
          repositorySizeMB: 2.5,
          workflowFiles: ['ci.yml'],
          testFiles: ['test.js']
        }
      }

      const scores = engine['generateScores'](analysisData)

      expect(scores.overall).toBeDefined()
      expect(scores.categories).toBeDefined()
      expect(scores.confidence).toBeDefined()
    })
  })

  describe('generateFindings', () => {
    it('should generate findings from analysis result', () => {
      const analysisData = {
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
          repositorySizeMB: 2.5,
          workflowFiles: ['ci.yml'],
          testFiles: ['test.js']
        }
      }

      const findings = engine['generateFindings'](analysisData)

      expect(Array.isArray(findings)).toBe(true)
      expect(findings.length).toBeGreaterThan(0)
    })
  })

  describe('generateRecommendations', () => {
    it('should generate recommendations from analysis result', () => {
      const analysisData = {
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
          repositorySizeMB: 2.5,
          workflowFiles: ['ci.yml'],
          testFiles: ['test.js']
        }
      }

      const recommendations = engine['generateRecommendations'](analysisData)

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
        id: 'test-assessment',
        type: 'repository',
        url: 'https://github.com/test/repo',
        timestamp: new Date(),
        analysis: {
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
            repositorySizeMB: 2.5,
            workflowFiles: ['ci.yml'],
            testFiles: ['test.js']
          }
        },
        scores: {
          overall: {
            value: 85,
            maxValue: 100,
            percentage: 85,
            confidence: 80
          },
          categories: {
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
          confidence: {
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