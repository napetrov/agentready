/**
 * Plugin-Based Orchestrator
 * 
 * This module provides a simplified orchestration system that uses the plugin registry
 * to execute analysis and AI assessment in a clean, linear flow.
 */

import { AssessmentInput, AssessmentResult, AnalysisResult, AIAssessment } from './unified-types'
import { pluginRegistry, PluginRegistry } from './plugin-registry'
import { generateBusinessTypeAnalysis } from './business-type-analyzer'
import { FileSizeAnalyzer } from './file-size-analyzer'

/**
 * Configuration for the plugin-based orchestrator
 */
export interface OrchestratorConfig {
  enableBusinessTypeAnalysis: boolean
  enableFileSizeAnalysis: boolean
  enableCaching: boolean
  maxRetries: number
  retryDelay: number
}

/**
 * Plugin-based orchestrator for assessment execution
 */
export class PluginBasedOrchestrator {
  private registry: PluginRegistry
  private config: OrchestratorConfig

  constructor(registry: PluginRegistry = pluginRegistry, config: Partial<OrchestratorConfig> = {}) {
    this.registry = registry
    this.config = {
      enableBusinessTypeAnalysis: true,
      enableFileSizeAnalysis: true,
      enableCaching: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    }
  }

  /**
   * Execute complete assessment using plugin system
   */
  async assess(input: AssessmentInput): Promise<AssessmentResult> {
    console.log(`🚀 Starting plugin-based assessment for ${input.type}: ${input.url}`)
    
    try {
      // Step 1: Execute static analysis using appropriate analyzer
      const analysis = await this.executeAnalysis(input)
      console.log(`✅ Static analysis completed for ${input.type}`)
      
      // Step 2: Execute AI assessment using appropriate assessor
      const aiAssessment = await this.executeAIAssessment(analysis)
      console.log(`✅ AI assessment completed for ${input.type}`)
      
      // Step 3: Execute additional analysis if needed
      const additionalAnalysis = await this.executeAdditionalAnalysis(input, analysis)
      
      // Step 4: Generate unified result
      const result = await this.generateUnifiedResult(input, analysis, aiAssessment, additionalAnalysis)
      console.log(`✅ Assessment completed successfully for ${input.type}`)
      
      return result
    } catch (error) {
      console.error(`❌ Assessment failed for ${input.type}:`, error)
      throw error
    }
  }

  /**
   * Execute static analysis using plugin registry
   */
  private async executeAnalysis(input: AssessmentInput): Promise<AnalysisResult> {
    return await this.registry.executeAnalysis(input)
  }

  /**
   * Execute AI assessment using plugin registry
   */
  private async executeAIAssessment(analysis: AnalysisResult): Promise<AIAssessment> {
    return await this.registry.executeAIAssessment(analysis)
  }

  /**
   * Execute additional analysis based on input type
   */
  private async executeAdditionalAnalysis(input: AssessmentInput, analysis: AnalysisResult): Promise<any> {
    const additionalAnalysis: any = {}

    // Business type analysis for websites
    if (input.type === 'website' && this.config.enableBusinessTypeAnalysis) {
      try {
        console.log('🔍 Executing business type analysis...')
        const businessTypeAnalysis = await generateBusinessTypeAnalysis(input.url)
        additionalAnalysis.businessTypeAnalysis = businessTypeAnalysis
        console.log('✅ Business type analysis completed')
      } catch (error) {
        console.warn('⚠️ Business type analysis failed:', error)
        // Continue without business type analysis
      }
    }

    // File size analysis for repositories
    if (input.type === 'repository' && this.config.enableFileSizeAnalysis) {
      try {
        console.log('🔍 Executing file size analysis...')
        const fileSizeAnalyzer = new FileSizeAnalyzer()
        const fileSizeAnalysis = fileSizeAnalyzer.analyze(analysis.data)
        additionalAnalysis.fileSizeAnalysis = fileSizeAnalysis
        console.log('✅ File size analysis completed')
      } catch (error) {
        console.warn('⚠️ File size analysis failed:', error)
        // Continue without file size analysis
      }
    }

    return additionalAnalysis
  }

  /**
   * Generate unified assessment result
   */
  private async generateUnifiedResult(
    input: AssessmentInput,
    analysis: AnalysisResult,
    aiAssessment: AIAssessment,
    additionalAnalysis: any
  ): Promise<AssessmentResult> {
    // Calculate overall readiness score
    const overallScore = this.calculateOverallScore(aiAssessment, additionalAnalysis)
    
    // Generate category scores
    const categoryScores = this.generateCategoryScores(aiAssessment, additionalAnalysis)
    
    // Generate confidence scores
    const confidenceScores = this.generateConfidenceScores(aiAssessment, additionalAnalysis)
    
    // Extract findings and recommendations
    const findings = this.extractFindings(aiAssessment, additionalAnalysis)
    const recommendations = this.extractRecommendations(aiAssessment, additionalAnalysis)
    
    return {
      id: this.generateAssessmentId(),
      type: input.type,
      timestamp: new Date(),
      url: input.url,
      readinessScore: overallScore,
      categories: categoryScores,
      confidence: confidenceScores,
      analysis: analysis.data,
      aiAssessment: aiAssessment,
      businessTypeAnalysis: additionalAnalysis.businessTypeAnalysis,
      fileSizeAnalysis: additionalAnalysis.fileSizeAnalysis,
      findings,
      recommendations,
      metadata: {
        orchestrator: 'plugin-based',
        version: '1.0.0',
        duration: 0, // Will be set by the caller
        plugins: {
          analyzer: analysis.metadata?.analyzer,
          assessor: aiAssessment.metadata?.assessor
        }
      }
    }
  }

  /**
   * Calculate overall readiness score
   */
  private calculateOverallScore(aiAssessment: AIAssessment, additionalAnalysis: any): number {
    let totalScore = 0
    let weightSum = 0

    // AI assessment scores (weight: 0.7)
    if (aiAssessment.scores) {
      const aiScores = Object.values(aiAssessment.scores)
      const aiAvg = aiScores.reduce((sum, score) => sum + score, 0) / aiScores.length
      totalScore += aiAvg * 0.7
      weightSum += 0.7
    }

    // Business type analysis scores (weight: 0.2)
    if (additionalAnalysis.businessTypeAnalysis?.overallScore) {
      totalScore += additionalAnalysis.businessTypeAnalysis.overallScore * 0.2
      weightSum += 0.2
    }

    // File size analysis scores (weight: 0.1)
    if (additionalAnalysis.fileSizeAnalysis?.agentCompatibility?.overall) {
      totalScore += additionalAnalysis.fileSizeAnalysis.agentCompatibility.overall * 0.1
      weightSum += 0.1
    }

    return weightSum > 0 ? Math.round(totalScore / weightSum) : 0
  }

  /**
   * Generate category scores
   */
  private generateCategoryScores(aiAssessment: AIAssessment, additionalAnalysis: any): Record<string, number> {
    const categories: Record<string, number> = {}

    // AI assessment categories
    if (aiAssessment.scores) {
      Object.entries(aiAssessment.scores).forEach(([key, value]) => {
        categories[key] = value
      })
    }

    // Business type analysis categories
    if (additionalAnalysis.businessTypeAnalysis?.agenticFlows) {
      Object.entries(additionalAnalysis.businessTypeAnalysis.agenticFlows).forEach(([key, value]) => {
        if (typeof value === 'object' && 'score' in value) {
          categories[`business_${key}`] = (value as any).score
        }
      })
    }

    return categories
  }

  /**
   * Generate confidence scores
   */
  private generateConfidenceScores(aiAssessment: AIAssessment, additionalAnalysis: any): Record<string, number> {
    const confidence: Record<string, number> = {}

    // AI assessment confidence
    if (aiAssessment.confidence) {
      confidence.aiAssessment = aiAssessment.confidence
    }

    // Business type analysis confidence
    if (additionalAnalysis.businessTypeAnalysis?.businessTypeConfidence) {
      confidence.businessType = additionalAnalysis.businessTypeAnalysis.businessTypeConfidence
    }

    // Overall confidence (average of all available)
    const confidences = Object.values(confidence)
    if (confidences.length > 0) {
      confidence.overall = Math.round(confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length)
    }

    return confidence
  }

  /**
   * Extract findings from all sources
   */
  private extractFindings(aiAssessment: AIAssessment, additionalAnalysis: any): string[] {
    const findings: string[] = []

    // AI assessment findings
    if (aiAssessment.findings) {
      findings.push(...aiAssessment.findings)
    }

    // Business type analysis findings
    if (additionalAnalysis.businessTypeAnalysis?.findings) {
      findings.push(...additionalAnalysis.businessTypeAnalysis.findings)
    }

    // File size analysis findings
    if (additionalAnalysis.fileSizeAnalysis?.recommendations) {
      findings.push(...additionalAnalysis.fileSizeAnalysis.recommendations)
    }

    // Remove duplicates and limit to top 10
    return [...new Set(findings)].slice(0, 10)
  }

  /**
   * Extract recommendations from all sources
   */
  private extractRecommendations(aiAssessment: AIAssessment, additionalAnalysis: any): string[] {
    const recommendations: string[] = []

    // AI assessment recommendations
    if (aiAssessment.recommendations) {
      recommendations.push(...aiAssessment.recommendations)
    }

    // Business type analysis recommendations
    if (additionalAnalysis.businessTypeAnalysis?.recommendations) {
      recommendations.push(...additionalAnalysis.businessTypeAnalysis.recommendations)
    }

    // File size analysis recommendations
    if (additionalAnalysis.fileSizeAnalysis?.recommendations) {
      recommendations.push(...additionalAnalysis.fileSizeAnalysis.recommendations)
    }

    // Remove duplicates and limit to top 10
    return [...new Set(recommendations)].slice(0, 10)
  }

  /**
   * Generate unique assessment ID
   */
  private generateAssessmentId(): string {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    registry: any
    config: OrchestratorConfig
  } {
    return {
      registry: this.registry.getStats(),
      config: this.config
    }
  }
}

/**
 * Global orchestrator instance
 */
export const orchestrator = new PluginBasedOrchestrator()