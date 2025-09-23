/**
 * @jest-environment node
 */

import { RepositoryAnalyzerPlugin } from '../../lib/plugins/repository-analyzer'
import { AssessmentInput } from '../../lib/unified-types'

// Mock the analyzer function
jest.mock('../../lib/analyzer', () => ({
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
      largeFiles: [
        { path: 'large-file.txt', size: 1024 * 1024 }
      ],
      criticalFiles: [
        { path: 'critical-file.txt', size: 512 * 1024 }
      ],
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
  })
}))

describe('RepositoryAnalyzerPlugin', () => {
  let plugin: RepositoryAnalyzerPlugin

  beforeEach(() => {
    plugin = new RepositoryAnalyzerPlugin()
  })

  describe('properties', () => {
    it('should have correct properties', () => {
      expect(plugin.type).toBe('repository')
      expect(plugin.name).toBe('repository-analyzer')
      expect(plugin.version).toBe('1.0.0')
      expect(plugin.description).toBe('Static analysis of GitHub repositories for AI agent readiness')
    })
  })

  describe('analyze', () => {
    it('should analyze a valid repository', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      const result = await plugin.analyze(input)

      expect(result.type).toBe('repository')
      expect(result.data).toHaveProperty('repository')
      expect(result.data.repository).toHaveProperty('hasReadme', true)
      expect(result.data.repository).toHaveProperty('hasContributing', true)
      expect(result.data.repository).toHaveProperty('hasAgents', false)
      expect(result.data.repository).toHaveProperty('hasLicense', true)
      expect(result.data.repository).toHaveProperty('hasWorkflows', true)
      expect(result.data.repository).toHaveProperty('hasTests', false)
      expect(result.data.repository).toHaveProperty('languages', ['TypeScript', 'JavaScript'])
      expect(result.data.repository).toHaveProperty('errorHandling', true)
      expect(result.data.repository).toHaveProperty('fileCount', 150)
      expect(result.data.repository).toHaveProperty('linesOfCode', 5000)
      expect(result.data.repository).toHaveProperty('repositorySizeMB', 2.5)
      expect(result.metadata).toHaveProperty('analyzer', 'repository-analyzer')
      expect(result.metadata).toHaveProperty('version', '1.0.0')
      expect(result.metadata).toHaveProperty('timestamp')
      expect(result.metadata).toHaveProperty('duration')
    })

    it('should throw error for non-repository input', async () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Repository analyzer can only handle repository inputs'
      )
    })

    it('should throw error for invalid GitHub URL', async () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://example.com'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Invalid GitHub repository URL'
      )
    })

    it('should handle analysis errors', async () => {
      const { analyzeRepository } = require('../../lib/analyzer')
      analyzeRepository.mockRejectedValueOnce(new Error('Analysis failed'))

      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      await expect(plugin.analyze(input)).rejects.toThrow(
        'Repository analysis failed: Analysis failed'
      )
    })
  })

  describe('validate', () => {
    it('should validate correct analysis result', () => {
      const result = {
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect validation errors', () => {
      const result = {
        type: 'website' as const,
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
      expect(validation.errors).toContain('Result type must be repository')
    })

    it('should validate repository-specific fields', () => {
      const result = {
        type: 'repository' as const,
        data: {
          type: 'repository' as const, // Add the type property
          repository: {
            hasReadme: 'invalid' as any, // Should be boolean
            hasContributing: true,
            hasAgents: false,
            hasLicense: true,
            hasWorkflows: true,
            hasTests: false,
            languages: 'invalid' as any, // Should be array
            errorHandling: true,
            fileCount: 100,
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

      const validation = plugin.validate(result)

      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('hasReadme must be a boolean')
      expect(validation.errors).toContain('languages must be an array')
    })
  })

  describe('canHandle', () => {
    it('should handle valid repository input', () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://github.com/test/repo'
      }

      expect(plugin.canHandle(input)).toBe(true)
    })

    it('should not handle non-repository input', () => {
      const input: AssessmentInput = {
        type: 'website',
        url: 'https://example.com'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })

    it('should not handle invalid GitHub URL', () => {
      const input: AssessmentInput = {
        type: 'repository',
        url: 'https://example.com'
      }

      expect(plugin.canHandle(input)).toBe(false)
    })
  })

  describe('isValidGitHubUrl', () => {
    it('should validate correct GitHub URLs', () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user/repo/',
        'https://github.com/user/repo/tree/branch',
        'https://github.com/user/repo/issues',
        'https://github.com/user/repo/pull/123'
      ]

      validUrls.forEach(url => {
        expect(plugin['isValidGitHubUrl'](url)).toBe(true)
      })
    })

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'https://example.com',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'not-a-url',
        'https://github.com',
        'https://github.com/user',
        'https://github.com/user/',
        'https://github.com//repo',
        'javascript:alert("test")',
        'data:text/plain,test',
        'mailto:test@example.com',
        'tel:+1234567890'
      ]

      invalidUrls.forEach(url => {
        expect(plugin['isValidGitHubUrl'](url)).toBe(false)
      })
    })
  })
})