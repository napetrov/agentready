import { POST } from '../app/api/report/route'
import { NextRequest } from 'next/server'

// Mock the report generator
jest.mock('../lib/report-generator', () => ({
  generatePDFReport: jest.fn()
}))

import { generatePDFReport } from '../lib/report-generator'

const mockGeneratePDFReport = generatePDFReport as jest.MockedFunction<typeof generatePDFReport>

describe('/api/report', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('successfully generates a PDF report', async () => {
    const mockResult = {
      readinessScore: 85,
      categories: {
        documentation: 18,
        instructionClarity: 16,
        workflowAutomation: 14,
        riskCompliance: 12,
        integrationStructure: 15,
        fileSizeOptimization: 10
      },
      findings: ['Good documentation', 'Needs better CI/CD'],
      recommendations: ['Add more tests', 'Improve error handling'],
      staticAnalysis: {
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
        fileSizeAnalysis: {
          totalFiles: 150,
          filesBySize: {
            under100KB: 120,
            under500KB: 25,
            under1MB: 5,
            under5MB: 0,
            over5MB: 0
          },
          largeFiles: [],
          criticalFiles: [],
          contextConsumption: {
            instructionFiles: {
              agentsMd: null,
              readme: { size: 1024, lines: 50, estimatedTokens: 256 },
              contributing: { size: 512, lines: 25, estimatedTokens: 128 }
            },
            totalContextFiles: 2,
            averageContextFileSize: 768,
            contextEfficiency: 'excellent',
            recommendations: []
          },
          agentCompatibility: {
            cursor: 90,
            githubCopilot: 85,
            claudeWeb: 88,
            claudeApi: 92,
            overall: 89
          },
          recommendations: []
        }
      }
    }

    const mockPdfBuffer = Buffer.from('mock-pdf-content')
    mockGeneratePDFReport.mockResolvedValue(mockPdfBuffer)

    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        result: mockResult,
        repoUrl: 'https://github.com/user/repo'
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('ai-readiness-assessment')
    
    const responseBuffer = Buffer.from(await response.arrayBuffer())
    expect(responseBuffer).toEqual(mockPdfBuffer)
    expect(mockGeneratePDFReport).toHaveBeenCalledWith(mockResult, 'https://github.com/user/repo')
  })

  it('handles website analysis report generation', async () => {
    const mockResult = {
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
      staticAnalysis: {
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
        socialMediaLinks: [
          { platform: 'Twitter', url: 'https://twitter.com/example' }
        ],
        locations: ['New York, NY', 'San Francisco, CA']
      },
      businessTypeAnalysis: {
        businessType: 'food_service',
        businessTypeConfidence: 85,
        overallScore: 75,
        agenticFlows: {
          informationGathering: {
            score: 80,
            details: {
              hasServiceProductInfo: true,
              hasPricing: true,
              hasAvailability: false,
              hasContactInfo: true,
              hasLocation: true,
              hasReviews: false,
              hasPolicies: true,
              hasDifferentiators: false
            }
          },
          directBooking: {
            score: 70,
            details: {
              hasActionableInstructions: true,
              hasBookingRequirements: true,
              hasConfirmationProcess: false,
              hasPaymentOptions: true,
              hasModificationPolicies: false,
              hasErrorHandling: true
            }
          },
          faqSupport: {
            score: 60,
            details: {
              hasFaq: true,
              hasPolicyDocumentation: true,
              hasUserGuides: false,
              hasEligibilityCriteria: false,
              hasSupportContact: true,
              hasSearchFunctionality: false
            }
          },
          taskManagement: {
            score: 50,
            details: {
              hasScheduleVisibility: false,
              hasReservationManagement: false,
              hasTaskTracking: false,
              hasReschedulingProcess: false,
              hasMembershipDetails: false,
              hasNotificationSystems: false
            }
          },
          personalization: {
            score: 40,
            details: {
              hasPersonalizationData: false,
              hasRecommendationLogic: false,
              hasContextAwareness: false,
              hasUserProfiling: false,
              hasDynamicContent: false
            }
          }
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
        findings: ['Good structured data', 'Needs better contact info'],
        recommendations: ['Add more structured data', 'Improve mobile experience']
      }
    }

    const mockPdfBuffer = Buffer.from('mock-website-pdf-content')
    mockGeneratePDFReport.mockResolvedValue(mockPdfBuffer)

    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        result: mockResult,
        repoUrl: 'https://example.com'
      })
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('ai-readiness-assessment')
    
    const responseBuffer = Buffer.from(await response.arrayBuffer())
    expect(responseBuffer).toEqual(mockPdfBuffer)
    expect(mockGeneratePDFReport).toHaveBeenCalledWith(mockResult, 'https://example.com')
  })

  it('handles report generation errors', async () => {
    const mockResult = {
      readinessScore: 85,
      categories: { documentation: 18 },
      findings: ['Good documentation'],
      recommendations: ['Add more tests'],
      staticAnalysis: { hasReadme: true, fileCount: 150 }
    }

    mockGeneratePDFReport.mockRejectedValue(new Error('PDF generation failed'))

    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        result: mockResult,
        repoUrl: 'https://github.com/user/repo'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to generate report')
  })

  it('validates required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({})
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Assessment result is required')
  })

  it('handles malformed JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: 'invalid json'
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to generate report')
  })

  it('handles missing result data', async () => {
    const request = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        repoUrl: 'https://github.com/user/repo'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Assessment result is required')
  })
})