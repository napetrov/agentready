/**
 * Unified AI Assessor Plugin
 * 
 * This plugin provides AI-powered assessment for both repository and website analysis,
 * using the unified AI assessment engine.
 */

import { AnalysisType, AnalysisResult, AIAssessment, AIAssessor } from '../unified-types'
import { AIAssessorPlugin, ValidationResult, Insights } from '../plugin-registry'
import { generateUnifiedAIAssessment } from '../unified-ai-assessment'

export class UnifiedAIAssessorPlugin implements AIAssessorPlugin {
  readonly type: AnalysisType = 'repository' | 'website'
  readonly name = 'unified-ai-assessor'
  readonly version = '1.0.0'
  readonly description = 'Unified AI assessment for repository and website analysis'

  /**
   * Perform AI assessment on the analysis result
   */
  async assess(analysis: AnalysisResult): Promise<AIAssessment> {
    if (analysis.type !== 'repository' && analysis.type !== 'website') {
      throw new Error('Unified AI assessor can only handle repository or website analysis')
    }

    try {
      // Use the existing unified AI assessment function
      const aiAssessment = await generateUnifiedAIAssessment(analysis.data)
      
      return {
        type: analysis.type,
        scores: aiAssessment.scores,
        findings: aiAssessment.findings,
        recommendations: aiAssessment.recommendations,
        confidence: aiAssessment.confidence,
        metadata: {
          assessor: this.name,
          version: this.version,
          timestamp: new Date()
        }
      }
    } catch (error) {
      throw new Error(`AI assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate insights from the AI assessment
   */
  generateInsights(assessment: AIAssessment): Insights {
    const keyFindings: string[] = []
    const recommendations: string[] = []
    
    // Extract key findings from assessment
    if (assessment.findings && assessment.findings.length > 0) {
      keyFindings.push(...assessment.findings.slice(0, 5)) // Top 5 findings
    }
    
    // Extract recommendations from assessment
    if (assessment.recommendations && assessment.recommendations.length > 0) {
      recommendations.push(...assessment.recommendations.slice(0, 5)) // Top 5 recommendations
    }
    
    // Determine risk level based on confidence and scores
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    
    if (assessment.confidence < 50) {
      riskLevel = 'high'
    } else if (assessment.confidence < 75) {
      riskLevel = 'medium'
    }
    
    // Check for low scores that might indicate issues
    if (assessment.scores) {
      const scores = Object.values(assessment.scores)
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
      
      if (avgScore < 30) {
        riskLevel = 'high'
      } else if (avgScore < 60) {
        riskLevel = 'medium'
      }
    }
    
    return {
      keyFindings,
      recommendations,
      confidence: assessment.confidence,
      riskLevel
    }
  }

  /**
   * Check if this assessor can handle the given analysis
   */
  canHandle(analysis: AnalysisResult): boolean {
    return analysis.type === 'repository' || analysis.type === 'website'
  }
}