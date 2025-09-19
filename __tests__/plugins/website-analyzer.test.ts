/**
 * @jest-environment node
 */

import { WebsiteAnalyzerPlugin } from '../../lib/plugins/website-analyzer'
import { AssessmentInput } from '../../lib/unified-types'

// Mock the analyzer function
jest.mock('../../lib/analyzer', () => ({
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

describe('WebsiteAnalyzerPlugin', () => {
  let plugin: WebsiteAnalyzerPlugin

  beforeEach(() => {
    plugin = new WebsiteAnalyzerPlugin()
  })

  describe('properties', () => {
    it('should have correct properties', () => {
      expect(plugin.type).toBe('website')
      expect(plugin.name).toBe('website-analyzer')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.description).toBe('Static analysis of websites for AI agent readiness')
    })
  })

  describe('analyze', () => {
    it('should analyze a valid website', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const result = await plugin.analyze(input)

      expect(result.type).toBe('website')
      expect(result.data).toHaveProperty('website')
      expect(result.data.website).toHaveProperty('url', 'https://example.com')
      expect(result.data.website).toHaveProperty('pageTitle', 'Test Website')
      expect(result.data.website).toHaveProperty('metaDescription', 'Test description')
      expect(result.data.website).toHaveProperty('hasStructuredData', true)
      expect(result.data.website).toHaveProperty('hasOpenGraph', true)
      expect(result.data.website).toHaveProperty('hasTwitterCards', false)
      expect(result.data.website).toHaveProperty('hasSitemap', true)
      expect(result.data.website).toHaveProperty('hasRobotsTxt', true)
      expect(result.data.website).toHaveProperty('contentLength', 5000)
      expect(result.data.website).toHaveProperty('technologies', ['React', 'Next.js'])
      expect(result.data.website).toHaveProperty('contactInfo', ['test@example.com'])
      expect(result.data.website).toHaveProperty('socialMediaLinks')
      expect(result.data.website).toHaveProperty('locations', ['New York, NY'])
      expect(result.data.website).toHaveProperty('agentReadinessFeatures')
      expect(result.metadata).toHaveProperty('analyzer', 'website-analyzer')
      expect(result.metadata).toHaveProperty('version', '1.0.0')
      expect(result.metadata).toHaveProperty('timestamp')
      expect(result.metadata).toHaveProperty('duration')
    })

    it('should throw error for non-website input', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Website analyzer can only handle website inputs'
      )
    })

    it('should throw error for invalid website URL', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'not-a-url'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Invalid website URL'
      )
    })

    it('should handle analysis errors', async () => {
      const { analyzeWebsite } = require('../../lib/analyzer')
      analyzeWebsite.mockRejectedValueOnce(new Error('Analysis failed'))

      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Website analysis failed: Analysis failed'
      )
    })
  })

  describe('validate', () => {
    it('should validate correct analysis result', () => {
      const result = {
        type: 'website' as const,
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
            technologies: ['React'],
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect validation errors', () => {
      const result = {
        type: 'repository' as const,
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors).toContain('Result type must be website')
    })

    it('should validate website-specific fields', () => {
      const result = {
        type: 'website' as const,
        data: {
          type: 'website' as const, // Add the type property
          website: {
            url: 'https://example.com',
            pageTitle: 'Test Website',
            metaDescription: 'Test description',
            hasStructuredData: 'invalid' as any, // Should be boolean
            hasOpenGraph: true,
            hasTwitterCards: false,
            hasSitemap: true,
            hasRobotsTxt: true,
            hasFavicon: false,
            hasManifest: false,
            hasServiceWorker: false,
            contentLength: 'invalid' as any, // Should be number
            technologies: 'invalid' as any, // Should be array
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('hasStructuredData must be a boolean')
      expect(validation.errors).toContain('contentLength must be a non-negative number')
      expect(validation.errors).toContain('technologies must be an array')
    })
  })

  describe('canHandle', () => {
    it('should handle valid website input', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      expect(plugin.canHandle(input)).toBe(true)
    })

    it('should not handle non-website input', () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })

    it('should not handle invalid website URL', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'not-a-url'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })
  })

  describe('isValidWebsiteUrl', () => {
    it('should validate correct website URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://www.example.com',
        'https://subdomain.example.com',
        'https://example.com/path',
        'https://example.com/path?query=value',
        'https://example.com/path#fragment',
        'http://example.com',
        'https://example.co.uk',
        'https://example.io',
        'https://example.org'
      ]

      validUrls.forEach(url => {
        expect(plugin['isValidWebsiteUrl'](url)).toBe(true)
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'file:///path/to/file',
        'https://github.com/user/repo', // GitHub URLs should be rejected
        'https://example.com:99999',
        'https://example.com:-1',
        'javascript:alert("test")',
        'data:text/plain,test',
        'mailto:test@example.com',
        'tel:+1234567890'
      ]

      invalidUrls.forEach(url => {
        expect(plugin['isValidWebsiteUrl'](url)).toBe(false)
      })
    })
  })
})