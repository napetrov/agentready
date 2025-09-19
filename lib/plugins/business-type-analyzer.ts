/**
 * Business Type Analyzer Plugin
 * 
 * This plugin provides business type analysis for websites,
 * including agentic flow analysis and AI relevance scoring.
 */

import { AnalysisType, AssessmentInput, AnalysisResult, WebsiteAnalysisData, BusinessTypeAnalysisData } from '../unified-types'
import { AnalyzerPlugin, ValidationResult } from '../plugin-registry'
import { analyzeWebsite } from '../analyzer'

export class BusinessTypeAnalyzerPlugin implements AnalyzerPlugin {
  readonly type: AnalysisType = 'website'
  readonly name = 'business-type-analyzer'
  readonly version = '1.0.0'
  readonly description = 'Business type analysis for website AI agent readiness'

  /**
   * Analyze business type and agentic flows for a website
   */
  async analyze(input: AssessmentInput): Promise<AnalysisResult> {
    if (input.type !== 'website') {
      throw new Error('Business type analyzer can only handle website inputs')
    }

    if (!this.isValidWebsiteUrl(input.url)) {
      throw new Error('Invalid website URL')
    }

    const startTime = Date.now()

    try {
      // Perform website analysis to get business type data
      const websiteAnalysis = await analyzeWebsite(input.url)
      
      // Create analysis data from website analysis result
      const analysisData: BusinessTypeAnalysisData = {
        businessType: websiteAnalysis.businessType || 'unknown',
        businessTypeConfidence: websiteAnalysis.businessTypeConfidence || 0,
        overallScore: websiteAnalysis.overallScore || 0,
        industrySpecificInsights: websiteAnalysis.findings || [],
        recommendations: websiteAnalysis.recommendations || []
      }

      return {
        type: 'website',
        data: {
          businessType: analysisData
        },
        metadata: {
          analyzer: this.name,
          version: this.version,
          timestamp: new Date(),
          duration: Date.now() - startTime
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
      const businessData = result.data.businessType as BusinessTypeAnalysisData
      
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

      if (!Array.isArray(businessData.industrySpecificInsights)) {
        errors.push('industrySpecificInsights must be an array')
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
  canHandle(input: AssessmentInput): boolean {
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