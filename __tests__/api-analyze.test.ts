import { POST } from '../app/api/analyze/route'
import { NextRequest } from 'next/server'

// Mock the analyzer and assessment engines
jest.mock('../lib/analyzer', () => ({
  analyzeRepository: jest.fn(),
  analyzeWebsite: jest.fn()
}))

jest.mock('../lib/aligned-assessment-engine', () => ({
  AlignedAssessmentEngine: jest.fn().mockImplementation(() => ({
    assessRepository: jest.fn(),
    assessWebsite: jest.fn()
  }))
}))

import { analyzeRepository, analyzeWebsite } from '../lib/analyzer'
import { AlignedAssessmentEngine } from '../lib/aligned-assessment-engine'

const mockAnalyzeRepository = analyzeRepository as jest.MockedFunction<typeof analyzeRepository>
const mockAnalyzeWebsite = analyzeWebsite as jest.MockedFunction<typeof analyzeWebsite>
const MockAlignedAssessmentEngine = AlignedAssessmentEngine as jest.MockedClass<typeof AlignedAssessmentEngine>

describe('/api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Repository Analysis', () => {
    it('successfully analyzes a repository', async () => {
      const mockStaticAnalysis = {
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

      const mockAssessment = {
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
        detailedAnalysis: {
          instructionClarity: {
            stepByStepQuality: 16,
            commandClarity: 15,
            environmentSetup: 14,
            errorHandling: 13,
            dependencySpecification: 12,
            overallScore: 14
          },
          workflowAutomation: {
            ciCdQuality: 12,
            testAutomation: 10,
            buildScripts: 14,
            deploymentAutomation: 13,
            monitoringLogging: 11,
            overallScore: 12
          },
          contextEfficiency: {
            instructionFileOptimization: 15,
            codeDocumentation: 14,
            apiDocumentation: 13,
            contextWindowUsage: 12,
            overallScore: 13
          },
          riskCompliance: {
            securityPractices: 11,
            errorHandling: 13,
            inputValidation: 12,
            dependencySecurity: 10,
            licenseCompliance: 14,
            overallScore: 12
          }
        },
        confidence: {
          overall: 85,
          instructionClarity: 80,
          workflowAutomation: 75,
          contextEfficiency: 82,
          riskCompliance: 78
        },
        aiAnalysisStatus: {
          enabled: true,
          instructionClarity: true,
          workflowAutomation: true,
          contextEfficiency: true,
          riskCompliance: true,
          overallSuccess: true
        }
      }

      const mockInstance = new MockAlignedAssessmentEngine()
      mockInstance.assessRepository = jest.fn().mockResolvedValue({
        overallScore: { value: 85, confidence: 80 },
        websiteAnalysis: null,
        assessmentStatus: {
          aiAnalysisEnabled: true
        },
        validation: {
          passed: true
        },
        staticAnalysis: mockStaticAnalysis,
        categories: {
          documentation: { 
            score: { value: 18, confidence: 85 },
            subMetrics: {
              codeDocumentation: { value: 18 }
            }
          },
          instructionClarity: { 
            score: { value: 16, confidence: 80 },
            subMetrics: {
              stepByStepQuality: { value: 16 },
              commandClarity: { value: 15 },
              environmentSetup: { value: 14 },
              errorHandling: { value: 13 },
              dependencySpecification: { value: 12 }
            }
          },
          workflowAutomation: { 
            score: { value: 14, confidence: 75 },
            subMetrics: {
              ciCdQuality: { value: 12 },
              testAutomation: { value: 10 },
              buildScripts: { value: 14 },
              deploymentAutomation: { value: 13 },
              monitoringLogging: { value: 11 }
            }
          },
          riskCompliance: { 
            score: { value: 12, confidence: 70 },
            subMetrics: {
              securityPractices: { value: 11 },
              errorHandling: { value: 13 },
              inputValidation: { value: 12 },
              dependencySecurity: { value: 10 },
              licenseCompliance: { value: 14 }
            }
          },
          integrationStructure: { 
            score: { value: 15, confidence: 78 },
            subMetrics: {
              apiDocumentation: { value: 15 }
            }
          },
          fileSizeOptimization: { 
            score: { value: 10, confidence: 65 },
            subMetrics: {
              instructionFileOptimization: { value: 15 },
              contextWindowUsage: { value: 12 }
            }
          }
        },
        insights: {
          findings: ['Good documentation', 'Needs better CI/CD'],
          recommendations: ['Add more tests', 'Improve error handling']
        },
        assessmentMetadata: {
          staticAnalysisTime: 100,
          aiAnalysisTime: 200,
          totalAnalysisTime: 300,
          retryCount: 0,
          fallbackUsed: false
        }
      })
      MockAlignedAssessmentEngine.mockImplementation(() => mockInstance)

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
      expect(data.categories).toEqual(mockAssessment.categories)
      expect(data.findings).toEqual(mockAssessment.findings)
      expect(data.recommendations).toEqual(mockAssessment.recommendations)
      expect(mockInstance.assessRepository).toHaveBeenCalledWith('https://github.com/user/repo')
    })

    it('handles repository analysis errors', async () => {
      const mockInstance = new MockAlignedAssessmentEngine()
      mockInstance.assessRepository = jest.fn().mockRejectedValue(new Error('Repository not found'))
      MockAlignedAssessmentEngine.mockImplementation(() => mockInstance)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to analyze source')
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
        hasFavicon: true,
        hasManifest: false,
        hasServiceWorker: false,
        pageLoadSpeed: 2.5,
        mobileFriendly: true,
        accessibilityScore: 85,
        seoScore: 78,
        contentLength: 5000,
        imageCount: 10,
        linkCount: 25,
        headingStructure: { h1: 1, h2: 3, h3: 5 },
        technologies: ['React', 'Next.js'],
        securityHeaders: ['X-Frame-Options', 'X-Content-Type-Options'],
        socialMediaLinks: [
          { platform: 'Twitter', url: 'https://twitter.com/example' }
        ],
        contactInfo: ['contact@example.com', '+1-555-0123'],
        navigationStructure: ['Home', 'About', 'Services', 'Contact'],
        locations: ['New York, NY', 'San Francisco, CA']
      }

      const mockAssessment = {
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
        },
        aiAnalysisStatus: {
          enabled: true,
          instructionClarity: true,
          workflowAutomation: true,
          contextEfficiency: true,
          riskCompliance: true,
          overallSuccess: true
        }
      }

      const mockInstance = new MockAlignedAssessmentEngine()
      mockInstance.assessWebsite = jest.fn().mockResolvedValue({
        overallScore: { value: 75, confidence: 75 },
        websiteAnalysis: {
          businessType: 'food_service',
          businessTypeConfidence: 85,
          overallScore: 75,
          agenticFlows: mockAssessment.businessTypeAnalysis.agenticFlows,
          aiRelevantChecks: mockAssessment.businessTypeAnalysis.aiRelevantChecks,
          findings: mockAssessment.businessTypeAnalysis.findings,
          recommendations: mockAssessment.businessTypeAnalysis.recommendations
        },
        assessmentStatus: {
          aiAnalysisEnabled: true
        },
        validation: {
          passed: true
        },
        staticAnalysis: mockWebsiteAnalysis,
        categories: {
          documentation: { 
            score: { value: 15, confidence: 70 },
            subMetrics: {
              codeDocumentation: { value: 15 }
            }
          },
          instructionClarity: { 
            score: { value: 14, confidence: 75 },
            subMetrics: {
              stepByStepQuality: { value: 14 },
              commandClarity: { value: 13 },
              environmentSetup: { value: 12 },
              errorHandling: { value: 11 },
              dependencySpecification: { value: 10 }
            }
          },
          workflowAutomation: { 
            score: { value: 13, confidence: 70 },
            subMetrics: {
              ciCdQuality: { value: 11 },
              testAutomation: { value: 9 },
              buildScripts: { value: 13 },
              deploymentAutomation: { value: 12 },
              monitoringLogging: { value: 10 }
            }
          },
          riskCompliance: { 
            score: { value: 16, confidence: 80 },
            subMetrics: {
              securityPractices: { value: 15 },
              errorHandling: { value: 17 },
              inputValidation: { value: 16 },
              dependencySecurity: { value: 14 },
              licenseCompliance: { value: 18 }
            }
          },
          integrationStructure: { 
            score: { value: 12, confidence: 65 },
            subMetrics: {
              apiDocumentation: { value: 12 }
            }
          },
          fileSizeOptimization: { 
            score: { value: 5, confidence: 60 },
            subMetrics: {
              instructionFileOptimization: { value: 5 },
              contextWindowUsage: { value: 5 }
            }
          }
        },
        insights: {
          findings: ['Good structured data', 'Needs better contact info'],
          recommendations: ['Add more structured data', 'Improve mobile experience']
        },
        assessmentMetadata: {
          staticAnalysisTime: 100,
          aiAnalysisTime: 200,
          totalAnalysisTime: 300,
          retryCount: 0,
          fallbackUsed: false
        }
      })
      MockAlignedAssessmentEngine.mockImplementation(() => mockInstance)

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
      expect(data.staticAnalysis).toEqual(mockWebsiteAnalysis)
      expect(data.businessTypeAnalysis).toEqual(mockAssessment.businessTypeAnalysis)
      expect(mockInstance.assessWebsite).toHaveBeenCalledWith('https://example.com')
    })

    it('handles website analysis errors', async () => {
      const mockInstance = new MockAlignedAssessmentEngine()
      mockInstance.assessWebsite = jest.fn().mockRejectedValue(new Error('Website not accessible'))
      MockAlignedAssessmentEngine.mockImplementation(() => mockInstance)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://example.com',
          inputType: 'website'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to analyze source')
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
          inputUrl: 'https://example.com',
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
          inputUrl: 'not-a-url',
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
      const mockStaticAnalysis = {
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: false,
        languages: ['TypeScript'],
        errorHandling: true,
        fileCount: 100,
        linesOfCode: 2000,
        repositorySizeMB: 1.0,
        fileSizeAnalysis: {
          totalFiles: 100,
          filesBySize: { under100KB: 90, under500KB: 10, under1MB: 0, under5MB: 0, over5MB: 0 },
          largeFiles: [],
          criticalFiles: [],
          contextConsumption: {
            instructionFiles: { agentsMd: null, readme: null, contributing: null },
            totalContextFiles: 0,
            averageContextFileSize: 0,
            contextEfficiency: 'excellent',
            recommendations: []
          },
          agentCompatibility: { cursor: 90, githubCopilot: 85, claudeWeb: 88, claudeApi: 92, overall: 89 },
          recommendations: []
        }
      }

      const mockInstance = new MockAlignedAssessmentEngine()
      mockInstance.assessRepository = jest.fn().mockRejectedValue(new Error('Assessment generation failed'))
      MockAlignedAssessmentEngine.mockImplementation(() => mockInstance)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to analyze source')
    })
  })
})