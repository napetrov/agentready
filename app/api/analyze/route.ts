import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository, analyzeWebsite } from '../../../lib/analyzer'
import { generateAIAssessment } from '../../../lib/ai-assessment'
import { generateEnhancedAIAssessment } from '../../../lib/enhanced-ai-assessment'

export async function POST(request: NextRequest) {
  try {
    const { inputUrl, inputType } = await request.json()

    if (!inputUrl) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    let url: URL
    try {
      url = new URL(inputUrl)
    } catch {
      return NextResponse.json(
        { error: 'Please provide a valid URL' },
        { status: 400 }
      )
    }

    // Validate based on input type
    if (inputType === 'repository') {
      const githubUrlPattern = /^https:\/\/github\.com\/[^\/]+\/[^\/]+/
      if (!githubUrlPattern.test(inputUrl)) {
        return NextResponse.json(
          { error: 'Please provide a valid GitHub repository URL' },
          { status: 400 }
        )
      }
    } else if (inputType === 'website') {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return NextResponse.json(
          { error: 'Please provide a valid HTTP/HTTPS website URL' },
          { status: 400 }
        )
      }
    }

    // Perform analysis based on input type
    let staticAnalysis
    if (inputType === 'repository') {
      staticAnalysis = await analyzeRepository(inputUrl)
    } else {
      staticAnalysis = await analyzeWebsite(inputUrl)
    }

    // Generate enhanced AI assessment
    const aiAssessment = await generateEnhancedAIAssessment(staticAnalysis)

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
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze source' },
      { status: 500 }
    )
  }
}