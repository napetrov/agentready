'use client'

import { useState } from 'react'
import { Github, FileText, Download, Loader2, AlertCircle } from 'lucide-react'

interface AssessmentResult {
  readinessScore: number
  aiAnalysisStatus?: {
    enabled: boolean
    instructionClarity: boolean
    workflowAutomation: boolean
    contextEfficiency: boolean
    riskCompliance: boolean
    overallSuccess: boolean
    reason?: string
  }
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  findings: string[]
  recommendations: string[]
  detailedAnalysis?: {
    instructionClarity: {
      stepByStepQuality: number
      commandClarity: number
      environmentSetup: number
      errorHandling: number
      dependencySpecification: number
      overallScore: number
    }
    workflowAutomation: {
      ciCdQuality: number
      testAutomation: number
      buildScripts: number
      deploymentAutomation: number
      monitoringLogging: number
      overallScore: number
    }
    contextEfficiency: {
      instructionFileOptimization: number
      codeDocumentation: number
      apiDocumentation: number
      contextWindowUsage: number
      overallScore: number
    }
    riskCompliance: {
      securityPractices: number
      errorHandling: number
      inputValidation: number
      dependencySecurity: number
      licenseCompliance: number
      overallScore: number
    }
  }
  confidence?: {
    overall: number
    instructionClarity: number
    workflowAutomation: number
    contextEfficiency: number
    riskCompliance: number
  }
  staticAnalysis: {
    hasReadme: boolean
    hasContributing: boolean
    hasAgents: boolean
    hasLicense: boolean
    hasWorkflows: boolean
    hasTests: boolean
    languages: string[]
    errorHandling: boolean
    fileCount: number
    linesOfCode: number
    repositorySizeMB: number
    // Website-specific fields
    websiteUrl?: string
    pageTitle?: string
    metaDescription?: string
    hasStructuredData?: boolean
    hasOpenGraph?: boolean
    hasTwitterCards?: boolean
    hasSitemap?: boolean
    hasRobotsTxt?: boolean
    hasFavicon?: boolean
    hasManifest?: boolean
    hasServiceWorker?: boolean
    pageLoadSpeed?: number
    mobileFriendly?: boolean
    accessibilityScore?: number
    seoScore?: number
    contentLength?: number
    imageCount?: number
    linkCount?: number
    headingStructure?: {
      [key: string]: number
    }
    technologies?: string[]
    securityHeaders?: string[]
    socialMediaLinks?: Array<{platform: string, url: string}>
    contactInfo?: string[]
    navigationStructure?: string[]
    fileSizeAnalysis?: {
      totalFiles: number
      filesBySize: {
        under100KB: number
        under500KB: number
        under1MB: number
        under5MB: number
        over5MB: number
      }
      largeFiles: Array<{
        path: string
        size: number
        sizeFormatted: string
        type: string
        agentImpact: {
          cursor: string
          githubCopilot: string
          claudeWeb: string
          claudeApi: string
        }
        recommendation: string
      }>
      criticalFiles: Array<{
        path: string
        size: number
        sizeFormatted: string
        type: string
        isOptimal: boolean
        agentImpact: {
          cursor: string
          githubCopilot: string
          claudeWeb: string
        }
        recommendation: string
      }>
      contextConsumption: {
        instructionFiles: {
          agentsMd: { size: number; lines: number; estimatedTokens: number } | null
          readme: { size: number; lines: number; estimatedTokens: number } | null
          contributing: { size: number; lines: number; estimatedTokens: number } | null
        }
        totalContextFiles: number
        averageContextFileSize: number
        contextEfficiency: string
        recommendations: string[]
      }
      agentCompatibility: {
        cursor: number
        githubCopilot: number
        claudeWeb: number
        claudeApi: number
        overall: number
      }
      recommendations: string[]
    }
  }
  websiteAnalysis?: {
    // Legacy fields for backward compatibility
    websiteType: 'restaurant' | 'documentation' | 'ecommerce' | 'business' | 'blog' | 'portfolio' | 'unknown'
    agenticFlows?: {
      informationGathering: {
        score: number
        hasServiceProductInfo: boolean
        hasPricing: boolean
        hasAvailability: boolean
        hasContactInfo: boolean
        hasLocation: boolean
        hasReviews: boolean
        hasPolicies: boolean
        hasDifferentiators: boolean
      }
      directBooking: {
        score: number
        hasActionableInstructions: boolean
        hasBookingRequirements: boolean
        hasConfirmationProcess: boolean
        hasPaymentOptions: boolean
        hasModificationPolicies: boolean
        hasErrorHandling: boolean
        hasMobileOptimization: boolean
      }
      faqSupport: {
        score: number
        hasFaq: boolean
        hasPolicyDocumentation: boolean
        hasUserGuides: boolean
        hasEligibilityCriteria: boolean
        hasSupportContact: boolean
        hasSearchFunctionality: boolean
        hasContentOrganization: boolean
      }
      taskManagement: {
        score: number
        hasScheduleVisibility: boolean
        hasReservationManagement: boolean
        hasTaskTracking: boolean
        hasReschedulingProcess: boolean
        hasMembershipDetails: boolean
        hasNotificationSystems: boolean
      }
      personalization: {
        score: number
        hasPersonalizationData: boolean
        hasRecommendationLogic: boolean
        hasContextAwareness: boolean
        hasUserProfiling: boolean
        hasDynamicContent: boolean
      }
    }
    restaurantMetrics?: {
      hasHours: boolean
      hasMenu: boolean
      hasReservations: boolean
      hasOrdering: boolean
      hasIngredients: boolean
      hasCalories: boolean
      hasLocation: boolean
      hasPhone: boolean
      hasDelivery: boolean
      hasReviews: boolean
    }
    documentationMetrics?: {
      hasApiDocs: boolean
      hasExamples: boolean
      hasTutorials: boolean
      hasChangelog: boolean
      hasVersioning: boolean
      hasCodeSamples: boolean
      hasInstallationGuide: boolean
      hasQuickStart: boolean
      hasReference: boolean
      hasCommunity: boolean
    }
    ecommerceMetrics?: {
      hasProductCatalog: boolean
      hasSearch: boolean
      hasFilters: boolean
      hasReviews: boolean
      hasWishlist: boolean
      hasCart: boolean
      hasCheckout: boolean
      hasPayment: boolean
      hasShipping: boolean
      hasReturns: boolean
    }
  }
  // New business-type-aware analysis data
  businessTypeAnalysis?: {
    businessType: string
    businessTypeConfidence: number
    overallScore: number
    agenticFlows: {
      informationGathering: {
        score: number
        details: {
          hasServiceProductInfo: boolean
          hasPricing: boolean
          hasAvailability: boolean
          hasContactInfo: boolean
          hasLocation: boolean
          hasReviews: boolean
          hasPolicies: boolean
          hasDifferentiators: boolean
        }
      }
      directBooking: {
        score: number
        details: {
          hasActionableInstructions: boolean
          hasBookingRequirements: boolean
          hasConfirmationProcess: boolean
          hasPaymentOptions: boolean
          hasModificationPolicies: boolean
          hasErrorHandling: boolean
        }
      }
      faqSupport: {
        score: number
        details: {
          hasFaq: boolean
          hasPolicyDocumentation: boolean
          hasUserGuides: boolean
          hasEligibilityCriteria: boolean
          hasSupportContact: boolean
          hasSearchFunctionality: boolean
        }
      }
      taskManagement: {
        score: number
        details: {
          hasScheduleVisibility: boolean
          hasReservationManagement: boolean
          hasTaskTracking: boolean
          hasReschedulingProcess: boolean
          hasMembershipDetails: boolean
          hasNotificationSystems: boolean
        }
      }
      personalization: {
        score: number
        details: {
          hasPersonalizationData: boolean
          hasRecommendationLogic: boolean
          hasContextAwareness: boolean
          hasUserProfiling: boolean
          hasDynamicContent: boolean
        }
      }
    }
    aiRelevantChecks: {
      hasStructuredData: boolean
      hasContactInfo: boolean
      hasPageTitle: boolean
      hasMetaDescription: boolean
      hasSitemap: boolean
      hasRobotsTxt: boolean
      contentAccessibility: number
    }
    findings: string[]
    recommendations: string[]
  }
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [error, setError] = useState('')
  const [inputType, setInputType] = useState<'repository' | 'website'>('repository')

  // URL validation and sanitization function
  const validateAndSanitizeUrl = (url: string, type: 'repository' | 'website'): string => {
    // Trim whitespace
    const trimmedUrl = url.trim()
    
    if (!trimmedUrl) {
      throw new Error(`Please enter a ${type === 'repository' ? 'repository' : 'website'} URL`)
    }

    let validatedUrl: URL
    
    try {
      // Try to construct URL directly
      validatedUrl = new URL(trimmedUrl)
    } catch {
      try {
        // If that fails, try prepending https://
        validatedUrl = new URL(`https://${trimmedUrl}`)
      } catch {
        throw new Error(`Invalid ${type === 'repository' ? 'repository' : 'website'} URL format`)
      }
    }

    // Validate protocol
    if (type === 'repository') {
      if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
        throw new Error('Repository URL must use HTTP or HTTPS protocol')
      }
    } else {
      if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
        throw new Error('Website URL must use HTTP or HTTPS protocol')
      }
    }

    // Remove trailing slashes and fragments for cleaner URLs
    validatedUrl.hash = ''
    validatedUrl.search = ''
    
    // Remove trailing slash from pathname
    let pathname = validatedUrl.pathname
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    validatedUrl.pathname = pathname

    // Return the sanitized URL
    return validatedUrl.toString()
  }

  const handleAnalyze = async () => {
    try {
      const sanitizedUrl = validateAndSanitizeUrl(inputUrl, inputType)
      
      setIsAnalyzing(true)
      setError('')
      setResult(null)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inputUrl: sanitizedUrl,
          inputType: inputType
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || `Server error: ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Analysis result:', data)
      
      // Validate the response data
      if (!data || typeof data.readinessScore !== 'number') {
        throw new Error('Invalid response format from server')
      }
      
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const downloadReport = async () => {
    if (!result) return

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ result, inputUrl, inputType }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-readiness-assessment-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download report:', err)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600 bg-success-50'
    if (score >= 60) return 'text-warning-600 bg-warning-50'
    return 'text-danger-600 bg-danger-50'
  }

  const getCategoryTextColor = (score: number) => {
    if (score >= 16) return 'text-success-600'
    if (score >= 12) return 'text-warning-600'
    return 'text-danger-600'
  }

  const getCategoryDescription = (category: string) => {
    const descriptions: Record<string, string> = {
      documentation: inputType === 'website' 
        ? 'Measures structured data, meta tags, and machine-readable content for AI agent understanding'
        : 'Measures presence and quality of README, CONTRIBUTING, AGENTS.md, and LICENSE files',
      instructionClarity: inputType === 'website'
        ? 'Evaluates API readiness, integration points, and data accessibility for AI agents'
        : 'Evaluates how clear and actionable instructions are for AI agents to follow',
      workflowAutomation: inputType === 'website'
        ? 'Assesses conversational readiness, natural language structure, and user intent matching'
        : 'Assesses CI/CD setup, testing, build scripts, and deployment automation',
      riskCompliance: inputType === 'website'
        ? 'Checks business data completeness, contact information, and service transparency'
        : 'Checks security practices, error handling, input validation, and license compliance',
      integrationStructure: inputType === 'website'
        ? 'Evaluates technology stack, social media integration, and automation potential'
        : 'Evaluates code organization, API structure, and integration readiness',
      fileSizeOptimization: inputType === 'website'
        ? 'Measures content organization, navigation structure, and AI agent discoverability'
        : 'Measures file sizes against AI agent limits and context window efficiency'
    }
    return descriptions[category] || 'Assessment category'
  }

  const sanitizeUrl = (url: string | null): string | null => {
    if (!url) return null
    
    try {
      const parsedUrl = new URL(url)
      
      // Only allow http and https protocols
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return null
      }
      
      return url
    } catch {
      return null
    }
  }

  const detectInputType = (url: string): 'repository' | 'website' => {
    try {
      const parsedUrl = new URL(url)
      const hostname = parsedUrl.hostname.toLowerCase()
      
      // Check if it's a GitHub repository
      if (hostname === 'github.com' || hostname === 'www.github.com') {
        return 'repository'
      }
      
      return 'website'
    } catch {
      return 'website'
    }
  }

  const handleUrlChange = (url: string) => {
    setInputUrl(url)
    if (url.trim()) {
      setInputType(detectInputType(url))
    }
  }

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Github className="w-5 h-5 mr-2" />
          {inputType === 'repository' ? 'Repository Analysis' : 'Website Analysis'}
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="inputUrl" className="block text-sm font-medium text-gray-700 mb-2">
              {inputType === 'repository' ? 'Repository URL' : 'Website URL'}
            </label>
            <input
              type="url"
              id="inputUrl"
              value={inputUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder={inputType === 'repository' ? "https://github.com/username/repository" : "https://example.com"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isAnalyzing}
            />
            <p className="text-sm text-gray-500 mt-1">
              {inputType === 'repository' 
                ? 'Enter a repository URL to analyze its AI readiness'
                : 'Enter a website URL to analyze its AI agent compatibility'
              }
            </p>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !inputUrl.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              `Analyze ${inputType === 'repository' ? 'Repository' : 'Website'}`
            )}
          </button>
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md border border-red-200">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                <div>
                  <p className="font-medium">Analysis Failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isAnalyzing && (
        <div className="card border-blue-200 bg-blue-50">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <div>
              <p className="text-blue-800 font-medium">Analyzing {inputType === 'repository' ? 'Repository' : 'Website'}</p>
              <p className="text-blue-700 text-sm mt-1">
                {inputType === 'repository' 
                  ? 'This may take a few moments for large repositories...'
                  : 'This may take a few moments to analyze the website...'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Analysis Status - Only for repositories */}
      {inputType === 'repository' && result && result.aiAnalysisStatus && (
        <div className={`card ${result.aiAnalysisStatus.enabled ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${result.aiAnalysisStatus.enabled ? 'text-blue-800' : 'text-red-800'}`}>
            {result.aiAnalysisStatus.enabled ? '✅ AI Analysis Status' : '❌ AI Analysis Status'}
          </h3>
          <div className="text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Overall Status:</strong> 
                  <span className={result.aiAnalysisStatus.overallSuccess ? 'text-green-600' : 'text-red-600'}>
                    {result.aiAnalysisStatus.overallSuccess ? ' ✅ Working' : ' ❌ Failed'}
                  </span>
                </p>
                <p><strong>Instruction Clarity:</strong> 
                  <span className={result.aiAnalysisStatus.instructionClarity ? 'text-green-600' : 'text-red-600'}>
                    {result.aiAnalysisStatus.instructionClarity ? ' ✅' : ' ❌'}
                  </span>
                </p>
                <p><strong>Workflow Automation:</strong> 
                  <span className={result.aiAnalysisStatus.workflowAutomation ? 'text-green-600' : 'text-red-600'}>
                    {result.aiAnalysisStatus.workflowAutomation ? ' ✅' : ' ❌'}
                  </span>
                </p>
              </div>
              <div>
                <p><strong>Context Efficiency:</strong> 
                  <span className={result.aiAnalysisStatus.contextEfficiency ? 'text-green-600' : 'text-red-600'}>
                    {result.aiAnalysisStatus.contextEfficiency ? ' ✅' : ' ❌'}
                  </span>
                </p>
                <p><strong>Risk Compliance:</strong> 
                  <span className={result.aiAnalysisStatus.riskCompliance ? 'text-green-600' : 'text-red-600'}>
                    {result.aiAnalysisStatus.riskCompliance ? ' ✅' : ' ❌'}
                  </span>
                </p>
                {result.aiAnalysisStatus.reason && (
                  <p><strong>Reason:</strong> <span className="text-red-600">{result.aiAnalysisStatus.reason}</span></p>
                )}
              </div>
            </div>
            
            {/* Debug Information - Only show when there are issues */}
            {(result.readinessScore === 0 || !result.categories || Object.values(result.categories).every(score => score === 0) || !result.aiAnalysisStatus.overallSuccess) && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Information</h4>
                <div className="text-xs text-gray-600">
                  <p><strong>Readiness Score:</strong> {result.readinessScore} (type: {typeof result.readinessScore})</p>
                  <p><strong>Categories:</strong> {JSON.stringify(result.categories)}</p>
                  <p><strong>Has Categories:</strong> {result.categories ? 'Yes' : 'No'}</p>
                  <p><strong>Categories Keys:</strong> {result.categories ? Object.keys(result.categories).join(', ') : 'None'}</p>
                  <p><strong>Static Analysis File Count:</strong> {result.staticAnalysis?.fileCount || 'undefined'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Source Information */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{inputType === 'repository' ? 'Repository Information' : 'Website Information'}</h3>
              {sanitizeUrl(inputUrl) && (
                <a
                  href={sanitizeUrl(inputUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${inputType === 'repository' ? 'repository on GitHub' : 'website'}`}
                  className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Github className="w-4 h-4 mr-2" />
                  View {inputType === 'repository' ? 'Repository' : 'Website'}
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {inputType === 'repository' ? (
                <>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Total Files</div>
                    <div className="text-lg font-bold text-blue-600">
                      {result.staticAnalysis.fileCount || result.staticAnalysis.fileSizeAnalysis?.totalFiles || 0}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Lines of Code</div>
                    <div className="text-lg font-bold text-green-600">
                      {result.staticAnalysis.linesOfCode?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Repository Size</div>
                    <div className="text-lg font-bold text-purple-600">
                      {result.staticAnalysis.repositorySizeMB?.toFixed(2) || '0.00'} MB
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Primary Languages</div>
                    <div className="text-sm font-medium">
                      {result.staticAnalysis.languages?.slice(0, 2).join(', ') || 'Unknown'}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Documentation Files</div>
                    <div className="text-sm font-medium">
                      {[
                        result.staticAnalysis.hasReadme && 'README',
                        result.staticAnalysis.hasAgents && 'AGENTS',
                        result.staticAnalysis.hasContributing && 'CONTRIBUTING',
                        result.staticAnalysis.hasLicense && 'LICENSE'
                      ].filter(Boolean).join(', ') || 'None'}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Page Title</div>
                    <div className="text-sm font-medium truncate">
                      {result.staticAnalysis.pageTitle || 'No title'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Critical for AI agent identification
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Content Accessibility</div>
                    <div className="text-lg font-bold text-blue-600">
                      {result.businessTypeAnalysis?.aiRelevantChecks.contentAccessibility || 0}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      How easy it is for AI agents to extract information
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Structured Data</div>
                    <div className="text-sm font-medium">
                      {result.businessTypeAnalysis?.aiRelevantChecks.hasStructuredData ? '✅ JSON-LD' : '❌ Missing'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Helps AI agents understand content structure
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Contact Info</div>
                    <div className="text-sm font-medium">
                      {result.businessTypeAnalysis?.aiRelevantChecks.hasContactInfo ? '✅ Available' : '❌ Missing'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Essential for AI agents to find contact details
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Technologies</div>
                    <div className="text-sm font-medium">
                      {result.staticAnalysis.technologies?.slice(0, 2).join(', ') || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Framework compatibility for agent integration
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Overall Score */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Assessment Results</h2>
              <button
                onClick={downloadReport}
                className="btn-secondary flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </button>
            </div>
            
            <div className="flex items-center space-x-8">
              <div className={`score-circle ${getScoreColor(result.readinessScore || 0)}`}>
                {result.readinessScore || 0}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Overall Readiness Score</h3>
                <p className="text-gray-600">
                  {result.readinessScore >= 80 && 'Excellent - Ready for AI agents'}
                  {result.readinessScore >= 60 && result.readinessScore < 80 && 'Good - Minor improvements needed'}
                  {result.readinessScore < 60 && 'Needs improvement - Significant work required'}
                </p>
              </div>
            </div>
          </div>

          {/* Category Breakdown - Only for repositories */}
          {inputType === 'repository' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Category Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(result.categories || {}).map(([category, score]) => (
                  <div key={category} className="p-4 border rounded-lg group relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium capitalize">
                        {category.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className={`text-sm font-bold ${getCategoryTextColor(score || 0)}`}>
                        {score || 0}/20
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (score || 0) >= 16 ? 'bg-success-500' : (score || 0) >= 12 ? 'bg-warning-500' : 'bg-danger-500'
                        }`}
                        style={{ width: `${((score || 0) / 20) * 100}%` }}
                      />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      {getCategoryDescription(category)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Static Analysis */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">
              {inputType === 'website' ? 'Website Analysis Results' : 'Static Analysis Results'}
            </h3>
            {inputType === 'website' ? (
              <div className="space-y-6">
                {/* Website-specific metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      result.staticAnalysis.hasStructuredData ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {result.staticAnalysis.hasStructuredData ? '✓' : '✗'}
                    </div>
                    <div className="text-sm font-medium">Structured Data</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      result.staticAnalysis.hasOpenGraph ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {result.staticAnalysis.hasOpenGraph ? '✓' : '✗'}
                    </div>
                    <div className="text-sm font-medium">Open Graph</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      result.staticAnalysis.hasTwitterCards ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {result.staticAnalysis.hasTwitterCards ? '✓' : '✗'}
                    </div>
                    <div className="text-sm font-medium">Twitter Cards</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                      result.staticAnalysis.hasSitemap ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {result.staticAnalysis.hasSitemap ? '✓' : '✗'}
                    </div>
                    <div className="text-sm font-medium">Sitemap</div>
                  </div>
                </div>

                {/* AI-Relevant Scores */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-2">Content Accessibility</div>
                    <div className="text-2xl font-bold text-blue-600">{result.businessTypeAnalysis?.aiRelevantChecks.contentAccessibility || 0}/100</div>
                    <div className="text-xs text-gray-500 mt-1">How easy it is for AI agents to extract information</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-2">Overall AI Readiness</div>
                    <div className="text-2xl font-bold text-green-600">{result.businessTypeAnalysis?.overallScore || 0}/100</div>
                    <div className="text-xs text-gray-500 mt-1">Business-type-aware AI agent readiness score</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-2">Content Length</div>
                    <div className="text-2xl font-bold text-purple-600">{result.staticAnalysis.contentLength?.toLocaleString() || 0} chars</div>
                    <div className="text-xs text-gray-500 mt-1">Total content available for analysis</div>
                  </div>
                </div>

                {/* Website technologies */}
                {result.staticAnalysis.technologies && result.staticAnalysis.technologies.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium mb-2">Detected Technologies</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.staticAnalysis.technologies.map((tech: string, index: number) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contact and social info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.staticAnalysis.contactInfo && result.staticAnalysis.contactInfo.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium mb-2">Contact Information</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {result.staticAnalysis.contactInfo.slice(0, 3).map((contact: string, index: number) => (
                          <li key={index} className="flex items-center">
                            {contact.includes('@') ? (
                              <>
                                <span className="text-blue-600 mr-2">📧</span>
                                <span>Email: {contact}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-green-600 mr-2">📞</span>
                                <span>Phone: {contact}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <h4 className="text-md font-medium mb-2">Social Media</h4>
                    {result.staticAnalysis.socialMediaLinks && result.staticAnalysis.socialMediaLinks.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {result.staticAnalysis.socialMediaLinks.map((social: {platform: string, url: string}, index: number) => (
                          <a 
                            key={index} 
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200 transition-colors duration-200 inline-flex items-center gap-1"
                          >
                            {social.platform}
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">None discovered</p>
                    )}
                  </div>
                </div>

        {/* Business Type Analysis */}
        {result.businessTypeAnalysis && (
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium text-blue-900">
                Business Type: <span className="capitalize font-semibold">{result.businessTypeAnalysis.businessType.replace('_', ' ')}</span>
              </h4>
              <div className="text-sm text-blue-700">
                Confidence: {result.businessTypeAnalysis.businessTypeConfidence}%
              </div>
            </div>
            <div className="text-sm text-blue-800 mb-3">
              AI Agent Readiness Score: <span className="font-semibold">{result.businessTypeAnalysis.overallScore}/100</span>
            </div>
          </div>
        )}

        {/* Legacy Website Type Display (fallback) */}
        {!result.businessTypeAnalysis && result.websiteAnalysis && (
          <div className="mt-6 p-4 border rounded-lg bg-blue-50">
            <h4 className="text-lg font-medium mb-3 text-blue-900">
              Website Type: <span className="capitalize">{result.websiteAnalysis.websiteType}</span>
            </h4>

            {result.websiteAnalysis.websiteType === 'restaurant' && result.websiteAnalysis.restaurantMetrics && (
              <div>
                <h5 className="text-md font-medium mb-2 text-blue-800">Restaurant Features</h5>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(result.websiteAnalysis.restaurantMetrics).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-sm capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.websiteAnalysis.websiteType === 'documentation' && result.websiteAnalysis.documentationMetrics && (
              <div>
                <h5 className="text-md font-medium mb-2 text-blue-800">Documentation Features</h5>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(result.websiteAnalysis.documentationMetrics).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-sm capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.websiteAnalysis.websiteType === 'ecommerce' && result.websiteAnalysis.ecommerceMetrics && (
              <div>
                <h5 className="text-md font-medium mb-2 text-blue-800">E-commerce Features</h5>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(result.websiteAnalysis.ecommerceMetrics).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-sm capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Detailed Flow Analysis for Business Type */}
        {result.businessTypeAnalysis?.agenticFlows && result.businessTypeAnalysis.businessType && (
          <div className="mt-6 p-4 border rounded-lg bg-indigo-50">
            <h4 className="text-lg font-medium mb-4 text-indigo-900">
              Detailed Flow Analysis for {result.businessTypeAnalysis.businessType.replace('_', ' ').charAt(0).toUpperCase() + result.businessTypeAnalysis.businessType.replace('_', ' ').slice(1)} Websites
            </h4>
            
            {/* Information Gathering Flow Details */}
            <div className="mb-6 p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-indigo-800">Information Gathering & Comparison</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-bold text-indigo-600">{result.businessTypeAnalysis.agenticFlows.informationGathering.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Evaluates how well the website provides comprehensive information for AI agents to gather and compare data.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.businessTypeAnalysis.agenticFlows.informationGathering.details)
                  .map(([key, value]) => {
                    const descriptions = {
                      hasServiceProductInfo: 'Checks for detailed service/product descriptions, features, and specifications',
                      hasPricing: 'Looks for pricing information, rates, packages, or cost details',
                      hasAvailability: 'Searches for availability calendars, schedules, or real-time status',
                      hasContactInfo: 'Verifies presence of contact details (phone, email, address)',
                      hasLocation: 'Checks for location data, addresses, or geographic information',
                      hasReviews: 'Looks for customer reviews, testimonials, or rating systems',
                      hasPolicies: 'Searches for terms of service, privacy policy, or business policies',
                      hasDifferentiators: 'Identifies unique selling points or competitive advantages'
                    };
                    return (
                      <div key={key} className="flex items-center space-x-2 p-2 rounded border group relative">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          {descriptions[key as keyof typeof descriptions] || 'Information gathering feature'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Direct Booking Flow Details */}
            <div className="mb-6 p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-indigo-800">Direct Booking & Reservations</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-bold text-indigo-600">{result.businessTypeAnalysis.agenticFlows.directBooking.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Assesses the website&apos;s ability to support direct booking, reservation, and transaction actions.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.businessTypeAnalysis.agenticFlows.directBooking.details)
                  .map(([key, value]) => {
                    const descriptions = {
                      hasActionableInstructions: 'Checks for clear step-by-step booking or reservation instructions',
                      hasBookingRequirements: 'Looks for specific requirements, forms, or prerequisites for booking',
                      hasConfirmationProcess: 'Verifies presence of confirmation emails, receipts, or booking confirmations',
                      hasPaymentOptions: 'Searches for payment methods, pricing, or transaction capabilities',
                      hasModificationPolicies: 'Looks for cancellation, rescheduling, or modification policies',
                      hasErrorHandling: 'Checks for error messages, validation, or user feedback systems',
                      hasMobileOptimization: 'Verifies mobile-friendly booking interface and responsive design'
                    };
                    return (
                      <div key={key} className="flex items-center space-x-2 p-2 rounded border group relative">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          {descriptions[key as keyof typeof descriptions] || 'Direct booking feature'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* FAQ/Support Flow Details */}
            <div className="mb-6 p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-indigo-800">FAQ & Knowledge Support</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-bold text-indigo-600">{result.businessTypeAnalysis.agenticFlows.faqSupport.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Evaluates support and knowledge base capabilities for answering user questions and providing guidance.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.businessTypeAnalysis.agenticFlows.faqSupport.details)
                  .map(([key, value]) => {
                    const descriptions = {
                      hasFaq: 'Checks for frequently asked questions section or help center',
                      hasPolicyDocumentation: 'Looks for terms of service, privacy policy, or legal documentation',
                      hasUserGuides: 'Searches for tutorials, guides, or instructional content',
                      hasEligibilityCriteria: 'Verifies presence of qualification requirements or eligibility information',
                      hasSupportContact: 'Checks for customer support contact information or help desk',
                      hasSearchFunctionality: 'Looks for search features or knowledge base search',
                      hasContentOrganization: 'Verifies well-organized content structure and navigation'
                    };
                    return (
                      <div key={key} className="flex items-center space-x-2 p-2 rounded border group relative">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          {descriptions[key as keyof typeof descriptions] || 'FAQ/Support feature'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Task Management Flow Details */}
            <div className="mb-6 p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-indigo-800">Task & Calendar Management</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-bold text-indigo-600">{result.businessTypeAnalysis.agenticFlows.taskManagement.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Assesses task management, scheduling, and calendar integration capabilities.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.businessTypeAnalysis.agenticFlows.taskManagement.details)
                  .map(([key, value]) => {
                    const descriptions = {
                      hasScheduleVisibility: 'Checks for visible schedules, calendars, or time-based information',
                      hasReservationManagement: 'Looks for reservation systems, booking management, or appointment tools',
                      hasTaskTracking: 'Searches for task lists, progress tracking, or project management features',
                      hasReschedulingProcess: 'Verifies ability to modify, reschedule, or update existing bookings',
                      hasMembershipDetails: 'Checks for membership information, accounts, or user profiles',
                      hasNotificationSystems: 'Looks for alerts, notifications, or communication systems'
                    };
                    return (
                      <div key={key} className="flex items-center space-x-2 p-2 rounded border group relative">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          {descriptions[key as keyof typeof descriptions] || 'Task management feature'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Personalization Flow Details */}
            <div className="p-4 border rounded-lg bg-white">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-lg font-semibold text-indigo-800">Personalization & Recommendations</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Score:</span>
                  <span className="text-lg font-bold text-indigo-600">{result.businessTypeAnalysis.agenticFlows.personalization.score}/100</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Evaluates personalization capabilities and recommendation systems for tailored user experiences.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(result.businessTypeAnalysis.agenticFlows.personalization.details)
                  .map(([key, value]) => {
                    const descriptions = {
                      hasPersonalizationData: 'Checks for user preferences, settings, or customization options',
                      hasRecommendationLogic: 'Looks for recommendation systems or suggested content',
                      hasContextAwareness: 'Searches for location-based, time-based, or contextual features',
                      hasUserProfiling: 'Verifies user account features, profiles, or personal data collection',
                      hasDynamicContent: 'Checks for personalized or adaptive content delivery'
                    };
                    return (
                      <div key={key} className="flex items-center space-x-2 p-2 rounded border group relative">
                        <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs capitalize">{key.replace('has', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                        <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          {descriptions[key as keyof typeof descriptions] || 'Personalization feature'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(result.staticAnalysis)
                  .filter(([_, value]) => typeof value === 'boolean')
                  .map(([key, value]) => (
                    <div key={key} className="text-center p-3 border rounded-lg">
                      <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                        value ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {value ? '✓' : '✗'}
                      </div>
                      <div className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            {/* Languages */}
            {result.staticAnalysis.languages && result.staticAnalysis.languages.length > 0 && (
              <div className="mt-4 p-3 border rounded-lg">
                <div className="text-sm font-medium mb-2">Programming Languages</div>
                <div className="flex flex-wrap gap-2">
                  {result.staticAnalysis.languages.map((lang: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>


          {/* File Size Analysis - Only for repositories */}
          {inputType === 'repository' && result.staticAnalysis.fileSizeAnalysis && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">File Size & AI Agent Compatibility</h3>
              
              {/* Agent Compatibility Scores */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Agent Compatibility Scores</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(result.staticAnalysis.fileSizeAnalysis.agentCompatibility)
                    .filter(([key]) => key !== 'overall')
                    .map(([agent, score]) => (
                    <div key={agent} className="p-3 border rounded-lg text-center">
                      <div className="text-sm font-medium capitalize mb-1">
                        {agent === 'githubCopilot' ? 'GitHub Copilot' : 
                         agent === 'claudeWeb' ? 'Claude Web' :
                         agent === 'claudeApi' ? 'Claude API' : agent}
                      </div>
                      <div className={`text-lg font-bold ${
                        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {score}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Size Distribution */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">File Size Distribution</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {(['under100KB','under500KB','under1MB','under5MB','over5MB'] as const).map((range) => {
                    const count = result.staticAnalysis.fileSizeAnalysis?.filesBySize[range] ?? 0
                    const label =
                      range === 'under100KB' ? 'Under 100KB' :
                      range === 'under500KB' ? '100KB–500KB' :
                      range === 'under1MB'   ? '500KB–1MB' :
                      range === 'under5MB'   ? '1MB–5MB' :
                      'Over 5MB'
                    return (
                    <div key={range} className="p-3 border rounded-lg text-center">
                      <div className="text-sm font-medium mb-1">
                        {label}
                      </div>
                      <div className="text-lg font-bold text-blue-600">{count}</div>
                    </div>
                    )})}
                </div>
              </div>

              {/* Large Files */}
              {result.staticAnalysis.fileSizeAnalysis.largeFiles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium mb-3">Large Files (&gt;2MB)</h4>
                  <div className="space-y-2">
                    {result.staticAnalysis.fileSizeAnalysis.largeFiles.slice(0, 5).map((file, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2">{file.path}</div>
                          <div className="text-sm font-bold text-red-600">{file.sizeFormatted}</div>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          Type: {file.type} | 
                          Cursor: {file.agentImpact.cursor} | 
                          GitHub Copilot: {file.agentImpact.githubCopilot}
                        </div>
                        <div className="text-xs text-gray-700">{file.recommendation}</div>
                      </div>
                    ))}
                    {result.staticAnalysis.fileSizeAnalysis.largeFiles.length > 5 && (
                      <div className="text-sm text-gray-500 text-center">
                        ... and {result.staticAnalysis.fileSizeAnalysis.largeFiles.length - 5} more files
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Critical Files */}
              {result.staticAnalysis.fileSizeAnalysis.criticalFiles.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium mb-3">Critical Files Analysis</h4>
                  <div className="space-y-2">
                    {result.staticAnalysis.fileSizeAnalysis.criticalFiles.map((file, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-sm truncate flex-1 mr-2">{file.path}</div>
                          <div className="text-sm font-bold">{file.sizeFormatted}</div>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 text-xs rounded ${
                            file.isOptimal ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {file.isOptimal ? 'Optimal' : 'Suboptimal'}
                          </span>
                          <span className="text-xs text-gray-600">
                            {file.type} | Cursor: {file.agentImpact.cursor}
                          </span>
                        </div>
                        <div className="text-xs text-gray-700">{file.recommendation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Consumption */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Context Consumption Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Instruction Files</div>
                    <div className="space-y-1 text-xs">
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd && (
                        <div>AGENTS.md: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.agentsMd.lines} lines)</div>
                      )}
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme && (
                        <div>README: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.readme.lines} lines)</div>
                      )}
                      {result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing && (
                        <div>CONTRIBUTING: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing.size / 1024)}KB ({result.staticAnalysis.fileSizeAnalysis.contextConsumption.instructionFiles.contributing.lines} lines)</div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium mb-2">Efficiency Metrics</div>
                    <div className="space-y-1 text-xs">
                      <div>Total Context Files: {result.staticAnalysis.fileSizeAnalysis.contextConsumption.totalContextFiles}</div>
                      <div>Average File Size: {Math.round(result.staticAnalysis.fileSizeAnalysis.contextConsumption.averageContextFileSize / 1024)}KB</div>
                      <div>Context Efficiency: <span className={`font-medium ${
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'excellent' ? 'text-green-600' :
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'good' ? 'text-blue-600' :
                        result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                      }`}>{result.staticAnalysis.fileSizeAnalysis.contextConsumption.contextEfficiency}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Size Recommendations */}
              {result.staticAnalysis.fileSizeAnalysis.recommendations.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-3">File Size Recommendations</h4>
                  <ul className="space-y-1">
                    {result.staticAnalysis.fileSizeAnalysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Detailed Analysis - Only for repositories */}
          {inputType === 'repository' && result.detailedAnalysis && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Detailed Analysis</h3>
              
              {/* Instruction Clarity */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Instruction Clarity Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Step-by-Step Quality</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.stepByStepQuality}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Command Clarity</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.commandClarity}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Environment Setup</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.environmentSetup}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Error Handling</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.errorHandling}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Dependency Specification</div>
                    <div className="text-lg font-bold text-blue-600">{result.detailedAnalysis.instructionClarity.dependencySpecification}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-blue-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-blue-700">{result.detailedAnalysis.instructionClarity.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Workflow Automation */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Workflow Automation Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">CI/CD Quality</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.ciCdQuality}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Test Automation</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.testAutomation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Build Scripts</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.buildScripts}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Deployment Automation</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.deploymentAutomation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Monitoring & Logging</div>
                    <div className="text-lg font-bold text-green-600">{result.detailedAnalysis.workflowAutomation.monitoringLogging}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-green-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-green-700">{result.detailedAnalysis.workflowAutomation.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Context Efficiency */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Context Efficiency Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Instruction File Optimization</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.instructionFileOptimization}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Code Documentation</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.codeDocumentation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">API Documentation</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.apiDocumentation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Context Window Usage</div>
                    <div className="text-lg font-bold text-purple-600">{result.detailedAnalysis.contextEfficiency.contextWindowUsage}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-purple-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-purple-700">{result.detailedAnalysis.contextEfficiency.overallScore}/20</div>
                  </div>
                </div>
              </div>

              {/* Risk & Compliance */}
              <div className="mb-6">
                <h4 className="text-md font-medium mb-3">Risk & Compliance Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Security Practices</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.securityPractices}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Error Handling</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.errorHandling}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Input Validation</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.inputValidation}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Dependency Security</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.dependencySecurity}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">License Compliance</div>
                    <div className="text-lg font-bold text-red-600">{result.detailedAnalysis.riskCompliance.licenseCompliance}/20</div>
                  </div>
                  <div className="p-3 border rounded-lg bg-red-50">
                    <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
                    <div className="text-lg font-bold text-red-700">{result.detailedAnalysis.riskCompliance.overallScore}/20</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confidence Scores - Only for repositories */}
          {inputType === 'repository' && result.confidence && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Assessment Confidence</h3>
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  Based on data quality and analysis completeness
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Confidence scores indicate how reliable the assessment is based on available data quality, 
                completeness of analysis, and consistency of findings across different evaluation methods.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Overall</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.overall >= 80 ? 'text-green-600' : 
                    result.confidence.overall >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.overall}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Instruction Clarity</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.instructionClarity >= 80 ? 'text-green-600' : 
                    result.confidence.instructionClarity >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.instructionClarity}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Workflow Automation</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.workflowAutomation >= 80 ? 'text-green-600' : 
                    result.confidence.workflowAutomation >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.workflowAutomation}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Context Efficiency</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.contextEfficiency >= 80 ? 'text-green-600' : 
                    result.confidence.contextEfficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.contextEfficiency}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">Risk & Compliance</div>
                  <div className={`text-lg font-bold ${
                    result.confidence.riskCompliance >= 80 ? 'text-green-600' : 
                    result.confidence.riskCompliance >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {result.confidence.riskCompliance}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key Findings */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Key Findings</h3>
            <ul className="space-y-2">
              {(result.businessTypeAnalysis?.findings || result.findings).map((finding, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
            <ul className="space-y-2">
              {(result.businessTypeAnalysis?.recommendations || result.recommendations).map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-2 h-2 bg-warning-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}