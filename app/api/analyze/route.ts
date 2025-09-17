import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository } from '../../../lib/analyzer'
import { generateAIAssessment } from '../../../lib/ai-assessment'

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

    // Perform static analysis
    const staticAnalysis = await analyzeRepository(repoUrl)

    // Generate AI assessment
    const aiAssessment = await generateAIAssessment(staticAnalysis)

    // Combine results
    const result = {
      readinessScore: aiAssessment.readinessScore,
      categories: aiAssessment.categories,
      findings: aiAssessment.findings,
      recommendations: aiAssessment.recommendations,
      staticAnalysis: staticAnalysis,
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