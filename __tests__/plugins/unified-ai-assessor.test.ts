/**
 * @jest-environment node
 */

import { UnifiedAIAssessorPlugin } from '../../lib/plugins/unified-ai-assessor'
import { AnalysisResult } from '../../lib/unified-types'

// Mock the unified AI assessment
jest.mock('../../lib/unified-ai-assessment', () => ({
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

describe('UnifiedAIAssessorPlugin', () => {
  let plugin: UnifiedAIAssessorPlugin

  beforeEach(() => {
    plugin = new UnifiedAIAssessorPlugin()
  })

  describe('properties', () => {
    it('should have correct properties', () => {
      expect(plugin.type).toBe('repository')
      expect(plugin.name).toBe('unified-ai-assessor')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.description).toBe('Unified AI assessment for repository and website analysis')
    })
  })

  describe('assess', () => {
    it('should assess repository analysis', async () => {
      const analysis: AnalysisResult = {
        type: 'repository',
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
            workflowFiles: ['ci.yml'],
            testFiles: ['test.js']
          }
        },
        metadata: {
          analyzer: 'repository-analyzer',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const result = await plugin.assess(analysis)

      expect(result.enabled).toBe(true)
      expect(result.instructionClarity).toBe(true)
      expect(result.workflowAutomation).toBe(true)
      expect(result.contextEfficiency).toBe(true)
      expect(result.riskCompliance).toBe(true)
      expect(result.overallSuccess).toBe(true)
      expect(result.reason).toBe('AI assessment completed successfully')
      expect(result.detailedAnalysis).toBeDefined()
    })

    it('should assess website analysis', async () => {
      const analysis: AnalysisResult = {
        type: 'website',
        data: {
          website: {
            url: 'https://example.com',
            pageTitle: 'Test Website',
            metaDescription: 'Test description',
            hasStructuredData: true,
            hasOpenGraph: true,
            hasTwitterCards: false,
            hasSitemap: true,
            hasRobotsTxt: true,
            hasFavicon: false,
            hasManifest: false,
            hasServiceWorker: false,
            contentLength: 5000,
            technologies: ['React', 'Next.js'],
            contactInfo: ['test@example.com'],
            socialMediaLinks: [],
            locations: ['New York, NY'],
            agentReadinessFeatures: {
              informationGathering: { score: 4, maxScore: 5, details: [], missing: [] },
              directBooking: { score: 3, maxScore: 5, details: [], missing: [] },
              faqSupport: { score: 4, maxScore: 5, details: [], missing: [] },
              taskManagement: { score: 3, maxScore: 5, details: [], missing: [] },
              personalization: { score: 4, maxScore: 5, details: [], missing: [] }
            }
          }
        },
        metadata: {
          analyzer: 'website-analyzer',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const result = await plugin.assess(analysis)

      expect(result.enabled).toBe(true)
      expect(result.instructionClarity).toBe(true)
      expect(result.workflowAutomation).toBe(true)
      expect(result.contextEfficiency).toBe(true)
      expect(result.riskCompliance).toBe(true)
      expect(result.overallSuccess).toBe(true)
      expect(result.reason).toBe('AI assessment completed successfully')
      expect(result.detailedAnalysis).toBeDefined()
    })

    it('should throw error for unsupported analysis type', async () => {
      const analysis: AnalysisResult = {
        type: 'business-type' as any,
        data: { 
          businessType: {
            businessType: 'ecommerce',
            businessTypeConfidence: 85,
            overallScore: 75,
            industrySpecificInsights: ['Good for AI agents'],
            recommendations: ['Improve structure']
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      await expect(plugin.assess(analysis)).rejects.toThrow(
        'Unified AI assessor can only handle repository or website analysis'
      )
    })

    it('should handle assessment errors', async () => {
      const { generateUnifiedAIAssessment } = require('../../lib/unified-ai-assessment')
      generateUnifiedAIAssessment.mockRejectedValueOnce(new Error('AI assessment failed'))

      const analysis: AnalysisResult = {
        type: 'repository',
        data: { 
          repository: {
            hasReadme: false,
            hasContributing: false,
            hasAgents: false,
            hasLicense: false,
            hasWorkflows: false,
            hasTests: false,
            languages: [],
            errorHandling: false,
            fileCount: 0,
            linesOfCode: 0,
            repositorySizeMB: 0,
            workflowFiles: [],
            testFiles: []
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      await expect(plugin.assess(analysis)).rejects.toThrow(
        'AI assessment failed: AI assessment failed'
      )
    })
  })

  describe('generateInsights', () => {
    it('should generate insights from assessment', () => {
      const assessment = {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true,
        reason: 'Test reason',
        detailedAnalysis: {} as any
      }

      const insights = plugin.generateInsights(assessment)

      expect(insights.keyFindings).toBeDefined()
      expect(insights.recommendations).toBeDefined()
      expect(insights.confidence).toBeDefined()
      expect(insights.riskLevel).toBeDefined()
      expect(Array.isArray(insights.keyFindings)).toBe(true)
      expect(Array.isArray(insights.recommendations)).toBe(true)
      expect(typeof insights.confidence).toBe('number')
      expect(['low', 'medium', 'high']).toContain(insights.riskLevel)
    })
  })

  // Note: AIAssessorPlugin doesn't have a validate method, only AnalyzerPlugin does

  describe('canHandle', () => {
    it('should handle repository analysis', () => {
      const analysis: AnalysisResult = {
        type: 'repository',
        data: { 
          repository: {
            hasReadme: false,
            hasContributing: false,
            hasAgents: false,
            hasLicense: false,
            hasWorkflows: false,
            hasTests: false,
            languages: [],
            errorHandling: false,
            fileCount: 0,
            linesOfCode: 0,
            repositorySizeMB: 0,
            workflowFiles: [],
            testFiles: []
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      expect(plugin.canHandle(analysis)).toBe(true)
    })

    it('should handle website analysis', () => {
      const analysis: AnalysisResult = {
        type: 'website',
        data: { 
          website: {
            url: 'https://example.com',
            hasStructuredData: true,
            hasOpenGraph: true,
            hasTwitterCards: false,
            hasSitemap: true,
            hasRobotsTxt: true,
            hasFavicon: false,
            hasManifest: false,
            hasServiceWorker: false,
            contentLength: 5000,
            technologies: ['React'],
            contactInfo: ['test@example.com'],
            socialMediaLinks: [],
            locations: ['New York'],
            agentReadinessFeatures: {
              informationGathering: { score: 4, maxScore: 5, details: [], missing: [] },
              directBooking: { score: 3, maxScore: 5, details: [], missing: [] },
              faqSupport: { score: 4, maxScore: 5, details: [], missing: [] },
              taskManagement: { score: 3, maxScore: 5, details: [], missing: [] },
              personalization: { score: 4, maxScore: 5, details: [], missing: [] }
            }
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      expect(plugin.canHandle(analysis)).toBe(true)
    })

    it('should not handle unsupported analysis types', () => {
      const analysis: AnalysisResult = {
        type: 'business-type' as any,
        data: { 
          businessType: {
            businessType: 'ecommerce',
            businessTypeConfidence: 85,
            overallScore: 75,
            industrySpecificInsights: ['Good for AI agents'],
            recommendations: ['Improve structure']
          }
        },
        metadata: {
          analyzer: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      expect(plugin.canHandle(analysis)).toBe(false)
    })
  })
})