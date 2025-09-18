import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository, analyzeWebsite, WebsiteAnalysisResult } from '../../../lib/analyzer'
import { generateEnhancedAIAssessment, generateWebsiteAIAssessment } from '../../../lib/enhanced-ai-assessment'
import { promises as dns } from 'dns'

// Helper function to check if an IP address is public/routable
function isPublicIP(ip: string): boolean {
  // IPv4 checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) return false
    
    // Private ranges
    if (parts[0] === 10) return false
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false
    if (parts[0] === 192 && parts[1] === 168) return false
    if (parts[0] === 127) return false // loopback
    if (parts[0] === 169 && parts[1] === 254) return false // link-local
    
    return true
  }
  
  // IPv6 checks
  if (ip.includes(':')) {
    // Loopback
    if (ip === '::1') return false
    // Link-local
    if (ip.startsWith('fe80:')) return false
    // Unique local
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return false
    // Loopback range
    if (ip.startsWith('::ffff:127.')) return false
    
    return true
  }
  
  return false
}

// Helper function to validate hostname and check for SSRF
async function validateHostname(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.resolve4(hostname)
    const addresses6 = await dns.resolve6(hostname).catch(() => [])
    
    const allAddresses = [...addresses, ...addresses6]
    
    // Check if any resolved IP is private/internal
    for (const address of allAddresses) {
      if (!isPublicIP(address)) {
        return false
      }
    }
    
    return allAddresses.length > 0
  } catch (error) {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inputUrl, inputType } = await request.json()

    if (!inputUrl) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate inputType
    if (!inputType || !['repository', 'website'].includes(inputType)) {
      return NextResponse.json(
        { error: 'Invalid inputType. Must be either "repository" or "website"' },
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

      // SSRF protection: validate hostname before making any requests
      const isValidHostname = await validateHostname(url.hostname)
      if (!isValidHostname) {
        return NextResponse.json(
          { error: 'Access to internal or private networks is not allowed' },
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