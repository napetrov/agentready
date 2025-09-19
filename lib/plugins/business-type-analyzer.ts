/**
 * Business Type Analyzer Plugin
 * 
 * This plugin provides business type analysis for websites,
 * including agentic flow analysis and AI relevance scoring.
 */

import { AnalysisType, AnalysisInput, AnalysisResult, WebsiteAnalysisData, BusinessTypeAnalysis } from '../unified-types'
import { AnalyzerPlugin, ValidationResult } from '../plugin-registry'
import { generateAIReadinessInsights } from '../business-type-analyzer'

export class BusinessTypeAnalyzerPlugin implements AnalyzerPlugin {
  readonly type: AnalysisType = 'website'
  readonly name = 'business-type-analyzer'
  readonly version = '1.0.0'
  readonly description = 'Business type analysis for website AI agent readiness'

  /**
   * Analyze business type and agentic flows for a website
   */
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    if (input.type !== 'website') {
      throw new Error('Business type analyzer can only handle website inputs')
    }

    if (!this.isValidWebsiteUrl(input.url)) {
      throw new Error('Invalid website URL')
    }

    try {
      // Use the existing business type analyzer function
      const businessTypeAnalysis = await generateAIReadinessInsights(input.url)
      
      // Convert to unified format
      const analysisData: BusinessTypeAnalysis = {
        businessType: businessTypeAnalysis.businessType,
        businessTypeConfidence: businessTypeAnalysis.businessTypeConfidence,
        overallScore: businessTypeAnalysis.overallScore,
        agenticFlows: businessTypeAnalysis.agenticFlows,
        aiRelevantChecks: businessTypeAnalysis.aiRelevantChecks,
        findings: businessTypeAnalysis.findings,
        recommendations: businessTypeAnalysis.recommendations
      }

      return {
        type: 'website',
        data: analysisData,
        timestamp: new Date(),
        metadata: {
          analyzer: this.name,
          version: this.version,
          duration: 0 // Will be set by the registry
        }
      }
    } catch (error) {
      throw new Error(`Business type analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate the analysis result
   */
  validate(result: AnalysisResult): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (result.type !== 'website') {
      errors.push('Result type must be website')
    }

    if (!result.data) {
      errors.push('Analysis data is required')
    }

    if (result.data && 'type' in result.data && result.data.type !== 'website') {
      errors.push('Analysis data type must be website')
    }

    // Validate business type analysis specific fields
    if (result.data && 'type' in result.data && result.data.type === 'website') {
      const businessData = result.data as BusinessTypeAnalysis
      
      if (typeof businessData.businessType !== 'string' || businessData.businessType === '') {
        errors.push('businessType must be a non-empty string')
      }
      
      if (typeof businessData.businessTypeConfidence !== 'number' || 
          businessData.businessTypeConfidence < 0 || 
          businessData.businessTypeConfidence > 100) {
        errors.push('businessTypeConfidence must be a number between 0 and 100')
      }
      
      if (typeof businessData.overallScore !== 'number' || 
          businessData.overallScore < 0 || 
          businessData.overallScore > 100) {
        errors.push('overallScore must be a number between 0 and 100')
      }

      if (!businessData.agenticFlows) {
        errors.push('agenticFlows is required')
      }

      if (!businessData.aiRelevantChecks) {
        errors.push('aiRelevantChecks is required')
      }

      if (!Array.isArray(businessData.findings)) {
        errors.push('findings must be an array')
      }

      if (!Array.isArray(businessData.recommendations)) {
        errors.push('recommendations must be an array')
      }

      // Check for missing important fields
      if (businessData.businessTypeConfidence < 50) {
        warnings.push('Business type confidence is low')
      }

      if (businessData.overallScore < 50) {
        warnings.push('Overall score is low')
      }
    }

    const isValid = errors.length === 0
    const score = isValid ? (warnings.length === 0 ? 100 : 80) : 0

    return {
      isValid,
      errors,
      warnings,
      score
    }
  }

  /**
   * Check if this analyzer can handle the given input
   */
  canHandle(input: AnalysisInput): boolean {
    return input.type === 'website' && this.isValidWebsiteUrl(input.url)
  }

  /**
   * Validate website URL format
   */
  private isValidWebsiteUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
             urlObj.hostname !== 'github.com' // Exclude GitHub URLs
    } catch {
      return false
    }
  }
}