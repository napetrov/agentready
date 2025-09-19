/**
 * Unified Data Models
 * 
 * Standardized interfaces for all assessment results across the system.
 * Replaces multiple overlapping result interfaces with single, consistent models.
 */

export interface UnifiedAssessmentResult {
  // Core identification
  id: string
  type: 'repository' | 'website'
  inputUrl: string
  timestamp: Date
  
  // Overall scoring (0-100 scale)
  overallScore: number
  confidence: number
  
  // Category scores (0-100 scale)
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  
  // Analysis data
  staticAnalysis: UnifiedStaticAnalysis
  aiAssessment?: UnifiedAIAssessment
  fileSizeAnalysis?: UnifiedFileSizeAnalysis
  businessTypeAnalysis?: UnifiedBusinessTypeAnalysis
  
  // Insights
  findings: string[]
  recommendations: string[]
  
  // Status
  status: {
    staticAnalysisSuccess: boolean
    aiAssessmentSuccess: boolean
    fileSizeAnalysisSuccess: boolean
    businessTypeAnalysisSuccess: boolean
    overallSuccess: boolean
  }
  
  // Metadata
  metadata: {
    processingTime: number
    retryCount: number
    errors: string[]
    version: string
  }
}

export interface UnifiedStaticAnalysis {
  // Common fields
  hasReadme: boolean
  hasContributing: boolean
  hasAgents: boolean
  hasLicense: boolean
  hasWorkflows: boolean
  hasTests: boolean
  languages: string[]
  errorHandling: boolean
  fileCount: number
  
  // Repository-specific fields
  linesOfCode?: number
  repositorySizeMB?: number
  readmeContent?: string
  contributingContent?: string
  agentsContent?: string
  workflowFiles?: string[]
  testFiles?: string[]
  
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
  headingStructure?: { [key: string]: number }
  technologies?: string[]
  securityHeaders?: string[]
  socialMediaLinks?: Array<{ platform: string; url: string }>
  contactInfo?: string[]
  navigationStructure?: string[]
}

export interface UnifiedAIAssessment {
  // Core scores (0-100 scale)
  overallScore: number
  confidence: number
  
  // Category scores (0-100 scale)
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  
  // Detailed analysis
  detailedAnalysis?: {
    instructionClarity: DetailedAnalysis
    workflowAutomation: DetailedAnalysis
    contextEfficiency: DetailedAnalysis
    riskCompliance: DetailedAnalysis
  }
  
  // Findings and recommendations
  findings: string[]
  recommendations: string[]
  
  // Metadata
  metadata: {
    model: string
    processingTime: number
    retryCount: number
    success: boolean
    error?: string
  }
}

export interface DetailedAnalysis {
  stepByStepQuality?: number
  commandClarity?: number
  environmentSetup?: number
  errorHandling?: number
  dependencySpecification?: number
  ciCdQuality?: number
  testAutomation?: number
  buildScripts?: number
  deploymentAutomation?: number
  monitoringLogging?: number
  instructionFileOptimization?: number
  codeDocumentation?: number
  apiDocumentation?: number
  contextWindowUsage?: number
  securityPractices?: number
  inputValidation?: number
  dependencySecurity?: number
  licenseCompliance?: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface UnifiedFileSizeAnalysis {
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
    totalTokens: number
    instructionTokens: number
    codeTokens: number
    documentationTokens: number
  }
  agentCompatibility: {
    cursor: 'excellent' | 'good' | 'fair' | 'poor'
    githubCopilot: 'excellent' | 'good' | 'fair' | 'poor'
    claudeWeb: 'excellent' | 'good' | 'fair' | 'poor'
    claudeApi: 'excellent' | 'good' | 'fair' | 'poor'
  }
}

export interface UnifiedBusinessTypeAnalysis {
  businessType: string
  businessTypeConfidence: number
  overallScore: number
  agenticFlows: {
    informationGathering: AgenticFlowAnalysis
    directBooking: AgenticFlowAnalysis
    faqSupport: AgenticFlowAnalysis
    taskManagement: AgenticFlowAnalysis
    personalization: AgenticFlowAnalysis
  }
  aiRelevantChecks: {
    hasStructuredData: boolean
    hasContactInfo: boolean
    hasSocialMedia: boolean
    hasPricing: boolean
    hasBooking: boolean
    hasFaq: boolean
    hasReviews: boolean
    hasLocation: boolean
    hasHours: boolean
    hasPolicies: boolean
  }
  findings: string[]
  recommendations: string[]
}

export interface AgenticFlowAnalysis {
  score: number
  weight: number
  weightedScore: number
  checks: {
    [key: string]: boolean
  }
  findings: string[]
  recommendations: string[]
}

// Legacy compatibility interfaces for gradual migration
export interface LegacyAssessmentResult {
  readinessScore: number
  aiAnalysisStatus: {
    enabled: boolean
    instructionClarity: boolean
    workflowAutomation: boolean
    contextEfficiency: boolean
    riskCompliance: boolean
    overallSuccess: boolean
  }
  staticAnalysis: any
  websiteAnalysis?: any
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
  detailedAnalysis?: any
  confidence?: any
  businessTypeAnalysis?: any
}

// Utility functions for data transformation
export class DataTransformer {
  static toUnifiedResult(legacyResult: LegacyAssessmentResult): UnifiedAssessmentResult {
    return {
      id: this.generateId(),
      type: legacyResult.websiteAnalysis ? 'website' : 'repository',
      inputUrl: '', // Will be set by caller
      timestamp: new Date(),
      overallScore: legacyResult.readinessScore,
      confidence: legacyResult.confidence?.overall || 80,
      categories: legacyResult.categories,
      staticAnalysis: this.transformStaticAnalysis(legacyResult.staticAnalysis),
      aiAssessment: this.transformAIAssessment(legacyResult),
      businessTypeAnalysis: legacyResult.businessTypeAnalysis,
      findings: legacyResult.findings,
      recommendations: legacyResult.recommendations,
      status: {
        staticAnalysisSuccess: true,
        aiAssessmentSuccess: legacyResult.aiAnalysisStatus.overallSuccess,
        fileSizeAnalysisSuccess: false,
        businessTypeAnalysisSuccess: !!legacyResult.businessTypeAnalysis,
        overallSuccess: legacyResult.aiAnalysisStatus.overallSuccess
      },
      metadata: {
        processingTime: 0,
        retryCount: 0,
        errors: [],
        version: '1.0.0'
      }
    }
  }

  static toLegacyResult(unifiedResult: UnifiedAssessmentResult): LegacyAssessmentResult {
    return {
      readinessScore: unifiedResult.overallScore,
      aiAnalysisStatus: {
        enabled: unifiedResult.aiAssessment?.metadata.success || false,
        instructionClarity: unifiedResult.status.aiAssessmentSuccess,
        workflowAutomation: unifiedResult.status.aiAssessmentSuccess,
        contextEfficiency: unifiedResult.status.aiAssessmentSuccess,
        riskCompliance: unifiedResult.status.aiAssessmentSuccess,
        overallSuccess: unifiedResult.status.overallSuccess
      },
      staticAnalysis: unifiedResult.staticAnalysis,
      websiteAnalysis: unifiedResult.type === 'website' ? unifiedResult.staticAnalysis : undefined,
      categories: unifiedResult.categories,
      findings: unifiedResult.findings,
      recommendations: unifiedResult.recommendations,
      confidence: {
        overall: unifiedResult.confidence,
        instructionClarity: unifiedResult.confidence,
        workflowAutomation: unifiedResult.confidence,
        contextEfficiency: unifiedResult.confidence,
        riskCompliance: unifiedResult.confidence
      },
      businessTypeAnalysis: unifiedResult.businessTypeAnalysis
    }
  }

  private static generateId(): string {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static transformStaticAnalysis(staticAnalysis: any): UnifiedStaticAnalysis {
    return {
      hasReadme: staticAnalysis.hasReadme || false,
      hasContributing: staticAnalysis.hasContributing || false,
      hasAgents: staticAnalysis.hasAgents || false,
      hasLicense: staticAnalysis.hasLicense || false,
      hasWorkflows: staticAnalysis.hasWorkflows || false,
      hasTests: staticAnalysis.hasTests || false,
      languages: staticAnalysis.languages || [],
      errorHandling: staticAnalysis.errorHandling || false,
      fileCount: staticAnalysis.fileCount || 0,
      linesOfCode: staticAnalysis.linesOfCode,
      repositorySizeMB: staticAnalysis.repositorySizeMB,
      readmeContent: staticAnalysis.readmeContent,
      contributingContent: staticAnalysis.contributingContent,
      agentsContent: staticAnalysis.agentsContent,
      workflowFiles: staticAnalysis.workflowFiles || [],
      testFiles: staticAnalysis.testFiles || [],
      websiteUrl: staticAnalysis.websiteUrl,
      pageTitle: staticAnalysis.pageTitle,
      metaDescription: staticAnalysis.metaDescription,
      hasStructuredData: staticAnalysis.hasStructuredData,
      hasOpenGraph: staticAnalysis.hasOpenGraph,
      hasTwitterCards: staticAnalysis.hasTwitterCards,
      hasSitemap: staticAnalysis.hasSitemap,
      hasRobotsTxt: staticAnalysis.hasRobotsTxt,
      hasFavicon: staticAnalysis.hasFavicon,
      hasManifest: staticAnalysis.hasManifest,
      hasServiceWorker: staticAnalysis.hasServiceWorker,
      pageLoadSpeed: staticAnalysis.pageLoadSpeed,
      mobileFriendly: staticAnalysis.mobileFriendly,
      accessibilityScore: staticAnalysis.accessibilityScore,
      seoScore: staticAnalysis.seoScore,
      contentLength: staticAnalysis.contentLength,
      imageCount: staticAnalysis.imageCount,
      linkCount: staticAnalysis.linkCount,
      headingStructure: staticAnalysis.headingStructure,
      technologies: staticAnalysis.technologies,
      securityHeaders: staticAnalysis.securityHeaders,
      socialMediaLinks: staticAnalysis.socialMediaLinks,
      contactInfo: staticAnalysis.contactInfo,
      navigationStructure: staticAnalysis.navigationStructure
    }
  }

  private static transformAIAssessment(legacyResult: LegacyAssessmentResult): UnifiedAIAssessment | undefined {
    if (!legacyResult.aiAnalysisStatus.enabled) {
      return undefined
    }

    return {
      overallScore: legacyResult.readinessScore,
      confidence: legacyResult.confidence?.overall || 80,
      categories: legacyResult.categories,
      detailedAnalysis: legacyResult.detailedAnalysis,
      findings: legacyResult.findings,
      recommendations: legacyResult.recommendations,
      metadata: {
        model: 'gpt-4o-mini',
        processingTime: 0,
        retryCount: 0,
        success: legacyResult.aiAnalysisStatus.overallSuccess,
        error: legacyResult.aiAnalysisStatus.overallSuccess ? undefined : 'AI assessment failed'
      }
    }
  }
}