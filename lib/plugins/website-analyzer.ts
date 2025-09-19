/**
 * Website Analyzer Plugin
 * 
 * This plugin handles static analysis of websites,
 * including SEO, structured data, and business type detection.
 */

import { AnalysisType, AnalysisInput, AnalysisResult, WebsiteAnalysisData } from '../unified-types'
import { AnalyzerPlugin, ValidationResult } from '../plugin-registry'
import { analyzeWebsite } from '../analyzer'

export class WebsiteAnalyzerPlugin implements AnalyzerPlugin {
  readonly type: AnalysisType = 'website'
  readonly name = 'website-analyzer'
  readonly version = '1.0.0'
  readonly description = 'Static analysis of websites for AI agent readiness'

  /**
   * Analyze a website
   */
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    if (input.type !== 'website') {
      throw new Error('Website analyzer can only handle website inputs')
    }

    if (!this.isValidWebsiteUrl(input.url)) {
      throw new Error('Invalid website URL')
    }

    try {
      // Use the existing analyzer function
      const staticAnalysis = await analyzeWebsite(input.url)
      
      // Convert to unified format
      const analysisData: WebsiteAnalysisData = {
        type: 'website',
        url: input.url,
        pageTitle: staticAnalysis.pageTitle,
        metaDescription: staticAnalysis.metaDescription,
        hasStructuredData: staticAnalysis.hasStructuredData,
        hasOpenGraph: staticAnalysis.hasOpenGraph,
        hasTwitterCards: staticAnalysis.hasTwitterCards,
        hasSitemap: staticAnalysis.hasSitemap,
        hasRobotsTxt: staticAnalysis.hasRobotsTxt,
        contentLength: staticAnalysis.contentLength,
        technologies: staticAnalysis.technologies,
        contactInfo: staticAnalysis.contactInfo,
        socialMediaLinks: staticAnalysis.socialMediaLinks,
        locations: staticAnalysis.locations
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
      throw new Error(`Website analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

    // Validate website-specific fields
    if (result.data && 'type' in result.data && result.data.type === 'website') {
      const websiteData = result.data as WebsiteAnalysisData
      
      if (typeof websiteData.hasStructuredData !== 'boolean') {
        errors.push('hasStructuredData must be a boolean')
      }
      
      if (typeof websiteData.hasOpenGraph !== 'boolean') {
        errors.push('hasOpenGraph must be a boolean')
      }
      
      if (typeof websiteData.hasTwitterCards !== 'boolean') {
        errors.push('hasTwitterCards must be a boolean')
      }
      
      if (typeof websiteData.hasSitemap !== 'boolean') {
        errors.push('hasSitemap must be a boolean')
      }
      
      if (typeof websiteData.hasRobotsTxt !== 'boolean') {
        errors.push('hasRobotsTxt must be a boolean')
      }

      if (typeof websiteData.contentLength !== 'number' || websiteData.contentLength < 0) {
        errors.push('contentLength must be a non-negative number')
      }

      if (!Array.isArray(websiteData.technologies)) {
        errors.push('technologies must be an array')
      }

      if (!Array.isArray(websiteData.contactInfo)) {
        errors.push('contactInfo must be an array')
      }

      if (!Array.isArray(websiteData.socialMediaLinks)) {
        errors.push('socialMediaLinks must be an array')
      }

      if (!Array.isArray(websiteData.locations)) {
        errors.push('locations must be an array')
      }

      // Check for missing important fields
      if (!websiteData.pageTitle) {
        warnings.push('pageTitle is missing')
      }

      if (!websiteData.metaDescription) {
        warnings.push('metaDescription is missing')
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