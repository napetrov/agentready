import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository } from '../../../lib/analyzer'
import { generateAIAssessment } from '../../../lib/ai-assessment'
import { generateEnhancedAIAssessment } from '../../../lib/enhanced-ai-assessment'
import { generateExtendedAIAssessment } from '../../../lib/extended-ai-assessment'

export async function POST(request: NextRequest) {
  try {
    const { repoUrl } = await request.json()

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      )
    }

    // Validate GitHub URL
    const githubUrlPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+/
    if (!githubUrlPattern.test(repoUrl)) {
      return NextResponse.json(
        { error: 'Please provide a valid GitHub repository URL' },
        { status: 400 }
      )
    }

    // Perform static analysis (includes GitHub API data if available)
    const staticAnalysis = await analyzeRepository(repoUrl)

    // Generate extended AI assessment with GitHub data
    const aiAssessment = await generateExtendedAIAssessment(staticAnalysis, staticAnalysis.githubData)

    // Combine results
    const result = {
      readinessScore: aiAssessment.readinessScore,
      aiAnalysisStatus: aiAssessment.aiAnalysisStatus,
      categories: aiAssessment.categories,
      findings: aiAssessment.findings,
      recommendations: aiAssessment.recommendations,
      detailedAnalysis: aiAssessment.detailedAnalysis,
      confidence: aiAssessment.confidence,
      staticAnalysis: staticAnalysis,
      githubData: staticAnalysis.githubData,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze repository' },
      { status: 500 }
    )
  }
}