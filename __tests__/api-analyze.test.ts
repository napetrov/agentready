import { POST } from '../app/api/analyze/route'

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    url: string
    method: string
    headers: Map<string, string>
    body: string

    constructor(input: string, init?: any) {
      this.url = input
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body || ''
    }
    
    async json() {
      return JSON.parse(this.body)
    }
  },
  NextResponse: {
    json: (data: any, init?: any) => {
      const response = new Response(JSON.stringify(data), {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers }
      })
      return response
    }
  }
}))

import { NextRequest } from 'next/server'

// Mock the analyzer and assessment engines
jest.mock('../lib/analyzer', () => ({
  analyzeRepository: jest.fn(),
  analyzeWebsite: jest.fn()
}))

jest.mock('../lib/unified-assessment-engine', () => ({
  UnifiedAssessmentEngine: jest.fn().mockImplementation(() => ({
    assess: jest.fn(),
    convertToLegacyFormat: jest.fn()
  }))
}))

import { analyzeRepository, analyzeWebsite } from '../lib/analyzer'
import { UnifiedAssessmentEngine } from '../lib/unified-assessment-engine'

const mockAnalyzeRepository = analyzeRepository as jest.MockedFunction<typeof analyzeRepository>
const mockAnalyzeWebsite = analyzeWebsite as jest.MockedFunction<typeof analyzeWebsite>
const MockUnifiedAssessmentEngine = UnifiedAssessmentEngine as jest.MockedClass<typeof UnifiedAssessmentEngine>

describe('/api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Repository Analysis', () => {
    it('successfully analyzes a repository', async () => {
      const mockStaticAnalysis = {
        hasReadme: true,
        hasContributing: true,
        hasAgents: true,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['JavaScript', 'TypeScript'],
        errorHandling: true,
        fileCount: 25,
        linesOfCode: 1000,
        repositorySizeMB: 5.2,
        readmeContent: 'Test README content',
        contributingContent: 'Test CONTRIBUTING content',
        agentsContent: 'Test AGENTS content',
        workflowFiles: ['ci.yml'],
        testFiles: ['test.js']
      }

      const mockAssessment = {
        scores: {
          overall: { value: 85, confidence: 0.9 },
          categories: {
            documentation: { value: 18 },
            instructionClarity: { value: 16 },
            workflowAutomation: { value: 14 },
            riskCompliance: { value: 12 },
            integrationStructure: { value: 15 },
            fileSizeOptimization: { value: 10 }
          },
          confidence: {
            overall: 0.9,
            staticAnalysis: 0.8,
            aiAssessment: 0.9
          }
        },
        findings: [{ id: '1', category: 'documentation', severity: 'medium', title: 'Good documentation', description: 'Good documentation structure', evidence: [], impact: 'Positive', confidence: 0.9 }],
        recommendations: [{ id: '1', category: 'testing', priority: 'medium', title: 'Add more tests', description: 'Add more tests', implementation: [], impact: 'Improves quality', effort: 'medium', timeline: '1 week' }],
        analysis: {
          repository: mockStaticAnalysis
        }
      }

      const mockLegacyResult = {
        readinessScore: 85,
        categories: {
          documentation: 18,
          instructionClarity: 16,
          workflowAutomation: 14,
          riskCompliance: 12,
          integrationStructure: 15,
          fileSizeOptimization: 10
        },
        findings: ['Good documentation structure'],
        recommendations: ['Add more tests'],
        staticAnalysis: mockStaticAnalysis
      }

      mockAnalyzeRepository.mockResolvedValue(mockStaticAnalysis as any)
      
      const mockInstance = {
        assess: jest.fn().mockResolvedValue(mockAssessment),
        convertToLegacyFormat: jest.fn().mockReturnValue(mockLegacyResult)
      }
      MockUnifiedAssessmentEngine.mockImplementation(() => mockInstance as any)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.readinessScore).toBe(85)
      expect(data.staticAnalysis).toEqual(mockStaticAnalysis)
      expect(data.categories).toEqual(mockLegacyResult.categories)
      expect(data.findings).toEqual(mockLegacyResult.findings)
      expect(mockInstance.assess).toHaveBeenCalledWith({
        url: 'https://github.com/user/repo',
        type: 'repository',
        options: expect.any(Object)
      })
    })

    it('handles repository analysis errors', async () => {
      mockAnalyzeRepository.mockRejectedValue(new Error('Repository not found'))
      
      const mockInstance = {
        assess: jest.fn().mockImplementation(async () => {
          // Simulate the unified engine's error handling by returning a fallback result
          return {
            id: 'fallback-id',
            type: 'repository' as const,
            url: 'https://github.com/user/repo',
            timestamp: new Date(),
            scores: {
              overall: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
              categories: {
                documentation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                instructionClarity: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                workflowAutomation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                riskCompliance: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                integrationStructure: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                fileSizeOptimization: { value: 0, maxValue: 100, percentage: 0, confidence: 0 }
              },
              confidence: {
                overall: 0,
                staticAnalysis: 0,
                aiAssessment: 0
              }
            },
            analysis: {},
            findings: [],
            recommendations: [],
            metadata: {
              version: '1.0.0',
              analysisTime: 0,
              staticAnalysisTime: 0,
              totalAnalysisTime: 0,
              retryCount: 0,
              fallbackUsed: true,
              errors: [],
              warnings: []
            }
          }
        }),
        convertToLegacyFormat: jest.fn().mockReturnValue({
          readinessScore: 0,
          categories: {
            documentation: 0,
            instructionClarity: 0,
            workflowAutomation: 0,
            riskCompliance: 0,
            integrationStructure: 0,
            fileSizeOptimization: 0
          },
          findings: [],
          recommendations: [],
          staticAnalysis: {}
        })
      }
      MockUnifiedAssessmentEngine.mockImplementation(() => mockInstance as any)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Unified engine returns fallback result
      expect(data.readinessScore).toBe(0) // Fallback result has 0 score
    })
  })

  describe('Website Analysis', () => {
    it('successfully analyzes a website', async () => {
      const mockWebsiteAnalysis = {
        websiteUrl: 'https://example.com',
        pageTitle: 'Example Website',
        metaDescription: 'A sample website',
        hasStructuredData: true,
        hasOpenGraph: true,
        hasTwitterCards: false,
        hasSitemap: true,
        hasRobotsTxt: true,
        contentLength: 5000,
        technologies: ['React', 'Next.js'],
        contactInfo: ['contact@example.com', '+1-555-0123'],
        socialMediaLinks: [{ platform: 'twitter', url: 'https://twitter.com/example' }],
        locations: ['New York, NY', 'San Francisco, CA'],
        businessType: 'food_service',
        businessTypeConfidence: 85,
        overallScore: 75,
        findings: ['Good structured data', 'Needs better contact info'],
        recommendations: ['Add more structured data', 'Improve mobile experience']
      }

      const mockAssessment = {
        scores: {
          overall: { value: 75, confidence: 0.8 },
          categories: {
            documentation: { value: 15 },
            instructionClarity: { value: 14 },
            workflowAutomation: { value: 13 },
            riskCompliance: { value: 16 },
            integrationStructure: { value: 12 },
            fileSizeOptimization: { value: 5 }
          },
          confidence: {
            overall: 0.8,
            staticAnalysis: 0.7,
            aiAssessment: 0.8,
            businessTypeAnalysis: 0.85
          }
        },
        findings: [{ id: '1', category: 'structuredData', severity: 'medium', title: 'Good structured data', description: 'Good structured data', evidence: [], impact: 'Positive', confidence: 0.8 }],
        recommendations: [{ id: '1', category: 'contactInfo', priority: 'medium', title: 'Improve contact info', description: 'Improve contact info', implementation: [], impact: 'Improves accessibility', effort: 'low', timeline: '1 day' }],
        analysis: {
          website: mockWebsiteAnalysis,
          businessType: {
            businessType: 'food_service',
            businessTypeConfidence: 85,
            overallScore: 75,
            industrySpecificInsights: ['Good for food service'],
            recommendations: ['Add more structured data']
          }
        }
      }

      const mockLegacyResult = {
        readinessScore: 75,
        categories: {
          documentation: 15,
          instructionClarity: 14,
          workflowAutomation: 13,
          riskCompliance: 16,
          integrationStructure: 12,
          fileSizeOptimization: 5
        },
        findings: ['Good structured data', 'Needs better contact info'],
        recommendations: ['Add more structured data', 'Improve mobile experience'],
        staticAnalysis: {},
        websiteAnalysis: mockWebsiteAnalysis,
        businessTypeAnalysis: {
          businessType: 'food_service',
          businessTypeConfidence: 85,
          overallScore: 75
        }
      }

      mockAnalyzeWebsite.mockResolvedValue(mockWebsiteAnalysis as any)
      
      const mockInstance = {
        assess: jest.fn().mockResolvedValue(mockAssessment),
        convertToLegacyFormat: jest.fn().mockReturnValue(mockLegacyResult)
      }
      MockUnifiedAssessmentEngine.mockImplementation(() => mockInstance as any)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://example.com',
          inputType: 'website'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.readinessScore).toBe(75)
      expect(data.websiteAnalysis).toEqual(mockWebsiteAnalysis)
      expect(data.businessTypeAnalysis).toEqual(mockLegacyResult.businessTypeAnalysis)
      expect(mockInstance.assess).toHaveBeenCalledWith({
        url: 'https://example.com',
        type: 'website',
        options: expect.any(Object)
      })
    })

    it('handles website analysis errors', async () => {
      mockAnalyzeWebsite.mockRejectedValue(new Error('Website not accessible'))
      
      const mockInstance = {
        assess: jest.fn().mockImplementation(async () => {
          // Simulate the unified engine's error handling by returning a fallback result
          return {
            id: 'fallback-id',
            type: 'website' as const,
            url: 'https://example.com',
            timestamp: new Date(),
            scores: {
              overall: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
              categories: {
                documentation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                instructionClarity: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                workflowAutomation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                riskCompliance: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                integrationStructure: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                fileSizeOptimization: { value: 0, maxValue: 100, percentage: 0, confidence: 0 }
              },
              confidence: {
                overall: 0,
                staticAnalysis: 0,
                aiAssessment: 0
              }
            },
            analysis: {},
            findings: [],
            recommendations: [],
            metadata: {
              version: '1.0.0',
              analysisTime: 0,
              staticAnalysisTime: 0,
              totalAnalysisTime: 0,
              retryCount: 0,
              fallbackUsed: true,
              errors: [],
              warnings: []
            }
          }
        }),
        convertToLegacyFormat: jest.fn().mockReturnValue({
          readinessScore: 0,
          categories: {
            documentation: 0,
            instructionClarity: 0,
            workflowAutomation: 0,
            riskCompliance: 0,
            integrationStructure: 0,
            fileSizeOptimization: 0
          },
          findings: [],
          recommendations: [],
          staticAnalysis: {}
        })
      }
      MockUnifiedAssessmentEngine.mockImplementation(() => mockInstance as any)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://example.com',
          inputType: 'website'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Unified engine returns fallback result
      expect(data.readinessScore).toBe(0) // Fallback result has 0 score
    })
  })

  describe('Input Validation', () => {
    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('URL is required')
    })

    it('validates input type', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'invalid'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid inputType. Must be either "repository" or "website"')
    })

    it('validates URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'invalid-url',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please provide a valid URL')
    })
  })

  describe('Error Handling', () => {
    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to analyze source')
    })

    it('handles assessment generation errors', async () => {
      const mockInstance = {
        assess: jest.fn().mockImplementation(async () => {
          // Simulate the unified engine's error handling by returning a fallback result
          return {
            id: 'fallback-id',
            type: 'repository' as const,
            url: 'https://github.com/user/repo',
            timestamp: new Date(),
            scores: {
              overall: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
              categories: {
                documentation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                instructionClarity: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                workflowAutomation: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                riskCompliance: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                integrationStructure: { value: 0, maxValue: 100, percentage: 0, confidence: 0 },
                fileSizeOptimization: { value: 0, maxValue: 100, percentage: 0, confidence: 0 }
              },
              confidence: {
                overall: 0,
                staticAnalysis: 0,
                aiAssessment: 0
              }
            },
            analysis: {},
            findings: [],
            recommendations: [],
            metadata: {
              version: '1.0.0',
              analysisTime: 0,
              staticAnalysisTime: 0,
              totalAnalysisTime: 0,
              retryCount: 0,
              fallbackUsed: true,
              errors: [],
              warnings: []
            }
          }
        }),
        convertToLegacyFormat: jest.fn().mockReturnValue({
          readinessScore: 0,
          categories: {
            documentation: 0,
            instructionClarity: 0,
            workflowAutomation: 0,
            riskCompliance: 0,
            integrationStructure: 0,
            fileSizeOptimization: 0
          },
          findings: [],
          recommendations: [],
          staticAnalysis: {}
        })
      }
      MockUnifiedAssessmentEngine.mockImplementation(() => mockInstance as any)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // Unified engine returns fallback result
      expect(data.readinessScore).toBe(0) // Fallback result has 0 score
    })
  })
})