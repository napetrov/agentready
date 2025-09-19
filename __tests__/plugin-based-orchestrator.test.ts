/**
 * @jest-environment node
 */

import { PluginBasedOrchestrator } from '../lib/plugin-based-orchestrator'
import { pluginRegistry } from '../lib/plugin-registry'
import { registerDefaultPlugins } from '../lib/plugin-registry'

// Mock the plugin registry
jest.mock('../lib/plugin-registry', () => {
  const mockRegistry = {
    executeAnalysis: jest.fn(),
    executeAIAssessment: jest.fn(),
    getAnalyzer: jest.fn(),
    getAIAssessor: jest.fn(),
    registerAnalyzer: jest.fn(),
    registerAIAssessor: jest.fn(),
    getRegisteredAnalyzers: jest.fn().mockReturnValue([]),
    getRegisteredAIAssessors: jest.fn().mockReturnValue([]),
    clear: jest.fn()
  }
  
  return {
    pluginRegistry: mockRegistry,
    registerDefaultPlugins: jest.fn()
  }
})

// Mock the analyzer functions
jest.mock('../lib/analyzer', () => ({
  analyzeWebsite: jest.fn().mockResolvedValue({
    pageTitle: 'Test Website',
    metaDescription: 'Test description',
    hasStructuredData: true,
    hasOpenGraph: true,
    hasTwitterCards: false,
    hasSitemap: true,
    hasRobotsTxt: true,
    contentLength: 5000,
    technologies: ['React', 'Next.js'],
    contactInfo: ['test@example.com'],
    socialMediaLinks: [{ platform: 'twitter', url: 'https://twitter.com/test' }],
    locations: ['New York, NY'],
    businessType: 'ecommerce',
    businessTypeConfidence: 85,
    overallScore: 75,
    agenticFlows: {
      informationGathering: { score: 4, confidence: 80 },
      directBooking: { score: 3, confidence: 70 },
      faqSupport: { score: 4, confidence: 85 },
      taskManagement: { score: 3, confidence: 75 },
      personalization: { score: 4, confidence: 80 }
    },
    aiRelevantChecks: {
      hasStructuredData: true,
      hasContactInfo: true,
      hasPageTitle: true,
      hasMetaDescription: true,
      hasSitemap: true,
      hasRobotsTxt: true,
      contentAccessibility: 75
    },
    findings: ['Good structured data'],
    recommendations: ['Improve mobile experience']
  })
}))

// Mock the file size analyzer
jest.mock('../lib/file-size-analyzer', () => ({
  FileSizeAnalyzer: {
    analyzeFileSizes: jest.fn().mockResolvedValue({
      totalFiles: 100,
      filesBySize: {
        under100KB: 80,
        under500KB: 15,
        under1MB: 4,
        under5MB: 1,
        over5MB: 0
      },
      largeFiles: [],
      criticalFiles: [],
      contextConsumption: {
        totalTokens: 1000,
        averageTokensPerFile: 10,
        contextEfficiency: 0.8
      },
      agentCompatibility: {
        cursor: 85,
        githubCopilot: 90,
        claudeWeb: 80,
        claudeApi: 75,
        overall: 82
      },
      recommendations: ['Optimize file sizes']
    })
  }
}))

describe('PluginBasedOrchestrator', () => {
  let orchestrator: PluginBasedOrchestrator

  beforeEach(() => {
    orchestrator = new PluginBasedOrchestrator()
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(orchestrator['config']).toEqual({
        enableBusinessTypeAnalysis: true,
        enableFileSizeAnalysis: true,
        enableCaching: true,
        maxRetries: 3,
        retryDelay: 1000
      })
    })

    it('should accept custom configuration', () => {
      const customConfig = {
        enableBusinessTypeAnalysis: false,
        enableFileSizeAnalysis: false,
        enableCaching: false,
        maxRetries: 1,
        retryDelay: 500
      }
      
      const customOrchestrator = new PluginBasedOrchestrator(undefined, customConfig)
      expect(customOrchestrator['config']).toEqual(customConfig)
    })
  })

  describe('assess', () => {
    const mockAnalysisResult = {
      type: 'repository' as const,
      data: {
        repository: {
          hasReadme: true,
          hasContributing: true,
          hasAgents: false,
          hasLicense: true,
          hasWorkflows: true,
          hasTests: false,
          languages: ['TypeScript', 'JavaScript'],
          errorHandling: true,
          fileCount: 150,
          linesOfCode: 5000,
          repositorySizeMB: 2.5,
          readmeContent: 'Test README',
          contributingContent: 'Test CONTRIBUTING',
          agentsContent: undefined,
          workflowFiles: ['test.yml'],
          testFiles: ['test.js'],
          fileSizeAnalysis: {
            totalSizeMB: 2.5,
            largeFiles: [],
            criticalFiles: [],
            agentCompatibility: {
              cursor: { score: 85, status: 'compliant' as const, issues: [] },
              githubCopilot: { score: 90, status: 'compliant' as const, issues: [] },
              claudeWeb: { score: 80, status: 'compliant' as const, issues: [] },
              claudeAPI: { score: 75, status: 'warning' as const, issues: [] },
              chatgpt: { score: 75, status: 'warning' as const, issues: [] },
              overall: { score: 82, status: 'compliant' as const, issues: [] }
            },
            recommendations: ['Optimize file sizes']
          }
        }
      },
      metadata: {
        analyzer: 'repository-analyzer',
        version: '1.0.0',
        timestamp: new Date(),
        duration: 1000
      }
    }

    const mockAIAssessment = {
      enabled: true,
      instructionClarity: true,
      workflowAutomation: true,
      contextEfficiency: true,
      riskCompliance: true,
      overallSuccess: true,
      reason: 'AI assessment completed successfully',
      detailedAnalysis: {
        instructionClarity: {
          stepByStepQuality: 4,
          commandClarity: 4,
          environmentSetup: 3,
          errorHandling: 4,
          dependencySpecification: 3,
          findings: ['Instructions are clear'],
          recommendations: ['Add more examples'],
          confidence: 85
        },
        workflowAutomation: {
          ciCdQuality: 4,
          testAutomation: 4,
          buildScripts: 3,
          deploymentAutomation: 4,
          monitoringLogging: 3,
          findings: ['Good automation'],
          recommendations: ['Improve monitoring'],
          confidence: 80
        },
        contextEfficiency: {
          informationCohesion: 4,
          terminologyConsistency: 4,
          crossReferenceQuality: 3,
          chunkingOptimization: 4,
          findings: ['Good context'],
          recommendations: ['Improve references'],
          confidence: 75
        },
        riskCompliance: {
          securityPractices: 4,
          complianceAlignment: 4,
          safetyGuidelines: 3,
          governanceDocumentation: 4,
          findings: ['Good security'],
          recommendations: ['Improve guidelines'],
          confidence: 70
        },
        integrationStructure: {
          codeOrganization: 4,
          modularity: 4,
          apiDesign: 3,
          dependencies: 4,
          findings: ['Good structure'],
          recommendations: ['Improve API design'],
          confidence: 75
        },
        fileSizeOptimization: {
          criticalFileCompliance: 4,
          largeFileManagement: 3,
          contextWindowOptimization: 4,
          agentCompatibility: 3,
          findings: ['Good optimization'],
          recommendations: ['Improve file management'],
          confidence: 70
        }
      }
    }

    beforeEach(() => {
      ;(pluginRegistry.executeAnalysis as jest.Mock).mockResolvedValue(mockAnalysisResult)
      ;(pluginRegistry.executeAIAssessment as jest.Mock).mockResolvedValue(mockAIAssessment)
    })

    it('should perform complete assessment for repository', async () => {
      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      const result = await orchestrator.assess(input)

      expect(pluginRegistry.executeAnalysis).toHaveBeenCalledWith(input)
      expect(pluginRegistry.executeAIAssessment).toHaveBeenCalledWith(mockAnalysisResult)
      
      expect(result.scores.overall).toBeDefined()
      expect(result.scores.categories).toBeDefined()
      expect(result.scores.confidence).toBeDefined()
      expect(result.findings).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should perform complete assessment for website', async () => {
      const input = {
        type: 'website' as const,
        url: 'https://example.com'
      }

      const result = await orchestrator.assess(input)

      expect(pluginRegistry.executeAnalysis).toHaveBeenCalledWith(input)
      expect(pluginRegistry.executeAIAssessment).toHaveBeenCalledWith(mockAnalysisResult)
      
      expect(result.scores.overall).toBeDefined()
      expect(result.scores.categories).toBeDefined()
      expect(result.scores.confidence).toBeDefined()
      expect(result.findings).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(result.metadata).toBeDefined()
    })

    it('should handle analysis errors gracefully', async () => {
      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      ;(pluginRegistry.executeAnalysis as jest.Mock).mockRejectedValue(new Error('Analysis failed'))

      await expect(orchestrator.assess(input)).rejects.toThrow('Analysis failed')
    })

    it('should handle AI assessment errors gracefully', async () => {
      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      ;(pluginRegistry.executeAIAssessment as jest.Mock).mockRejectedValue(new Error('AI assessment failed'))

      await expect(orchestrator.assess(input)).rejects.toThrow('AI assessment failed')
    })

    it('should skip AI assessment when disabled', async () => {
      const customOrchestrator = new PluginBasedOrchestrator(undefined, {
        enableBusinessTypeAnalysis: false,
        enableFileSizeAnalysis: false
      })

      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      const result = await customOrchestrator.assess(input)

      expect(pluginRegistry.executeAnalysis).toHaveBeenCalledWith(input)
      expect(pluginRegistry.executeAIAssessment).not.toHaveBeenCalled()
      
      expect(result.scores.overall).toBeDefined()
      expect(result.scores.categories).toBeDefined()
      expect(result.scores.confidence).toBeDefined()
    })
  })

  describe('executeAdditionalAnalysis', () => {
    it('should execute business type analysis for websites', async () => {
      const input = {
        type: 'website' as const,
        url: 'https://example.com'
      }

      const analysis = {
        type: 'website' as const,
        data: { website: {} },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const result = await orchestrator['executeAdditionalAnalysis'](input, analysis)

      expect(result.businessTypeAnalysis).toBeDefined()
      expect(result.businessTypeAnalysis.businessType).toBe('ecommerce')
      expect(result.businessTypeAnalysis.businessTypeConfidence).toBe(85)
    })

    it('should skip business type analysis when disabled', async () => {
      const customOrchestrator = new PluginBasedOrchestrator(undefined, {
        enableBusinessTypeAnalysis: false
      })

      const input = {
        type: 'website' as const,
        url: 'https://example.com'
      }

      const analysis = {
        type: 'website' as const,
        data: { website: {} },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const result = await customOrchestrator['executeAdditionalAnalysis'](input, analysis)

      expect(result.businessTypeAnalysis).toBeUndefined()
    })

    it('should skip file size analysis when disabled', async () => {
      const customOrchestrator = new PluginBasedOrchestrator(undefined, {
        enableFileSizeAnalysis: false
      })

      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      const analysis = {
        type: 'repository' as const,
        data: { repository: {} },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const result = await customOrchestrator['executeAdditionalAnalysis'](input, analysis)

      expect(result.fileSizeAnalysis).toBeUndefined()
    })
  })

  describe('calculateOverallScore', () => {
    it('should calculate weighted overall score', () => {
      const aiAssessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test',
        detailedAnalysis: {} as any
      }

      const additionalAnalysis = {
        businessTypeAnalysis: {
          overallScore: 80
        }
      }

      const score = orchestrator['calculateOverallScore'](aiAssessment, additionalAnalysis)
      
      expect(typeof score).toBe('number')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  describe('generateCategoryScores', () => {
    it('should generate category scores', () => {
      const aiAssessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test',
        detailedAnalysis: {} as any
      }

      const additionalAnalysis = {}

      const scores = orchestrator['generateCategoryScores'](aiAssessment, additionalAnalysis)
      
      expect(scores.documentation).toBeDefined()
      expect(scores.instructionClarity).toBeDefined()
      expect(scores.workflowAutomation).toBeDefined()
      expect(scores.riskCompliance).toBeDefined()
      expect(scores.integrationStructure).toBeDefined()
      expect(scores.fileSizeOptimization).toBeDefined()
    })
  })

  describe('generateConfidenceScores', () => {
    it('should generate confidence scores', () => {
      const aiAssessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test',
        detailedAnalysis: {} as any
      }

      const additionalAnalysis = {}

      const scores = orchestrator['generateConfidenceScores'](aiAssessment, additionalAnalysis)
      
      expect(scores.overall).toBeDefined()
      expect(scores.staticAnalysis).toBeDefined()
      expect(scores.aiAssessment).toBeDefined()
    })
  })

  describe('extractFindings', () => {
    it('should extract findings from assessment', () => {
      const aiAssessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test',
        detailedAnalysis: {} as any
      }

      const additionalAnalysis = {
        businessTypeAnalysis: {
          findings: ['Test finding']
        }
      }

      const findings = orchestrator['extractFindings'](aiAssessment, additionalAnalysis)
      
      expect(Array.isArray(findings)).toBe(true)
      expect(findings.length).toBeGreaterThan(0)
    })
  })

  describe('extractRecommendations', () => {
    it('should extract recommendations from assessment', () => {
      const aiAssessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test',
        detailedAnalysis: {} as any
      }

      const additionalAnalysis = {
        businessTypeAnalysis: {
          recommendations: ['Test recommendation']
        }
      }

      const recommendations = orchestrator['extractRecommendations'](aiAssessment, additionalAnalysis)
      
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })
})