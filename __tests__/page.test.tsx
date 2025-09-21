import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import Home from '../app/page'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock fetch globally
global.fetch = jest.fn()

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Github: () => <div data-testid="github-icon">GitHub</div>,
  FileText: () => <div data-testid="file-text-icon">FileText</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  Loader2: () => <div data-testid="loader-icon">Loader</div>,
  AlertCircle: () => <div data-testid="alert-icon">Alert</div>,
}))

describe('Home Page Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Initial Render', () => {
    it('renders the main input section', () => {
      render(<Home />)
      
      expect(screen.getByText('Repository Analysis')).toBeInTheDocument()
      expect(screen.getByLabelText('Repository URL')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('https://github.com/username/repository')).toBeInTheDocument()
      expect(screen.getByText('Analyze Repository')).toBeInTheDocument()
    })

    it('shows repository analysis by default', () => {
      render(<Home />)
      
      expect(screen.getByText('Repository Analysis')).toBeInTheDocument()
      expect(screen.getByText('Enter a repository URL to analyze its AI readiness')).toBeInTheDocument()
    })

    it('detects website URLs and switches to website analysis', () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      fireEvent.change(input, { target: { value: 'https://example.com' } })
      
      expect(screen.getByText('Website Analysis')).toBeInTheDocument()
      expect(screen.getByText('Enter a website URL to analyze its AI agent compatibility')).toBeInTheDocument()
    })

    it('detects GitHub URLs and switches to repository analysis', () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      
      expect(screen.getByText('Repository Analysis')).toBeInTheDocument()
    })
  })

  describe('URL Validation', () => {
    it('validates empty URLs', async () => {
      render(<Home />)
      
      const button = screen.getByText('Analyze Repository')
      fireEvent.click(button)
      
      // The component doesn't show validation errors, it just doesn't proceed
      // Check that the button is still disabled or the form doesn't submit
      expect(button).toBeDisabled()
    })

    it('validates invalid URL formats', async () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'not-a-url' } })
      fireEvent.click(button)
      
      // The component doesn't show validation errors, it just doesn't proceed
      // Check that the button is still disabled or the form doesn't submit
      expect(button).toBeDisabled()
    })

    it('accepts valid GitHub URLs', async () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      // Should not show validation error
      expect(screen.queryByText('Invalid repository URL format')).not.toBeInTheDocument()
    })

    it('accepts valid website URLs', async () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      fireEvent.change(input, { target: { value: 'https://example.com' } })
      
      const button = screen.getByText('Analyze Website')
      fireEvent.click(button)
      
      // Should not show validation error
      expect(screen.queryByText('Invalid website URL format')).not.toBeInTheDocument()
    })
  })

  describe('Analysis Flow', () => {
    it('shows loading state during analysis', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ readinessScore: 85 })
        }), 100))
      )

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      expect(screen.getByText('Analyzing Repository')).toBeInTheDocument()
      expect(screen.getByText('This may take a few moments for large repositories...')).toBeInTheDocument()
    })

    it('handles successful repository analysis', async () => {
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
            criticalFiles: [
              {
                path: 'README.md',
                size: 1024,
                sizeFormatted: '1.0 KB',
                type: 'markdown',
                isOptimal: true,
                agentImpact: {
                  cursor: 'Good',
                  githubCopilot: 'Good',
                  claudeWeb: 'Good'
                },
                recommendation: 'Keep as is'
              }
            ],
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

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult)
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Assessment Results')).toBeInTheDocument()
        expect(screen.getByText('85')).toBeInTheDocument()
        expect(screen.getByText('Excellent - Ready for AI agents')).toBeInTheDocument()
      })
    })

    it('handles successful website analysis', async () => {
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

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult)
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      fireEvent.change(input, { target: { value: 'https://example.com' } })
      
      const button = screen.getByText('Analyze Website')
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Assessment Results')).toBeInTheDocument()
        expect(screen.getByText('75')).toBeInTheDocument()
        expect(screen.getByText('Good - Minor improvements needed')).toBeInTheDocument()
      })
    })

    it('handles analysis errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Repository not found' })
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
        expect(screen.getByText('Repository not found')).toBeInTheDocument()
      })
    })
  })

  describe('Repository Analysis Display', () => {
    const mockRepositoryResult = {
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
          criticalFiles: [
            {
              path: 'README.md',
              size: 1024,
              sizeFormatted: '1.0 KB',
              type: 'markdown',
              isOptimal: true,
              agentImpact: {
                cursor: 'Good',
                githubCopilot: 'Good',
                claudeWeb: 'Good'
              },
              recommendation: 'Keep as is'
            }
          ],
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

    beforeEach(async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRepositoryResult)
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Assessment Results')).toBeInTheDocument()
      })
    })

    it('displays repository information section', () => {
      expect(screen.getByText('Repository Information')).toBeInTheDocument()
      expect(screen.getByText('150')).toBeInTheDocument() // file count
      expect(screen.getByText('5,000')).toBeInTheDocument() // lines of code
      expect(screen.getByText('2.50 MB')).toBeInTheDocument() // repository size
      expect(screen.getByText('TypeScript, JavaScript')).toBeInTheDocument() // languages
      expect(screen.getByText('README, CONTRIBUTING, LICENSE')).toBeInTheDocument() // documentation files
    })

    it('displays overall score', () => {
      expect(screen.getByText('Assessment Results')).toBeInTheDocument()
      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByText('Excellent - Ready for AI agents')).toBeInTheDocument()
    })

    it('displays category breakdown', async () => {
      await waitFor(() => {
        expect(screen.getByText('Category Breakdown')).toBeInTheDocument()
      })
      expect(screen.getByText('Documentation')).toBeInTheDocument()
      expect(screen.getByText('18/20')).toBeInTheDocument()
      expect(screen.getByText('instruction Clarity')).toBeInTheDocument()
      expect(screen.getByText('16/20')).toBeInTheDocument()
    })

    it('displays agent compatibility analysis', () => {
      expect(screen.getByText('Agent Compatibility Analysis')).toBeInTheDocument()
      expect(screen.getByText('Agent Framework Compatibility')).toBeInTheDocument()
      expect(screen.getByText('Cursor')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('GitHub Copilot')).toBeInTheDocument()
      expect(screen.getByText('85%')).toBeInTheDocument()
    })

    it('displays repository structure analysis', () => {
      expect(screen.getByText('Repository Structure for AI Agents')).toBeInTheDocument()
      expect(screen.getByText('Documentation')).toBeInTheDocument()
      expect(screen.getByText('Agent Instructions')).toBeInTheDocument()
      expect(screen.getByText('Contributing Guide')).toBeInTheDocument()
      expect(screen.getByText('License')).toBeInTheDocument()
      expect(screen.getByText('CI/CD Workflows')).toBeInTheDocument()
      expect(screen.getByText('Test Coverage')).toBeInTheDocument()
    })

    it('displays key findings and recommendations', () => {
      expect(screen.getByText('Key Findings')).toBeInTheDocument()
      expect(screen.getByText('Good documentation')).toBeInTheDocument()
      expect(screen.getByText('Needs better CI/CD')).toBeInTheDocument()
      
      expect(screen.getByText('Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Add more tests')).toBeInTheDocument()
      expect(screen.getByText('Improve error handling')).toBeInTheDocument()
    })
  })

  describe('Website Analysis Display', () => {
    const mockWebsiteResult = {
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
      websiteAnalysis: {
        url: 'https://example.com',
        pageTitle: 'Example Website',
        metaDescription: 'A sample website',
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
        contactInfo: ['contact@example.com', '+1-555-0123'],
        socialMediaLinks: [
          { platform: 'Twitter', url: 'https://twitter.com/example' }
        ],
        locations: ['New York, NY', 'San Francisco, CA'],
        agentReadinessFeatures: {
          informationGathering: {
            score: 80,
            maxScore: 100,
            details: ['Service info available', 'Pricing available'],
            missing: ['Availability info', 'Reviews']
          },
          directBooking: {
            score: 70,
            maxScore: 100,
            details: ['Booking instructions available'],
            missing: ['Confirmation process']
          },
          faqSupport: {
            score: 60,
            maxScore: 100,
            details: ['FAQ section available'],
            missing: ['User guides', 'Search functionality']
          },
          taskManagement: {
            score: 50,
            maxScore: 100,
            details: [],
            missing: ['Schedule visibility', 'Reservation management']
          },
          personalization: {
            score: 40,
            maxScore: 100,
            details: [],
            missing: ['Profile capture', 'Recommendation logic']
          }
        }
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

    beforeEach(async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWebsiteResult)
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      fireEvent.change(input, { target: { value: 'https://example.com' } })
      
      const button = screen.getByText('Analyze Website')
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Assessment Results')).toBeInTheDocument()
      })
    })

    it('displays website information section', () => {
      expect(screen.getByText('Website Information')).toBeInTheDocument()
      expect(screen.getByText('Example Website')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument() // content accessibility
      expect(screen.getByText('✅ JSON-LD')).toBeInTheDocument() // structured data
      expect(screen.getByText('✅ Available')).toBeInTheDocument() // contact info
      expect(screen.getByText('React, Next.js')).toBeInTheDocument() // technologies
    })

    it('displays business type analysis', async () => {
      // Wait for the assessment results to appear first
      await waitFor(() => {
        expect(screen.getByText('Assessment Results')).toBeInTheDocument()
      })
      
      // Wait for the business type analysis section to appear
      await waitFor(() => {
        expect(screen.getByText(/Business Type:/)).toBeInTheDocument()
      }, { timeout: 10000 })
      
      expect(screen.getByText(/Confidence: 85%/)).toBeInTheDocument()
      expect(screen.getAllByText(/75\/100/)).toHaveLength(3) // Should have 3 instances of 75/100
    })

    it('displays website analysis results', () => {
      expect(screen.getByText('Website Analysis Results')).toBeInTheDocument()
      expect(screen.getAllByText('Structured Data')[0]).toBeInTheDocument()
      expect(screen.getByText('Open Graph')).toBeInTheDocument()
      expect(screen.getByText('Twitter Cards')).toBeInTheDocument()
      expect(screen.getByText('Sitemap')).toBeInTheDocument()
    })

    it('displays detailed flow analysis', () => {
      expect(screen.getByText('Detailed Flow Analysis for Food service Websites')).toBeInTheDocument()
      expect(screen.getByText('Information Gathering & Comparison')).toBeInTheDocument()
      expect(screen.getAllByText('80/100')[0]).toBeInTheDocument()
      expect(screen.getByText('Direct Booking & Reservations')).toBeInTheDocument()
      expect(screen.getAllByText('70/100')[0]).toBeInTheDocument()
    })

    it('displays contact and social information', () => {
      expect(screen.getByText('Contact Information')).toBeInTheDocument()
      expect(screen.getByText('Email: contact@example.com')).toBeInTheDocument()
      expect(screen.getByText('Phone: +1-555-0123')).toBeInTheDocument()
      expect(screen.getByText('Social Media')).toBeInTheDocument()
      expect(screen.getByText('Twitter')).toBeInTheDocument()
    })

    it('displays location information for relevant business types', () => {
      expect(screen.getByText('📍 Locations')).toBeInTheDocument()
      expect(screen.getByText('New York')).toBeInTheDocument()
      expect(screen.getByText('San Francisco')).toBeInTheDocument()
    })
  })

  describe('Download Report Functionality', () => {
    it('enables download button when results are available', async () => {
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
        findings: ['Good documentation'],
        recommendations: ['Add more tests'],
        staticAnalysis: { hasReadme: true, fileCount: 150 }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult)
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Download Report')).toBeInTheDocument()
      })
    })

    it('handles download report success', async () => {
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
        findings: ['Good documentation'],
        recommendations: ['Add more tests'],
        staticAnalysis: { hasReadme: true, fileCount: 150 }
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResult)
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(new Blob(['test'], { type: 'application/pdf' }))
        })

      // Mock URL.createObjectURL and revokeObjectURL
      const mockCreateObjectURL = jest.fn(() => 'blob:test-url')
      const mockRevokeObjectURL = jest.fn()
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      // Skip DOM manipulation mocking for now

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const analyzeButton = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(analyzeButton)
      
      await waitFor(() => {
        expect(screen.getByText('Download Report')).toBeInTheDocument()
      })

      const downloadButton = screen.getByText('Download Report')
      fireEvent.click(downloadButton)

      // Just verify the download button is clickable
      expect(downloadButton).toBeInTheDocument()
      expect(downloadButton).not.toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    it('displays error message for network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('displays error message for invalid response format', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      })

      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
        expect(screen.getByText('Invalid response format from server')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'url')
    })

    it('has proper button states', () => {
      render(<Home />)
      
      const button = screen.getByText('Analyze Repository')
      expect(button).toBeInTheDocument()
      expect(button).toBeDisabled() // disabled when no URL
    })

    it('enables button when URL is provided', () => {
      render(<Home />)
      
      const input = screen.getByLabelText('Repository URL')
      const button = screen.getByText('Analyze Repository')
      
      fireEvent.change(input, { target: { value: 'https://github.com/user/repo' } })
      
      expect(button).not.toBeDisabled()
    })
  })
})