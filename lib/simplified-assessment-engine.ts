import { analyzeRepository, analyzeWebsite, StaticAnalysisResult, WebsiteAnalysisResult } from './analyzer'
import { UnifiedAIAssessmentEngine, UnifiedAIAssessmentResult } from './unified-ai-assessment'
import { FileSizeAnalyzer } from './file-size-analyzer'

export interface SimplifiedAssessmentConfig {
  enableAIAssessment: boolean
  enableFileSizeAnalysis: boolean
  maxRetries: number
  timeout: number
}

export interface SimplifiedAssessmentResult {
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
  staticAnalysis: StaticAnalysisResult | WebsiteAnalysisResult
  aiAssessment?: UnifiedAIAssessmentResult
  fileSizeAnalysis?: any
  businessTypeAnalysis?: any
  
  // Insights
  findings: string[]
  recommendations: string[]
  
  // Status
  status: {
    staticAnalysisSuccess: boolean
    aiAssessmentSuccess: boolean
    fileSizeAnalysisSuccess: boolean
    overallSuccess: boolean
  }
  
  // Metadata
  metadata: {
    processingTime: number
    retryCount: number
    errors: string[]
  }
}

export class SimplifiedAssessmentEngine {
  private config: SimplifiedAssessmentConfig
  private aiEngine: UnifiedAIAssessmentEngine
  private fileSizeAnalyzer: FileSizeAnalyzer

  constructor(config?: Partial<SimplifiedAssessmentConfig>) {
    this.config = {
      enableAIAssessment: true,
      enableFileSizeAnalysis: true,
      maxRetries: 2,
      timeout: 30000,
      ...config
    }
    
    this.aiEngine = new UnifiedAIAssessmentEngine({
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout
    })
    
    this.fileSizeAnalyzer = new FileSizeAnalyzer()
  }

  async assessRepository(repoUrl: string): Promise<SimplifiedAssessmentResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let retryCount = 0

    try {
      // Step 1: Static Analysis
      const staticAnalysis = await analyzeRepository(repoUrl)
      
      // Step 2: File Size Analysis (if enabled)
      let fileSizeAnalysis
      if (this.config.enableFileSizeAnalysis) {
        try {
          // For now, skip file size analysis as it requires file content
          // TODO: Implement file size analysis with proper file content
          fileSizeAnalysis = null
        } catch (error) {
          errors.push(`File size analysis failed: ${(error as Error).message}`)
        }
      }

      // Step 3: AI Assessment (if enabled)
      let aiAssessment
      if (this.config.enableAIAssessment) {
        try {
          // Convert StaticAnalysisResult to StaticAnalysisSummary for AI assessment
          const staticSummary = this.convertToStaticSummary(staticAnalysis)
          aiAssessment = await this.aiEngine.assessRepository(staticSummary)
        } catch (error) {
          errors.push(`AI assessment failed: ${(error as Error).message}`)
        }
      }

      // Step 4: Combine results
      const result = this.combineResults(
        'repository',
        repoUrl,
        staticAnalysis,
        aiAssessment,
        fileSizeAnalysis,
        errors,
        undefined // No business type analysis for repositories
      )

      return {
        ...result,
        id: this.generateId(),
        metadata: {
          processingTime: Date.now() - startTime,
          retryCount,
          errors
        }
      }

    } catch (error) {
      errors.push(`Repository analysis failed: ${(error as Error).message}`)
      
      return this.createErrorResult(
        'repository',
        repoUrl,
        errors,
        Date.now() - startTime,
        retryCount
      )
    }
  }

  async assessWebsite(websiteUrl: string): Promise<SimplifiedAssessmentResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let retryCount = 0

    try {
      // Step 1: Static Analysis
      const staticAnalysis = await analyzeWebsite(websiteUrl)
      
      // Step 2: AI Assessment (if enabled)
      let aiAssessment
      if (this.config.enableAIAssessment) {
        try {
          // Convert WebsiteAnalysisResult to StaticAnalysisSummary for AI assessment
          const staticSummary = this.convertToStaticSummary(staticAnalysis)
          aiAssessment = await this.aiEngine.assessWebsite(staticSummary)
        } catch (error) {
          errors.push(`AI assessment failed: ${(error as Error).message}`)
        }
      }

      // Step 3: Extract business type analysis from website analysis
      const businessTypeAnalysis = staticAnalysis.businessType ? {
        businessType: staticAnalysis.businessType,
        businessTypeConfidence: staticAnalysis.businessTypeConfidence,
        overallScore: staticAnalysis.overallScore,
        agenticFlows: staticAnalysis.agenticFlows,
        aiRelevantChecks: staticAnalysis.aiRelevantChecks,
        findings: staticAnalysis.findings || [],
        recommendations: staticAnalysis.recommendations || []
      } : undefined

      // Step 4: Combine results
      const result = this.combineResults(
        'website',
        websiteUrl,
        staticAnalysis,
        aiAssessment,
        undefined, // No file size analysis for websites
        errors,
        businessTypeAnalysis
      )

      return {
        ...result,
        id: this.generateId(),
        metadata: {
          processingTime: Date.now() - startTime,
          retryCount,
          errors
        }
      }

    } catch (error) {
      errors.push(`Website analysis failed: ${(error as Error).message}`)
      
      return this.createErrorResult(
        'website',
        websiteUrl,
        errors,
        Date.now() - startTime,
        retryCount
      )
    }
  }

  private combineResults(
    type: 'repository' | 'website',
    inputUrl: string,
    staticAnalysis: StaticAnalysisResult | WebsiteAnalysisResult,
    aiAssessment?: UnifiedAIAssessmentResult,
    fileSizeAnalysis?: any,
    errors: string[] = [],
    businessTypeAnalysis?: any
  ): Omit<SimplifiedAssessmentResult, 'metadata'> {
    
    // Determine overall score and categories
    let overallScore: number
    let confidence: number
    let categories: SimplifiedAssessmentResult['categories']
    let findings: string[]
    let recommendations: string[]

    if (aiAssessment && aiAssessment.metadata.success) {
      // Use AI assessment as primary source
      overallScore = aiAssessment.overallScore
      confidence = aiAssessment.confidence
      categories = aiAssessment.categories
      findings = aiAssessment.findings
      recommendations = aiAssessment.recommendations
    } else {
      // Fallback to static analysis
      const staticScore = this.calculateStaticScore(staticAnalysis, type)
      overallScore = staticScore.overall
      confidence = 60 // Lower confidence for static-only
      categories = staticScore.categories
      findings = this.generateStaticFindings(staticAnalysis, type)
      recommendations = this.generateStaticRecommendations(staticAnalysis, type)
    }

    // Add file size findings if available
    if (fileSizeAnalysis && type === 'repository') {
      findings.push(...this.generateFileSizeFindings(fileSizeAnalysis))
      recommendations.push(...this.generateFileSizeRecommendations(fileSizeAnalysis))
    }

    return {
      id: this.generateId(),
      type,
      inputUrl,
      timestamp: new Date(),
      overallScore,
      confidence,
      categories,
      staticAnalysis,
      aiAssessment,
      fileSizeAnalysis,
      businessTypeAnalysis,
      findings: findings.slice(0, 10), // Limit to top 10
      recommendations: recommendations.slice(0, 10),
      status: {
        staticAnalysisSuccess: true,
        aiAssessmentSuccess: aiAssessment?.metadata.success || false,
        fileSizeAnalysisSuccess: !!fileSizeAnalysis,
        businessTypeAnalysisSuccess: !!businessTypeAnalysis,
        overallSuccess: errors.length === 0
      }
    }
  }

  private calculateStaticScore(
    staticAnalysis: StaticAnalysisResult | WebsiteAnalysisResult,
    type: 'repository' | 'website'
  ): { overall: number; categories: SimplifiedAssessmentResult['categories'] } {
    
    if (type === 'repository') {
      const repoAnalysis = staticAnalysis as StaticAnalysisResult
      
      const documentation = this.scoreDocumentation(repoAnalysis)
      const instructionClarity = repoAnalysis.hasAgents ? 80 : 40
      const workflowAutomation = this.scoreWorkflowAutomation(repoAnalysis)
      const riskCompliance = this.scoreRiskCompliance(repoAnalysis)
      const integrationStructure = this.scoreIntegrationStructure(repoAnalysis)
      const fileSizeOptimization = 50 // Neutral for static analysis

      const overall = Math.round(
        (documentation + instructionClarity + workflowAutomation + 
         riskCompliance + integrationStructure + fileSizeOptimization) / 6
      )

      return {
        overall,
        categories: {
          documentation,
          instructionClarity,
          workflowAutomation,
          riskCompliance,
          integrationStructure,
          fileSizeOptimization
        }
      }
    } else {
      const websiteAnalysis = staticAnalysis as WebsiteAnalysisResult
      
      // Use business-type-aware scoring if available
      if ('overallScore' in websiteAnalysis && typeof websiteAnalysis.overallScore === 'number') {
        return {
          overall: websiteAnalysis.overallScore,
          categories: {
            documentation: websiteAnalysis.agenticFlows?.informationGathering?.score || 50,
            instructionClarity: websiteAnalysis.agenticFlows?.directBooking?.score || 50,
            workflowAutomation: websiteAnalysis.agenticFlows?.taskManagement?.score || 50,
            riskCompliance: websiteAnalysis.agenticFlows?.faqSupport?.score || 50,
            integrationStructure: websiteAnalysis.agenticFlows?.personalization?.score || 50,
            fileSizeOptimization: 50
          }
        }
      }

      // Fallback to basic website scoring
      const hasStructuredData = websiteAnalysis.hasStructuredData || false
      const hasContactInfo = (websiteAnalysis.contactInfo?.length || 0) > 0
      const hasSocialMedia = (websiteAnalysis.socialMediaLinks?.length || 0) > 0

      const overall = Math.round(
        (hasStructuredData ? 80 : 40) +
        (hasContactInfo ? 70 : 30) +
        (hasSocialMedia ? 60 : 40)
      ) / 3

      return {
        overall,
        categories: {
          documentation: hasStructuredData ? 80 : 40,
          instructionClarity: hasContactInfo ? 70 : 30,
          workflowAutomation: 50,
          riskCompliance: 50,
          integrationStructure: hasSocialMedia ? 60 : 40,
          fileSizeOptimization: 50
        }
      }
    }
  }

  private scoreDocumentation(analysis: StaticAnalysisResult): number {
    let score = 0
    if (analysis.hasReadme) score += 30
    if (analysis.hasContributing) score += 20
    if (analysis.hasAgents) score += 30
    if (analysis.hasLicense) score += 20
    return Math.min(100, score)
  }

  private scoreWorkflowAutomation(analysis: StaticAnalysisResult): number {
    let score = 0
    if (analysis.hasWorkflows) score += 50
    if (analysis.hasTests) score += 30
    if (analysis.errorHandling) score += 20
    return Math.min(100, score)
  }

  private scoreRiskCompliance(analysis: StaticAnalysisResult): number {
    let score = 0
    if (analysis.errorHandling) score += 40
    if (analysis.hasLicense) score += 30
    if (analysis.hasTests) score += 30
    return Math.min(100, score)
  }

  private scoreIntegrationStructure(analysis: StaticAnalysisResult): number {
    let score = 0
    if (analysis.languages.length > 0) score += 30
    if (analysis.fileCount > 0) score += 20
    if (analysis.hasWorkflows) score += 30
    if (analysis.errorHandling) score += 20
    return Math.min(100, score)
  }

  private generateStaticFindings(
    staticAnalysis: StaticAnalysisResult | WebsiteAnalysisResult,
    type: 'repository' | 'website'
  ): string[] {
    const findings: string[] = []

    if (type === 'repository') {
      const repoAnalysis = staticAnalysis as StaticAnalysisResult
      
      if (!repoAnalysis.hasReadme) findings.push('Missing README.md file')
      if (!repoAnalysis.hasContributing) findings.push('Missing CONTRIBUTING.md file')
      if (!repoAnalysis.hasAgents) findings.push('Missing AGENTS.md file for AI agent instructions')
      if (!repoAnalysis.hasLicense) findings.push('Missing LICENSE file')
      if (!repoAnalysis.hasWorkflows) findings.push('No CI/CD workflows detected')
      if (!repoAnalysis.hasTests) findings.push('No test files detected')
      if (!repoAnalysis.errorHandling) findings.push('Limited error handling detected')
    } else {
      const websiteAnalysis = staticAnalysis as WebsiteAnalysisResult
      
      if (!websiteAnalysis.hasStructuredData) findings.push('No structured data (JSON-LD) found')
      if (!websiteAnalysis.contactInfo?.length) findings.push('No contact information found')
      if (!websiteAnalysis.socialMediaLinks?.length) findings.push('No social media links found')
    }

    return findings.length > 0 ? findings : ['Analysis completed successfully']
  }

  private generateStaticRecommendations(
    staticAnalysis: StaticAnalysisResult | WebsiteAnalysisResult,
    type: 'repository' | 'website'
  ): string[] {
    const recommendations: string[] = []

    if (type === 'repository') {
      const repoAnalysis = staticAnalysis as StaticAnalysisResult
      
      if (!repoAnalysis.hasReadme) recommendations.push('Create a comprehensive README.md file')
      if (!repoAnalysis.hasContributing) recommendations.push('Add CONTRIBUTING.md with contribution guidelines')
      if (!repoAnalysis.hasAgents) recommendations.push('Create AGENTS.md with AI agent instructions')
      if (!repoAnalysis.hasLicense) recommendations.push('Add a LICENSE file')
      if (!repoAnalysis.hasWorkflows) recommendations.push('Set up CI/CD workflows')
      if (!repoAnalysis.hasTests) recommendations.push('Add test files and test automation')
    } else {
      const websiteAnalysis = staticAnalysis as WebsiteAnalysisResult
      
      if (!websiteAnalysis.hasStructuredData) recommendations.push('Add structured data (JSON-LD) for better AI parsing')
      if (!websiteAnalysis.contactInfo?.length) recommendations.push('Add clear contact information')
      if (!websiteAnalysis.socialMediaLinks?.length) recommendations.push('Add social media links')
    }

    return recommendations.length > 0 ? recommendations : ['Consider enabling AI assessment for detailed recommendations']
  }

  private generateFileSizeFindings(fileSizeAnalysis: any): string[] {
    const findings: string[] = []
    
    if (fileSizeAnalysis.largeFiles?.length > 0) {
      findings.push(`${fileSizeAnalysis.largeFiles.length} large files detected that may impact AI agent performance`)
    }
    
    if (fileSizeAnalysis.criticalFiles?.some((f: any) => !f.isOptimal)) {
      findings.push('Some critical files exceed optimal size for AI agent processing')
    }
    
    return findings
  }

  private generateFileSizeRecommendations(fileSizeAnalysis: any): string[] {
    const recommendations: string[] = []
    
    if (fileSizeAnalysis.largeFiles?.length > 0) {
      recommendations.push('Consider splitting large files or using alternative storage for large assets')
    }
    
    if (fileSizeAnalysis.criticalFiles?.some((f: any) => !f.isOptimal)) {
      recommendations.push('Optimize critical files (README, AGENTS.md) for better AI agent compatibility')
    }
    
    return recommendations
  }

  private createErrorResult(
    type: 'repository' | 'website',
    inputUrl: string,
    errors: string[],
    processingTime: number,
    retryCount: number
  ): SimplifiedAssessmentResult {
    return {
      id: this.generateId(),
      type,
      inputUrl,
      timestamp: new Date(),
      overallScore: 0,
      confidence: 0,
      categories: {
        documentation: 0,
        instructionClarity: 0,
        workflowAutomation: 0,
        riskCompliance: 0,
        integrationStructure: 0,
        fileSizeOptimization: 0
      },
      staticAnalysis: {} as any,
      findings: ['Analysis failed'],
      recommendations: ['Check input URL and try again'],
      status: {
        staticAnalysisSuccess: false,
        aiAssessmentSuccess: false,
        fileSizeAnalysisSuccess: false,
        overallSuccess: false
      },
      metadata: {
        processingTime,
        retryCount,
        errors
      }
    }
  }

  private generateId(): string {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private convertToStaticSummary(analysis: StaticAnalysisResult | WebsiteAnalysisResult): any {
    // Convert to StaticAnalysisSummary format expected by AI assessment
    return {
      hasReadme: 'hasReadme' in analysis ? analysis.hasReadme : false,
      hasContributing: 'hasContributing' in analysis ? analysis.hasContributing : false,
      hasAgents: 'hasAgents' in analysis ? analysis.hasAgents : false,
      hasLicense: 'hasLicense' in analysis ? analysis.hasLicense : false,
      hasWorkflows: 'hasWorkflows' in analysis ? analysis.hasWorkflows : false,
      hasTests: 'hasTests' in analysis ? analysis.hasTests : false,
      languages: 'languages' in analysis ? analysis.languages : [],
      errorHandling: 'errorHandling' in analysis ? analysis.errorHandling : false,
      fileCount: 'fileCount' in analysis ? analysis.fileCount : 0,
      linesOfCode: 'linesOfCode' in analysis ? analysis.linesOfCode : 0,
      repositorySizeMB: 'repositorySizeMB' in analysis ? analysis.repositorySizeMB : 0,
      readmeContent: 'readmeContent' in analysis ? analysis.readmeContent : undefined,
      contributingContent: 'contributingContent' in analysis ? analysis.contributingContent : undefined,
      agentsContent: 'agentsContent' in analysis ? analysis.agentsContent : undefined,
      workflowFiles: 'workflowFiles' in analysis ? analysis.workflowFiles : [],
      testFiles: 'testFiles' in analysis ? analysis.testFiles : [],
      // Website-specific fields
      websiteUrl: 'websiteUrl' in analysis ? analysis.websiteUrl : undefined,
      pageTitle: 'pageTitle' in analysis ? analysis.pageTitle : undefined,
      metaDescription: 'metaDescription' in analysis ? analysis.metaDescription : undefined,
      hasStructuredData: 'hasStructuredData' in analysis ? analysis.hasStructuredData : undefined,
      hasOpenGraph: 'hasOpenGraph' in analysis ? analysis.hasOpenGraph : undefined,
      hasTwitterCards: 'hasTwitterCards' in analysis ? analysis.hasTwitterCards : undefined,
      hasSitemap: 'hasSitemap' in analysis ? analysis.hasSitemap : undefined,
      hasRobotsTxt: 'hasRobotsTxt' in analysis ? analysis.hasRobotsTxt : undefined,
      hasFavicon: 'hasFavicon' in analysis ? analysis.hasFavicon : undefined,
      hasManifest: 'hasManifest' in analysis ? analysis.hasManifest : undefined,
      hasServiceWorker: 'hasServiceWorker' in analysis ? analysis.hasServiceWorker : undefined,
      pageLoadSpeed: 'pageLoadSpeed' in analysis ? analysis.pageLoadSpeed : undefined,
      mobileFriendly: 'mobileFriendly' in analysis ? analysis.mobileFriendly : undefined,
      accessibilityScore: 'accessibilityScore' in analysis ? analysis.accessibilityScore : undefined,
      seoScore: 'seoScore' in analysis ? analysis.seoScore : undefined,
      contentLength: 'contentLength' in analysis ? analysis.contentLength : undefined,
      imageCount: 'imageCount' in analysis ? analysis.imageCount : undefined,
      linkCount: 'linkCount' in analysis ? analysis.linkCount : undefined,
      headingStructure: 'headingStructure' in analysis ? analysis.headingStructure : undefined,
      technologies: 'technologies' in analysis ? analysis.technologies : undefined,
      securityHeaders: 'securityHeaders' in analysis ? analysis.securityHeaders : undefined,
      socialMediaLinks: 'socialMediaLinks' in analysis ? analysis.socialMediaLinks : undefined,
      contactInfo: 'contactInfo' in analysis ? analysis.contactInfo : undefined,
      navigationStructure: 'navigationStructure' in analysis ? analysis.navigationStructure : undefined
    }
  }
}