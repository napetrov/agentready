/**
 * @jest-environment node
 */

import { BusinessTypeAnalyzerPlugin } from '../../lib/plugins/business-type-analyzer'
import { AssessmentInput } from '../../lib/unified-types'

// Mock the analyzer
jest.mock('../../lib/analyzer', () => ({
  analyzeWebsite: jest.fn().mockResolvedValue({
    pageTitle: 'Test Business Website',
    metaDescription: 'A test business website',
    hasStructuredData: true,
    hasOpenGraph: true,
    hasTwitterCards: false,
    hasSitemap: true,
    hasRobotsTxt: true,
    contentLength: 5000,
    technologies: ['React', 'Next.js'],
    contactInfo: ['test@example.com'],
    socialMediaLinks: ['https://twitter.com/test'],
    locations: ['New York, NY'],
    businessType: 'restaurant',
    businessTypeConfidence: 85,
    overallScore: 78,
    findings: ['Good contact information', 'Clear business description'],
    recommendations: ['Add more structured data', 'Improve social media presence']
  })
}))

describe('BusinessTypeAnalyzerPlugin', () => {
  let plugin: BusinessTypeAnalyzerPlugin

  beforeEach(() => {
    plugin = new BusinessTypeAnalyzerPlugin()
  })

  describe('properties', () => {
    it('should have correct properties', () => {
      expect(plugin.type).toBe('website')
      expect(plugin.name).toBe('business-type-analyzer')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.description).toBe('Business type analysis for website AI agent readiness')
    })
  })

  describe('analyze', () => {
    it('should analyze website for business type', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const result = await plugin.analyze(input)

      expect(result.type).toBe('website')
      expect(result.data).toHaveProperty('businessType')
      expect(result.data.businessType).toEqual({
        businessType: 'restaurant',
        businessTypeConfidence: 85,
        overallScore: 78,
        industrySpecificInsights: ['Good contact information', 'Clear business description'],
        recommendations: ['Add more structured data', 'Improve social media presence']
      })
      expect(result.metadata.analyzer).toBe('business-type-analyzer')
      expect(result.metadata.version).toBe('1.0.0')
      expect(result.metadata.timestamp).toBeInstanceOf(Date)
      expect(typeof result.metadata.duration).toBe('number')
    })

    it('should throw error for non-website input', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/user/repo'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Business type analyzer can only handle website inputs'
      )
    })

    it('should throw error for invalid URL', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'invalid-url'
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
        'Business type analysis failed: Analysis failed'
      )
    })

    it('should handle missing business type data', async () => {
      const { analyzeWebsite } = require('../../lib/analyzer')
      analyzeWebsite.mockResolvedValueOnce({
        pageTitle: 'Test Website',
        metaDescription: 'Test description',
        hasStructuredData: false,
        hasOpenGraph: false,
        hasTwitterCards: false,
        hasSitemap: false,
        hasRobotsTxt: false,
        contentLength: 1000,
        technologies: [],
        contactInfo: [],
        socialMediaLinks: [],
        locations: []
        // Missing business type data
      })

      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      const result = await plugin.analyze(input)

      expect(result.data.businessType).toEqual({
        businessType: 'unknown',
        businessTypeConfidence: 0,
        overallScore: 0,
        industrySpecificInsights: [],
        recommendations: []
      })
    })
  })

  describe('validate', () => {
    it('should validate correct analysis result', () => {
      const result = {
        type: 'website' as const,
        data: {
          businessType: {
            businessType: 'restaurant',
            businessTypeConfidence: 85,
            overallScore: 78,
            industrySpecificInsights: ['Good contact info'],
            recommendations: ['Add more data']
          }
        },
        metadata: {
          analyzer: 'business-type-analyzer',
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
        type: 'website' as const,
        data: {
          type: 'website' as const, // Add the type property
          businessType: {
            businessType: '', // Invalid: empty string
            businessTypeConfidence: 150, // Invalid: > 100
            overallScore: -10, // Invalid: < 0
            industrySpecificInsights: 'not an array' as any, // Invalid: not array
            recommendations: 'not an array' as any // Invalid: not array
          }
        },
        metadata: {
          analyzer: 'business-type-analyzer',
          version: '1.0.0',
          timestamp: new Date(),
          duration: 1000
        }
      }

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors).toContain('businessType must be a non-empty string')
      expect(validation.errors).toContain('businessTypeConfidence must be a number between 0 and 100')
      expect(validation.errors).toContain('overallScore must be a number between 0 and 100')
      expect(validation.errors).toContain('industrySpecificInsights must be an array')
      expect(validation.errors).toContain('recommendations must be an array')
    })

    it('should detect wrong analysis type', () => {
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
      expect(validation.errors).toContain('Result type must be website')
    })

    it('should detect missing business type data', () => {
      const result = {
        type: 'website' as const,
        data: { 
          type: 'website' as const,
          businessType: undefined // Missing businessType
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
      expect(validation.errors).toContain('Business type analysis data is missing or malformed')
    })
  })

  describe('isValidWebsiteUrl', () => {
    it('should validate correct website URLs', () => {
      expect(plugin.isValidWebsiteUrl('https://example.com')).toBe(true)
      expect(plugin.isValidWebsiteUrl('http://example.com')).toBe(true)
      expect(plugin.isValidWebsiteUrl('https://subdomain.example.com')).toBe(true)
      expect(plugin.isValidWebsiteUrl('https://example.com/path')).toBe(true)
      expect(plugin.isValidWebsiteUrl('https://example.com/path?query=value')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(plugin.isValidWebsiteUrl('invalid-url')).toBe(false)
      expect(plugin.isValidWebsiteUrl('ftp://example.com')).toBe(false)
      expect(plugin.isValidWebsiteUrl('example.com')).toBe(false)
      expect(plugin.isValidWebsiteUrl('')).toBe(false)
    })
  })

  describe('canHandle', () => {
    it('should handle valid website inputs', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      expect(plugin.canHandle(input)).toBe(true)
    })

    it('should not handle repository inputs', () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/user/repo'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })

    it('should not handle invalid URLs', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'invalid-url'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })
  })
})