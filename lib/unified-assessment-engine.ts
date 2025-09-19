/**
 * Unified Assessment Engine
 * 
 * Replaces aligned-assessment-engine.ts with a simplified, unified approach
 * that handles both repository and website analysis through a single interface.
 */

import { 
  AssessmentInput, 
  AssessmentResult, 
  AssessmentOptions,
  AnalysisData,
  AnalysisType,
  UnifiedAssessmentConfig,
  LegacyAssessmentResult,
  Score,
  CategoryScores,
  ConfidenceScores,
  AssessmentMetadata,
  Finding,
  Recommendation
} from './unified-types'
import { analyzeRepository, analyzeWebsite } from './analyzer'
import { generateUnifiedAIAssessment } from './unified-ai-assessment'
import { generateAIReadinessInsights } from './business-type-analyzer'
import { FileSizeAnalyzer } from './file-size-analyzer'

export class UnifiedAssessmentEngine {
  private config: UnifiedAssessmentConfig

  constructor(config?: Partial<UnifiedAssessmentConfig>) {
    this.config = {
      enableAIAssessment: true,
      enableValidation: true,
      requireAlignment: false,
      maxRetries: 2,
      fallbackToStatic: true,
      timeout: 30000,
      includeDetailedAnalysis: true,
      metricsConfig: {
        scoringScale: 100,
        categoryWeights: {
          documentation: 0.2,
          instructionClarity: 0.2,
          workflowAutomation: 0.2,
          riskCompliance: 0.2,
          integrationStructure: 0.1,
          fileSizeOptimization: 0.1
        },
        confidenceThresholds: {
          high: 0.8,
          medium: 0.6,
          low: 0.4
        },
        validationRules: []
      },
      ...config
    }
  }

  /**
   * Main assessment method - unified entry point for all assessments
   */
  async assess(input: AssessmentInput): Promise<AssessmentResult> {
    const startTime = Date.now()
    let retryCount = 0
    let errors: any[] = []
    let warnings: any[] = []

    try {
      // Step 1: Perform static analysis
      const analysisData = await this.performStaticAnalysis(input)
      
      // Step 2: Perform AI assessment (if enabled)
      let aiAssessment
      if (this.config.enableAIAssessment) {
        try {
          aiAssessment = await generateUnifiedAIAssessment(
            analysisData, 
            input.type, 
            input.options
          )
        } catch (error) {
          console.warn('AI assessment failed, continuing with static analysis only:', error)
          errors.push({
            code: 'AI_ASSESSMENT_FAILED',
            message: 'AI assessment failed, using static analysis only',
            category: 'ai',
            timestamp: new Date(),
            recoverable: true
          })
        }
      }

      // Step 3: Generate scores
      const scores = this.generateScores(analysisData, aiAssessment)

      // Step 4: Generate insights
      const findings = this.generateFindings(analysisData, aiAssessment)
      const recommendations = this.generateRecommendations(analysisData, aiAssessment)

      // Step 5: Create result
      const result: AssessmentResult = {
        id: this.generateId(),
        type: input.type,
        url: input.url,
        timestamp: new Date(),
        scores,
        analysis: analysisData,
        aiAssessment,
        findings,
        recommendations,
        metadata: {
          version: '1.0.0',
          analysisTime: Date.now() - startTime,
          staticAnalysisTime: 0, // Will be set by static analysis
          aiAnalysisTime: aiAssessment ? Date.now() - startTime : undefined,
          totalAnalysisTime: Date.now() - startTime,
          retryCount,
          fallbackUsed: !aiAssessment,
          errors,
          warnings
        }
      }

      return result

    } catch (error) {
      console.error('Assessment failed:', error)
      
      // Generate fallback result
      return this.generateFallbackResult(input, error as Error, startTime)
    }
  }

  /**
   * Perform static analysis based on input type
   */
  private async performStaticAnalysis(input: AssessmentInput): Promise<AnalysisData> {
    const startTime = Date.now()
    
    try {
      if (input.type === 'repository') {
        const repositoryData = await analyzeRepository(input.url)
        // Convert StaticAnalysisResult to RepositoryAnalysisData
        const convertedRepoData = {
          hasReadme: repositoryData.hasReadme,
          hasContributing: repositoryData.hasContributing,
          hasAgents: repositoryData.hasAgents,
          hasLicense: repositoryData.hasLicense,
          hasWorkflows: repositoryData.hasWorkflows,
          hasTests: repositoryData.hasTests,
          languages: repositoryData.languages,
          errorHandling: repositoryData.errorHandling,
          fileCount: repositoryData.fileCount,
          linesOfCode: repositoryData.linesOfCode || 0,
          repositorySizeMB: repositoryData.repositorySizeMB || 0,
          readmeContent: repositoryData.readmeContent,
          contributingContent: repositoryData.contributingContent,
          agentsContent: repositoryData.agentsContent,
          workflowFiles: repositoryData.workflowFiles,
          testFiles: repositoryData.testFiles,
          fileSizeAnalysis: repositoryData.fileSizeAnalysis ? this.convertFileSizeAnalysis(repositoryData.fileSizeAnalysis) : undefined
        }
        
        return {
          repository: convertedRepoData
        }
      } else {
        const websiteData = await analyzeWebsite(input.url)
        // Convert WebsiteAnalysisResult to WebsiteAnalysisData
        const convertedWebsiteData = {
          url: websiteData.websiteUrl,
          pageTitle: websiteData.pageTitle,
          metaDescription: websiteData.metaDescription,
          hasStructuredData: websiteData.hasStructuredData,
          hasOpenGraph: websiteData.hasOpenGraph,
          hasTwitterCards: websiteData.hasTwitterCards,
          hasSitemap: websiteData.hasSitemap || false,
          hasRobotsTxt: websiteData.hasRobotsTxt || false,
          hasFavicon: false, // Not available in WebsiteAnalysisResult
          hasManifest: false, // Not available in WebsiteAnalysisResult
          hasServiceWorker: false, // Not available in WebsiteAnalysisResult
          contentLength: websiteData.contentLength,
          technologies: websiteData.technologies,
          contactInfo: websiteData.contactInfo,
          socialMediaLinks: websiteData.socialMediaLinks,
          locations: websiteData.locations,
          agentReadinessFeatures: {
            informationGathering: { score: 0, maxScore: 100, details: [], missing: [] },
            directBooking: { score: 0, maxScore: 100, details: [], missing: [] },
            faqSupport: { score: 0, maxScore: 100, details: [], missing: [] },
            taskManagement: { score: 0, maxScore: 100, details: [], missing: [] },
            personalization: { score: 0, maxScore: 100, details: [], missing: [] }
          }
        }
        
        // Generate business type analysis
        const businessTypeData = {
          businessType: websiteData.businessType || 'unknown',
          businessTypeConfidence: websiteData.businessTypeConfidence || 0,
          overallScore: websiteData.overallScore || 0,
          industrySpecificInsights: websiteData.findings || [],
          recommendations: websiteData.recommendations || []
        }
        
        return {
          website: convertedWebsiteData,
          businessType: businessTypeData
        }
      }
    } catch (error) {
      console.warn('Static analysis failed, using empty data:', error)
      // Return empty analysis data instead of throwing
      if (input.type === 'repository') {
        return {
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
            readmeContent: undefined,
            contributingContent: undefined,
            agentsContent: undefined,
            workflowFiles: [],
            testFiles: []
          }
        }
      } else {
        return {
          website: {
            url: input.url,
            pageTitle: undefined,
            metaDescription: undefined,
            hasStructuredData: false,
            hasOpenGraph: false,
            hasTwitterCards: false,
            hasSitemap: false,
            hasRobotsTxt: false,
            hasFavicon: false,
            hasManifest: false,
            hasServiceWorker: false,
            contentLength: 0,
            technologies: [],
            contactInfo: [],
            socialMediaLinks: [],
            locations: [],
            agentReadinessFeatures: {
              informationGathering: { score: 0, maxScore: 100, details: [], missing: [] },
              directBooking: { score: 0, maxScore: 100, details: [], missing: [] },
              faqSupport: { score: 0, maxScore: 100, details: [], missing: [] },
              taskManagement: { score: 0, maxScore: 100, details: [], missing: [] },
              personalization: { score: 0, maxScore: 100, details: [], missing: [] }
            }
          },
          businessType: {
            businessType: 'unknown',
            businessTypeConfidence: 0,
            overallScore: 0,
            industrySpecificInsights: [],
            recommendations: []
          }
        }
      }
    }
  }

  /**
   * Generate unified scores from analysis data
   */
  private generateScores(analysisData: AnalysisData, aiAssessment?: any): {
    overall: Score
    categories: CategoryScores
    confidence: ConfidenceScores
  } {
    const categories = this.calculateCategoryScores(analysisData, aiAssessment)
    const overall = this.calculateOverallScore(categories)
    const confidence = this.calculateConfidenceScores(analysisData, aiAssessment)

    return {
      overall,
      categories,
      confidence
    }
  }

  /**
   * Calculate category scores
   */
  private calculateCategoryScores(analysisData: AnalysisData, aiAssessment?: any): CategoryScores {
    const baseScores = this.calculateBaseCategoryScores(analysisData)
    const aiScores = aiAssessment ? this.calculateAICategoryScores(aiAssessment) : null

    // Combine base and AI scores
    const categories: CategoryScores = {
      documentation: this.combineScores(baseScores.documentation, aiScores?.documentation),
      instructionClarity: this.combineScores(baseScores.instructionClarity, aiScores?.instructionClarity),
      workflowAutomation: this.combineScores(baseScores.workflowAutomation, aiScores?.workflowAutomation),
      riskCompliance: this.combineScores(baseScores.riskCompliance, aiScores?.riskCompliance),
      integrationStructure: this.combineScores(baseScores.integrationStructure, aiScores?.integrationStructure),
      fileSizeOptimization: this.combineScores(baseScores.fileSizeOptimization, aiScores?.fileSizeOptimization)
    }

    // Add website-specific categories if applicable
    if (analysisData.website) {
      categories.informationArchitecture = this.calculateInformationArchitectureScore(analysisData.website)
      categories.machineReadableContent = this.calculateMachineReadableContentScore(analysisData.website)
      categories.conversationalQueryReadiness = this.calculateConversationalQueryReadinessScore(analysisData.website)
      categories.actionOrientedFunctionality = this.calculateActionOrientedFunctionalityScore(analysisData.website)
      categories.personalizationContextAwareness = this.calculatePersonalizationContextAwarenessScore(analysisData.website)
    }

    return categories
  }

  /**
   * Calculate base category scores from static analysis
   */
  private calculateBaseCategoryScores(analysisData: AnalysisData): Partial<CategoryScores> {
    const scores: Partial<CategoryScores> = {}

    if (analysisData.repository) {
      const repo = analysisData.repository
      
      // Documentation score (0-100)
      let docScore = 0
      if (repo.hasReadme) docScore += 25
      if (repo.hasContributing) docScore += 25
      if (repo.hasAgents) docScore += 30
      if (repo.hasLicense) docScore += 20
      scores.documentation = this.createScore(docScore, 100)

      // Instruction Clarity score (0-100)
      let clarityScore = 0
      if (repo.readmeContent && repo.readmeContent.length > 500) clarityScore += 40
      if (repo.agentsContent && repo.agentsContent.length > 200) clarityScore += 40
      if (repo.contributingContent && repo.contributingContent.length > 300) clarityScore += 20
      scores.instructionClarity = this.createScore(clarityScore, 100)

      // Workflow Automation score (0-100)
      let automationScore = 0
      if (repo.hasWorkflows) automationScore += 50
      if (repo.hasTests) automationScore += 30
      if (repo.workflowFiles.length > 0) automationScore += 20
      scores.workflowAutomation = this.createScore(automationScore, 100)

      // Risk & Compliance score (0-100)
      let riskScore = 0
      if (repo.hasLicense) riskScore += 30
      if (repo.errorHandling) riskScore += 40
      if (repo.languages.length > 0) riskScore += 30
      scores.riskCompliance = this.createScore(riskScore, 100)

      // Integration Structure score (0-100)
      let integrationScore = 0
      if (repo.fileCount > 10) integrationScore += 20
      if (repo.languages.length > 0) integrationScore += 30
      if (repo.errorHandling) integrationScore += 30
      if (repo.hasTests) integrationScore += 20
      scores.integrationStructure = this.createScore(integrationScore, 100)

      // File Size Optimization score (0-100)
      let fileSizeScore = 100
      if (repo.repositorySizeMB > 50) fileSizeScore -= 20
      if (repo.repositorySizeMB > 100) fileSizeScore -= 30
      if (repo.repositorySizeMB > 500) fileSizeScore -= 50
      scores.fileSizeOptimization = this.createScore(Math.max(0, fileSizeScore), 100)
    }

    return scores
  }

  /**
   * Calculate AI category scores
   */
  private calculateAICategoryScores(aiAssessment: any): Partial<CategoryScores> {
    const scores: Partial<CategoryScores> = {}

    if (aiAssessment.detailedAnalysis) {
      const analysis = aiAssessment.detailedAnalysis
      
      scores.instructionClarity = this.createScore(
        this.averageScore([
          analysis.instructionClarity?.stepByStepQuality || 0,
          analysis.instructionClarity?.commandClarity || 0,
          analysis.instructionClarity?.environmentSetup || 0,
          analysis.instructionClarity?.errorHandling || 0,
          analysis.instructionClarity?.dependencySpecification || 0
        ]),
        100
      )

      scores.workflowAutomation = this.createScore(
        this.averageScore([
          analysis.workflowAutomation?.ciCdQuality || 0,
          analysis.workflowAutomation?.testAutomation || 0,
          analysis.workflowAutomation?.buildScripts || 0,
          analysis.workflowAutomation?.deploymentAutomation || 0,
          analysis.workflowAutomation?.monitoringLogging || 0
        ]),
        100
      )

      scores.riskCompliance = this.createScore(
        this.averageScore([
          analysis.riskCompliance?.securityPractices || 0,
          analysis.riskCompliance?.complianceAlignment || 0,
          analysis.riskCompliance?.safetyGuidelines || 0,
          analysis.riskCompliance?.governanceDocumentation || 0
        ]),
        100
      )

      scores.integrationStructure = this.createScore(
        this.averageScore([
          analysis.integrationStructure?.codeOrganization || 0,
          analysis.integrationStructure?.modularity || 0,
          analysis.integrationStructure?.apiDesign || 0,
          analysis.integrationStructure?.dependencies || 0
        ]),
        100
      )

      scores.fileSizeOptimization = this.createScore(
        this.averageScore([
          analysis.fileSizeOptimization?.criticalFileCompliance || 0,
          analysis.fileSizeOptimization?.largeFileManagement || 0,
          analysis.fileSizeOptimization?.contextWindowOptimization || 0,
          analysis.fileSizeOptimization?.agentCompatibility || 0
        ]),
        100
      )
    }

    return scores
  }

  /**
   * Calculate website-specific category scores
   */
  private calculateInformationArchitectureScore(websiteData: any): Score {
    let score = 0
    if (websiteData.contactInfo.length > 0) score += 25
    if (websiteData.locations.length > 0) score += 25
    if (websiteData.pageTitle) score += 25
    if (websiteData.metaDescription) score += 25
    return this.createScore(score, 100)
  }

  private calculateMachineReadableContentScore(websiteData: any): Score {
    let score = 0
    if (websiteData.hasStructuredData) score += 30
    if (websiteData.hasOpenGraph) score += 20
    if (websiteData.hasTwitterCards) score += 20
    if (websiteData.hasSitemap) score += 15
    if (websiteData.hasRobotsTxt) score += 15
    return this.createScore(score, 100)
  }

  private calculateConversationalQueryReadinessScore(websiteData: any): Score {
    let score = 0
    if (websiteData.contentLength > 1000) score += 30
    if (websiteData.technologies.length > 0) score += 20
    if (websiteData.agentReadinessFeatures?.faqSupport?.score > 0) score += 30
    if (websiteData.agentReadinessFeatures?.informationGathering?.score > 0) score += 20
    return this.createScore(score, 100)
  }

  private calculateActionOrientedFunctionalityScore(websiteData: any): Score {
    let score = 0
    if (websiteData.agentReadinessFeatures?.directBooking?.score > 0) score += 40
    if (websiteData.agentReadinessFeatures?.taskManagement?.score > 0) score += 30
    if (websiteData.contactInfo.length > 0) score += 30
    return this.createScore(score, 100)
  }

  private calculatePersonalizationContextAwarenessScore(websiteData: any): Score {
    let score = 0
    if (websiteData.agentReadinessFeatures?.personalization?.score > 0) score += 50
    if (websiteData.socialMediaLinks.length > 0) score += 25
    if (websiteData.locations.length > 0) score += 25
    return this.createScore(score, 100)
  }

  /**
   * Calculate overall score from category scores
   */
  private calculateOverallScore(categories: CategoryScores): Score {
    const weights = this.config.metricsConfig.categoryWeights
    let weightedSum = 0
    let totalWeight = 0

    Object.entries(categories).forEach(([key, score]) => {
      if (score && weights[key]) {
        weightedSum += score.value * weights[key]
        totalWeight += weights[key]
      }
    })

    const value = totalWeight > 0 ? weightedSum / totalWeight : 0
    return this.createScore(value, 100)
  }

  /**
   * Calculate confidence scores
   */
  private calculateConfidenceScores(analysisData: AnalysisData, aiAssessment?: any): ConfidenceScores {
    const staticConfidence = this.calculateStaticAnalysisConfidence(analysisData)
    const aiConfidence = aiAssessment ? this.calculateAIAssessmentConfidence(aiAssessment) : 0
    const overallConfidence = aiAssessment ? (staticConfidence + aiConfidence) / 2 : staticConfidence

    return {
      overall: overallConfidence,
      staticAnalysis: staticConfidence,
      aiAssessment: aiConfidence,
      businessTypeAnalysis: analysisData.businessType?.businessTypeConfidence || 0
    }
  }

  /**
   * Calculate static analysis confidence
   */
  private calculateStaticAnalysisConfidence(analysisData: AnalysisData): number {
    let confidence = 0.5 // Base confidence

    if (analysisData.repository) {
      const repo = analysisData.repository
      if (repo.fileCount > 0) confidence += 0.2
      if (repo.hasReadme) confidence += 0.1
      if (repo.hasAgents) confidence += 0.1
      if (repo.hasWorkflows) confidence += 0.1
    }

    if (analysisData.website) {
      const website = analysisData.website
      if (website.contentLength > 0) confidence += 0.2
      if (website.hasStructuredData) confidence += 0.1
      if (website.contactInfo.length > 0) confidence += 0.1
      if (website.technologies.length > 0) confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Calculate AI assessment confidence
   */
  private calculateAIAssessmentConfidence(aiAssessment: any): number {
    if (!aiAssessment.detailedAnalysis) return 0.5

    const analysis = aiAssessment.detailedAnalysis
    const confidences = [
      analysis.instructionClarity?.confidence || 0,
      analysis.workflowAutomation?.confidence || 0,
      analysis.contextEfficiency?.confidence || 0,
      analysis.riskCompliance?.confidence || 0,
      analysis.integrationStructure?.confidence || 0,
      analysis.fileSizeOptimization?.confidence || 0
    ]

    return this.averageScore(confidences) / 100
  }

  /**
   * Generate findings from analysis data
   */
  private generateFindings(analysisData: AnalysisData, aiAssessment?: any): Finding[] {
    const findings: Finding[] = []

    // Static analysis findings
    if (analysisData.repository) {
      const repo = analysisData.repository
      
      if (!repo.hasReadme) {
        findings.push({
          id: 'missing-readme',
          category: 'documentation',
          severity: 'high',
          title: 'Missing README.md',
          description: 'Repository lacks a README.md file',
          evidence: ['No README.md found'],
          impact: 'High impact on AI agent understanding',
          confidence: 1.0
        })
      }

      if (!repo.hasAgents) {
        findings.push({
          id: 'missing-agents',
          category: 'documentation',
          severity: 'medium',
          title: 'Missing AGENTS.md',
          description: 'Repository lacks AI agent specific documentation',
          evidence: ['No AGENTS.md found'],
          impact: 'Medium impact on AI agent readiness',
          confidence: 1.0
        })
      }

      if (!repo.hasWorkflows) {
        findings.push({
          id: 'missing-workflows',
          category: 'workflowAutomation',
          severity: 'medium',
          title: 'No CI/CD Workflows',
          description: 'Repository lacks automated workflows',
          evidence: ['No .github/workflows found'],
          impact: 'Medium impact on automation potential',
          confidence: 1.0
        })
      }
    }

    // AI assessment findings
    if (aiAssessment?.detailedAnalysis) {
      const analysis = aiAssessment.detailedAnalysis
      
      if (analysis.instructionClarity?.findings) {
        analysis.instructionClarity.findings.forEach((finding: string, index: number) => {
          findings.push({
            id: `ai-instruction-${index}`,
            category: 'instructionClarity',
            severity: 'medium',
            title: 'Instruction Clarity Issue',
            description: finding,
            evidence: ['AI analysis'],
            impact: 'Medium impact on AI agent understanding',
            confidence: analysis.instructionClarity.confidence / 100
          })
        })
      }
    }

    return findings
  }

  /**
   * Generate recommendations from analysis data
   */
  private generateRecommendations(analysisData: AnalysisData, aiAssessment?: any): Recommendation[] {
    const recommendations: Recommendation[] = []

    // Static analysis recommendations
    if (analysisData.repository) {
      const repo = analysisData.repository
      
      if (!repo.hasReadme) {
        recommendations.push({
          id: 'add-readme',
          category: 'documentation',
          priority: 'high',
          title: 'Add README.md',
          description: 'Create a comprehensive README.md file',
          implementation: [
            'Create README.md in repository root',
            'Include project description and purpose',
            'Add installation and usage instructions',
            'Include examples and screenshots'
          ],
          impact: 'Significantly improves AI agent understanding',
          effort: 'low',
          timeline: '1-2 days'
        })
      }

      if (!repo.hasAgents) {
        recommendations.push({
          id: 'add-agents',
          category: 'documentation',
          priority: 'medium',
          title: 'Add AGENTS.md',
          description: 'Create AI agent specific documentation',
          implementation: [
            'Create AGENTS.md in repository root',
            'Include step-by-step instructions for AI agents',
            'Document common tasks and workflows',
            'Add troubleshooting and error handling'
          ],
          impact: 'Improves AI agent readiness',
          effort: 'medium',
          timeline: '3-5 days'
        })
      }
    }

    // AI assessment recommendations
    if (aiAssessment?.detailedAnalysis) {
      const analysis = aiAssessment.detailedAnalysis
      
      if (analysis.instructionClarity?.recommendations) {
        analysis.instructionClarity.recommendations.forEach((rec: string, index: number) => {
          recommendations.push({
            id: `ai-instruction-rec-${index}`,
            category: 'instructionClarity',
            priority: 'medium',
            title: 'Improve Instruction Clarity',
            description: rec,
            implementation: ['Review and update documentation'],
            impact: 'Improves AI agent understanding',
            effort: 'medium',
            timeline: '2-3 days'
          })
        })
      }
    }

    return recommendations
  }

  /**
   * Generate fallback result when assessment fails
   */
  private generateFallbackResult(input: AssessmentInput, error: Error, startTime: number): AssessmentResult {
    return {
      id: this.generateId(),
      type: input.type,
      url: input.url,
      timestamp: new Date(),
      scores: {
        overall: this.createScore(0, 100),
        categories: {
          documentation: this.createScore(0, 100),
          instructionClarity: this.createScore(0, 100),
          workflowAutomation: this.createScore(0, 100),
          riskCompliance: this.createScore(0, 100),
          integrationStructure: this.createScore(0, 100),
          fileSizeOptimization: this.createScore(0, 100)
        },
        confidence: {
          overall: 0,
          staticAnalysis: 0,
          aiAssessment: 0
        }
      },
      analysis: {},
      findings: [{
        id: 'assessment-failed',
        category: 'system',
        severity: 'high',
        title: 'Assessment Failed',
        description: `Assessment failed: ${error.message}`,
        evidence: [error.message],
        impact: 'Assessment could not be completed',
        confidence: 1.0
      }],
      recommendations: [{
        id: 'retry-assessment',
        category: 'system',
        priority: 'high',
        title: 'Retry Assessment',
        description: 'Try running the assessment again',
        implementation: ['Check URL validity', 'Verify network connection', 'Try again later'],
        impact: 'Allows assessment to complete',
        effort: 'low',
        timeline: 'Immediate'
      }],
      metadata: {
        version: '1.0.0',
        analysisTime: Date.now() - startTime,
        staticAnalysisTime: 0,
        totalAnalysisTime: Date.now() - startTime,
        retryCount: 0,
        fallbackUsed: true,
        errors: [{
          code: 'ASSESSMENT_FAILED',
          message: error.message,
          category: 'system',
          timestamp: new Date(),
          recoverable: true
        }],
        warnings: []
      }
    }
  }

  /**
   * Convert legacy result to unified format
   */
  convertToLegacyFormat(result: AssessmentResult): LegacyAssessmentResult {
    return {
      readinessScore: Math.round(result.scores.overall.value),
      aiAnalysisStatus: result.aiAssessment ? {
        enabled: result.aiAssessment.enabled,
        instructionClarity: result.aiAssessment.instructionClarity,
        workflowAutomation: result.aiAssessment.workflowAutomation,
        contextEfficiency: result.aiAssessment.contextEfficiency,
        riskCompliance: result.aiAssessment.riskCompliance,
        overallSuccess: result.aiAssessment.overallSuccess,
        reason: result.aiAssessment.reason
      } : undefined,
      categories: {
        documentation: Math.round(result.scores.categories.documentation.value),
        instructionClarity: Math.round(result.scores.categories.instructionClarity.value),
        workflowAutomation: Math.round(result.scores.categories.workflowAutomation.value),
        riskCompliance: Math.round(result.scores.categories.riskCompliance.value),
        integrationStructure: Math.round(result.scores.categories.integrationStructure.value),
        fileSizeOptimization: Math.round(result.scores.categories.fileSizeOptimization.value)
      },
      findings: result.findings.map(f => f.description),
      recommendations: result.recommendations.map(r => r.description),
      detailedAnalysis: result.aiAssessment?.detailedAnalysis,
      confidence: {
        overall: result.scores.confidence.overall,
        staticAnalysis: result.scores.confidence.staticAnalysis,
        aiAssessment: result.scores.confidence.aiAssessment
      },
      staticAnalysis: result.analysis.repository,
      websiteAnalysis: result.analysis.website,
      businessTypeAnalysis: result.analysis.businessType
    }
  }

  // Helper methods
  private createScore(value: number, maxValue: number): Score {
    return {
      value: Math.max(0, Math.min(value, maxValue)),
      maxValue,
      percentage: (value / maxValue) * 100,
      confidence: 0.8 // Default confidence
    }
  }

  private combineScores(baseScore?: Score, aiScore?: Score): Score {
    if (!baseScore && !aiScore) return this.createScore(0, 100)
    if (!baseScore) return aiScore!
    if (!aiScore) return baseScore

    // Weighted combination: 70% base, 30% AI
    const combinedValue = (baseScore.value * 0.7) + (aiScore.value * 0.3)
    return this.createScore(combinedValue, 100)
  }

  private averageScore(scores: number[]): number {
    if (scores.length === 0) return 0
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  private generateId(): string {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Convert FileSizeAnalysis to FileSizeAnalysisData
   */
  private convertFileSizeAnalysis(fileSizeAnalysis: any): any {
    return {
      totalSizeMB: fileSizeAnalysis.totalSizeMB || 0,
      largeFiles: fileSizeAnalysis.largeFiles || [],
      criticalFiles: fileSizeAnalysis.criticalFiles || [],
      agentCompatibility: fileSizeAnalysis.agentCompatibility || {},
      recommendations: fileSizeAnalysis.recommendations || []
    }
  }
}