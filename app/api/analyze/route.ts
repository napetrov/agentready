import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository, analyzeWebsite, WebsiteAnalysisResult } from '../../../lib/analyzer'
import { generateEnhancedAIAssessment, generateWebsiteAIAssessment } from '../../../lib/enhanced-ai-assessment'

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
    let staticAnalysis: any
    let websiteAnalysis: WebsiteAnalysisResult | null = null
    
    if (inputType === 'repository') {
      staticAnalysis = await analyzeRepository(inputUrl)
    } else {
      websiteAnalysis = await analyzeWebsite(inputUrl)
      // Convert website analysis to static analysis format for AI assessment
      staticAnalysis = {
        hasReadme: false,
        hasContributing: false,
        hasAgents: false,
        hasLicense: false,
        hasWorkflows: false,
        hasTests: false,
        languages: websiteAnalysis.technologies,
        errorHandling: false,
        fileCount: 1,
        linesOfCode: 0,
        repositorySizeMB: websiteAnalysis.contentLength / (1024 * 1024),
        workflowFiles: [],
        testFiles: [],
        // Map website properties to static analysis format
        websiteUrl: websiteAnalysis.websiteUrl,
        pageTitle: websiteAnalysis.pageTitle,
        metaDescription: websiteAnalysis.metaDescription,
        hasStructuredData: websiteAnalysis.hasStructuredData,
        hasOpenGraph: websiteAnalysis.hasOpenGraph,
        hasTwitterCards: websiteAnalysis.hasTwitterCards,
        hasSitemap: websiteAnalysis.hasSitemap,
        hasRobotsTxt: websiteAnalysis.hasRobotsTxt,
        hasFavicon: websiteAnalysis.hasFavicon,
        hasManifest: websiteAnalysis.hasManifest,
        hasServiceWorker: websiteAnalysis.hasServiceWorker,
        pageLoadSpeed: websiteAnalysis.pageLoadSpeed,
        mobileFriendly: websiteAnalysis.mobileFriendly,
        accessibilityScore: websiteAnalysis.accessibilityScore,
        seoScore: websiteAnalysis.seoScore,
        contentLength: websiteAnalysis.contentLength,
        imageCount: websiteAnalysis.imageCount,
        linkCount: websiteAnalysis.linkCount,
        headingStructure: websiteAnalysis.headingStructure,
        technologies: websiteAnalysis.technologies,
        securityHeaders: websiteAnalysis.securityHeaders,
        socialMediaLinks: websiteAnalysis.socialMediaLinks,
        contactInfo: websiteAnalysis.contactInfo,
        navigationStructure: websiteAnalysis.navigationStructure
      }
    }

    // Generate appropriate AI assessment based on input type
    const aiAssessment = inputType === 'website' 
      ? await generateWebsiteAIAssessment(staticAnalysis)
      : await generateEnhancedAIAssessment(staticAnalysis)

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
      // Include website-specific data if available
      ...(websiteAnalysis && {
        websiteAnalysis: {
          websiteType: websiteAnalysis.websiteType,
          restaurantMetrics: websiteAnalysis.restaurantMetrics,
          documentationMetrics: websiteAnalysis.documentationMetrics,
          ecommerceMetrics: websiteAnalysis.ecommerceMetrics
        }
      })
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