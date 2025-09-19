/**
 * @jest-environment node
 */

import { PluginRegistry, registerDefaultPlugins } from '../lib/plugin-registry'
import { RepositoryAnalyzerPlugin } from '../lib/plugins/repository-analyzer'
import { WebsiteAnalyzerPlugin } from '../lib/plugins/website-analyzer'
import { BusinessTypeAnalyzerPlugin } from '../lib/plugins/business-type-analyzer'
import { UnifiedAIAssessorPlugin } from '../lib/plugins/unified-ai-assessor'

// Mock the analyzer functions
jest.mock('../lib/analyzer', () => ({
  analyzeRepository: jest.fn().mockResolvedValue({
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
      totalFiles: 150,
      filesBySize: {
        under100KB: 100,
        under500KB: 30,
        under1MB: 15,
        under5MB: 4,
        over5MB: 1
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
    }
  }),
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

// Mock the unified AI assessment
jest.mock('../lib/unified-ai-assessment', () => ({
  generateUnifiedAIAssessment: jest.fn().mockResolvedValue({
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
  })
}))

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  describe('constructor', () => {
    it('should initialize with empty analyzers and assessors', () => {
      expect(registry['analyzers']).toEqual(new Map())
      expect(registry['assessors']).toEqual(new Map())
    })
  })

  describe('registerAnalyzer', () => {
    it('should register an analyzer plugin', () => {
      const analyzer = new RepositoryAnalyzerPlugin()
      registry.registerAnalyzer(analyzer)

      expect(registry['analyzers'].has('repository')).toBe(true)
      expect(registry['analyzers'].get('repository')).toBe(analyzer)
    })

    it('should throw error for duplicate analyzer type', () => {
      const analyzer1 = new RepositoryAnalyzerPlugin()
      const analyzer2 = new RepositoryAnalyzerPlugin()
      
      registry.registerAnalyzer(analyzer1)
      
      expect(() => {
        registry.registerAnalyzer(analyzer2)
      }).toThrow('Analyzer for type repository is already registered')
    })
  })

  describe('registerAIAssessor', () => {
    it('should register an AI assessor plugin', () => {
      const assessor = new UnifiedAIAssessorPlugin()
      registry.registerAIAssessor(assessor)

      expect(registry['assessors'].has('repository')).toBe(true)
      expect(registry['assessors'].get('repository')).toBe(assessor)
    })

    it('should throw error for duplicate assessor type', () => {
      const assessor1 = new UnifiedAIAssessorPlugin()
      const assessor2 = new UnifiedAIAssessorPlugin()
      
      registry.registerAIAssessor(assessor1)
      
      expect(() => {
        registry.registerAIAssessor(assessor2)
      }).toThrow('AI Assessor for type repository is already registered')
    })
  })

  describe('getAnalyzer', () => {
    it('should return registered analyzer', () => {
      const analyzer = new RepositoryAnalyzerPlugin()
      registry.registerAnalyzer(analyzer)

      const result = registry.getAnalyzer('repository')
      expect(result).toBe(analyzer)
    })

    it('should return undefined for unregistered analyzer', () => {
      const result = registry.getAnalyzer('repository')
      expect(result).toBeUndefined()
    })
  })

  describe('getAIAssessor', () => {
    it('should return registered assessor', () => {
      const assessor = new UnifiedAIAssessorPlugin()
      registry.registerAIAssessor(assessor)

      const result = registry.getAIAssessor('repository')
      expect(result).toBe(assessor)
    })

    it('should return undefined for unregistered assessor', () => {
      const result = registry.getAIAssessor('repository')
      expect(result).toBeUndefined()
    })
  })

  describe('executeAnalysis', () => {
    it('should execute analysis with registered analyzer', async () => {
      const analyzer = new RepositoryAnalyzerPlugin()
      registry.registerAnalyzer(analyzer)

      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      const result = await registry.executeAnalysis(input)
      
      expect(result.type).toBe('repository')
      expect(result.data).toHaveProperty('repository')
      expect(result.metadata).toHaveProperty('analyzer', 'repository-analyzer')
    })

    it('should throw error for unregistered analyzer type', async () => {
      const input = {
        type: 'repository' as const,
        url: 'https://github.com/test/repo'
      }

      await expect(registry.executeAnalysis(input)).rejects.toThrow(
        'No analyzer found for type: repository'
      )
    })
  })

  describe('executeAIAssessment', () => {
    it('should execute AI assessment with registered assessor', async () => {
      const assessor = new UnifiedAIAssessorPlugin()
      registry.registerAIAssessor(assessor)

      const analysis = {
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

      const result = await registry.executeAIAssessment(analysis)
      
      expect(result.enabled).toBe(true)
      expect(result.overallSuccess).toBe(true)
    })

    it('should throw error for unregistered assessor type', async () => {
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

      await expect(registry.executeAIAssessment(analysis)).rejects.toThrow(
        'No AI Assessor found for type: repository'
      )
    })
  })

  describe('getRegisteredAnalyzers', () => {
    it('should return list of registered analyzers', () => {
      const repoAnalyzer = new RepositoryAnalyzerPlugin()
      const websiteAnalyzer = new WebsiteAnalyzerPlugin()
      
      registry.registerAnalyzer(repoAnalyzer)
      registry.registerAnalyzer(websiteAnalyzer)

      const analyzers = registry.getRegisteredAnalyzers()
      expect(analyzers).toHaveLength(2)
      expect(analyzers).toContain(repoAnalyzer)
      expect(analyzers).toContain(websiteAnalyzer)
    })
  })

  describe('getRegisteredAIAssessors', () => {
    it('should return list of registered assessors', () => {
      const assessor = new UnifiedAIAssessorPlugin()
      registry.registerAIAssessor(assessor)

      const assessors = registry.getRegisteredAIAssessors()
      expect(assessors).toHaveLength(1)
      expect(assessors).toContain(assessor)
    })
  })

  describe('clear', () => {
    it('should clear all registered plugins', () => {
      const analyzer = new RepositoryAnalyzerPlugin()
      const assessor = new UnifiedAIAssessorPlugin()
      
      registry.registerAnalyzer(analyzer)
      registry.registerAIAssessor(assessor)
      
      registry.clear()
      
      expect(registry['analyzers'].size).toBe(0)
      expect(registry['assessors'].size).toBe(0)
    })
  })
})

describe('registerDefaultPlugins', () => {
  beforeEach(() => {
    // Clear any existing registrations
    pluginRegistry.clear()
  })

  it('should register all default plugins', () => {
    registerDefaultPlugins()

    const analyzers = pluginRegistry.getRegisteredAnalyzers()
    const assessors = pluginRegistry.getRegisteredAIAssessors()

    expect(analyzers).toHaveLength(3) // repository, website, business-type
    expect(assessors).toHaveLength(1) // unified-ai-assessor

    // Check specific analyzers
    expect(pluginRegistry.getAnalyzer('repository')).toBeDefined()
    expect(pluginRegistry.getAnalyzer('website')).toBeDefined()
    expect(pluginRegistry.getAnalyzer('business-type')).toBeDefined()
    
    // Check assessor
    expect(pluginRegistry.getAIAssessor('repository')).toBeDefined()
  })

  it('should not throw error when called multiple times', () => {
    expect(() => {
      registerDefaultPlugins()
      registerDefaultPlugins()
    }).not.toThrow()
  })
})