import { NextRequest, NextResponse } from 'next/server'
import { analyzeWebsite } from '@/lib/analyzer'
import { enhanceReportWithSemrush } from '@/lib/semrush-integration'
import { scrapeGoogleBusinessProfile, extractBusinessName } from '@/lib/google-business'
import { scrapeYelpBusiness } from '@/lib/yelp'
import { scrapeSerpData, calculateVisibilityScore } from '@/lib/apify-serp'
import { AdminReportData, Finding, createFinding, sortFindingsByPriority } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl } = await request.json()

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    let url: URL
    try {
      url = new URL(websiteUrl)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json(
        { error: 'Please provide a valid HTTP/HTTPS website URL' },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting comprehensive admin scan for: ${websiteUrl}`)

    const apifyToken = process.env.APIFY_API_TOKEN

    // Step 1: Basic website analysis
    console.log('📊 Step 1: Basic website analysis')
    const websiteAnalysis = await analyzeWebsite(websiteUrl)
    const domain = url.hostname.replace(/^www\./, '')
    const businessName = extractBusinessName(websiteUrl, websiteAnalysis.pageTitle)

    // Step 2: Semrush data enhancement
    console.log('📈 Step 2: Fetching Semrush data')
    const semrushResult = await enhanceReportWithSemrush(domain, apifyToken)

    // Step 3: Google Business Profile data
    console.log('🗺️  Step 3: Scraping Google Business Profile')
    const googleBusinessResult = await scrapeGoogleBusinessProfile(
      businessName,
      undefined,
      apifyToken
    )

    // Step 4: Yelp data
    console.log('⭐ Step 4: Scraping Yelp data')
    const yelpResult = await scrapeYelpBusiness(
      businessName,
      undefined,
      apifyToken
    )

    // Step 5: SERP data
    console.log('🔍 Step 5: Scraping SERP data')
    const serpResult = await scrapeSerpData(
      businessName,
      undefined,
      apifyToken
    )

    // Step 6: Generate comprehensive findings
    console.log('📝 Step 6: Generating findings and recommendations')
    const findings = generateComprehensiveFindings(
      websiteUrl,
      websiteAnalysis,
      semrushResult.data,
      googleBusinessResult.profile,
      yelpResult.business,
      serpResult.data
    )

    // Step 7: Calculate scores
    console.log('📊 Step 7: Calculating scores')
    const scores = calculateScores(
      websiteAnalysis,
      semrushResult.data,
      googleBusinessResult.profile,
      yelpResult.business,
      serpResult.data
    )

    // Step 8: Generate recommendations
    const recommendations = generateRecommendations(findings, scores)

    // Build admin report data
    const reportData: AdminReportData = {
      websiteUrl,
      generatedAt: new Date().toISOString(),
      pageTitle: websiteAnalysis.pageTitle,
      metaDescription: websiteAnalysis.metaDescription,
      semrush: semrushResult.success ? semrushResult.data : undefined,
      googleBusiness: googleBusinessResult.success ? googleBusinessResult.profile : undefined,
      yelp: yelpResult.success ? yelpResult.business : undefined,
      serp: serpResult.success ? serpResult.data : undefined,
      findings: sortFindingsByPriority(findings),
      recommendations,
      scores
    }

    console.log('✅ Admin scan completed successfully')

    return NextResponse.json(reportData)
  } catch (error: any) {
    console.error('❌ Admin report generation error:', error)
    return NextResponse.json(
      { error: `Failed to generate admin report: ${error.message}` },
      { status: 500 }
    )
  }
}

/**
 * Generate comprehensive findings from all data sources
 */
function generateComprehensiveFindings(
  websiteUrl: string,
  websiteAnalysis: any,
  semrushData: any,
  googleBusiness: any,
  yelpBusiness: any,
  serpData: any
): Finding[] {
  const findings: Finding[] = []

  // SEO & Technical Findings
  if (!websiteAnalysis.metaDescription || websiteAnalysis.metaDescription.length < 50) {
    findings.push(createFinding(
      'SEO',
      'high',
      'Missing or inadequate meta description',
      'The page meta description is missing or too short. This impacts search engine visibility and click-through rates.',
      'Add a compelling meta description between 150-160 characters that accurately describes your business.',
      {
        url: websiteUrl,
        evidence: websiteAnalysis.metaDescription || 'No meta description found',
        effort: 'low'
      }
    ))
  }

  if (!websiteAnalysis.hasStructuredData) {
    findings.push(createFinding(
      'SEO',
      'high',
      'Missing structured data (Schema.org)',
      'No structured data markup found. This limits AI agent understanding and rich snippet display in search results.',
      'Implement Schema.org JSON-LD markup for LocalBusiness, including name, address, phone, hours, and ratings.',
      {
        url: websiteUrl,
        impact: 'Reduces AI agent compatibility by 40%',
        effort: 'medium'
      }
    ))
  }

  // Semrush Findings
  if (semrushData) {
    if (semrushData.aiVisibilityScore < 50) {
      findings.push(createFinding(
        'AI Visibility',
        'critical',
        'Low AI Visibility Score',
        `Your AI Visibility Score is ${semrushData.aiVisibilityScore}/100, which is below the recommended threshold.`,
        'Improve structured data, increase quality backlinks, and optimize for featured snippets to boost AI discoverability.',
        {
          evidence: `Domain Authority: ${semrushData.domainAuthority}, Backlinks: ${semrushData.backlinks}`,
          effort: 'high'
        }
      ))
    }

    if (semrushData.domainAuthority < 30) {
      findings.push(createFinding(
        'SEO',
        'medium',
        'Low domain authority',
        `Domain authority is ${semrushData.domainAuthority}/100, limiting search visibility.`,
        'Build high-quality backlinks, create valuable content, and improve site architecture.',
        {
          effort: 'high'
        }
      ))
    }

    if (semrushData.organicTraffic < 1000) {
      findings.push(createFinding(
        'Traffic',
        'medium',
        'Low organic traffic',
        `Only ${semrushData.organicTraffic} monthly organic visits detected.`,
        'Optimize for high-volume keywords, improve content quality, and enhance on-page SEO.',
        {
          effort: 'high'
        }
      ))
    }
  }

  // Google Business Profile Findings
  if (!googleBusiness) {
    findings.push(createFinding(
      'Online Presence',
      'critical',
      'Google Business Profile not found',
      'No Google Business Profile detected. This is essential for local search and AI agent discovery.',
      'Create and verify a Google Business Profile immediately with complete business information.',
      {
        impact: 'Missing 80% of local search visibility',
        effort: 'low'
      }
    ))
  } else {
    if (!googleBusiness.verified) {
      findings.push(createFinding(
        'Online Presence',
        'high',
        'Google Business Profile not verified',
        'Your Google Business Profile exists but is not verified, reducing trust and visibility.',
        'Complete the verification process through Google Business Profile Manager.',
        {
          url: 'https://business.google.com',
          effort: 'low'
        }
      ))
    }

    if (googleBusiness.rating < 4.0) {
      findings.push(createFinding(
        'Reputation',
        'high',
        'Low Google rating',
        `Google rating of ${googleBusiness.rating}/5.0 is below the recommended 4.0+ threshold.`,
        'Actively request reviews from satisfied customers and address negative feedback promptly.',
        {
          evidence: `${googleBusiness.reviewCount} reviews, average ${googleBusiness.rating} stars`,
          effort: 'medium'
        }
      ))
    }

    if (googleBusiness.reviewCount < 10) {
      findings.push(createFinding(
        'Reputation',
        'medium',
        'Insufficient Google reviews',
        `Only ${googleBusiness.reviewCount} Google reviews. More reviews build trust and improve rankings.`,
        'Implement a systematic review request process for customers.',
        {
          effort: 'low'
        }
      ))
    }

    if (googleBusiness.photos.length < 5) {
      findings.push(createFinding(
        'Online Presence',
        'low',
        'Limited Google Business photos',
        'Few photos on Google Business Profile. Visual content significantly impacts engagement.',
        'Upload at least 10 high-quality photos showing your business, products, and services.',
        {
          effort: 'low'
        }
      ))
    }
  }

  // Yelp Findings
  if (!yelpBusiness) {
    findings.push(createFinding(
      'Online Presence',
      'high',
      'Yelp listing not found',
      'No Yelp presence detected. Yelp is crucial for local business discovery.',
      'Claim or create your Yelp business listing and keep information up-to-date.',
      {
        impact: 'Missing key review platform visibility',
        effort: 'low'
      }
    ))
  } else {
    if (!yelpBusiness.claimed) {
      findings.push(createFinding(
        'Online Presence',
        'medium',
        'Yelp listing not claimed',
        'Your Yelp listing exists but is unclaimed, preventing you from managing information.',
        'Claim your Yelp business listing to manage details and respond to reviews.',
        {
          url: 'https://biz.yelp.com',
          effort: 'low'
        }
      ))
    }

    if (yelpBusiness.rating < 4.0) {
      findings.push(createFinding(
        'Reputation',
        'high',
        'Low Yelp rating',
        `Yelp rating of ${yelpBusiness.rating}/5.0 is below recommended threshold.`,
        'Address negative reviews professionally and encourage satisfied customers to leave reviews.',
        {
          evidence: `${yelpBusiness.reviewCount} reviews, average ${yelpBusiness.rating} stars`,
          effort: 'medium'
        }
      ))
    }
  }

  // SERP Findings
  if (serpData) {
    const visibilityScore = calculateVisibilityScore(serpData)
    
    if (visibilityScore < 50) {
      findings.push(createFinding(
        'Online Presence',
        'critical',
        'Poor online platform visibility',
        `Only ${visibilityScore}/100 platform visibility score. Missing presence on key platforms.`,
        'Establish profiles on missing platforms: Google, Yelp, Facebook, LinkedIn.',
        {
          evidence: `Visible on: ${Object.entries(serpData.visibility).filter(([, v]) => v).map(([k]) => k).join(', ')}`,
          effort: 'medium'
        }
      ))
    }

    if (!serpData.visibility.google) {
      findings.push(createFinding(
        'Online Presence',
        'critical',
        'Not appearing in Google search results',
        'Business not found in Google search results for brand name.',
        'Verify Google Business Profile and improve SEO for brand terms.',
        {
          effort: 'medium'
        }
      ))
    }

    if (!serpData.visibility.facebook) {
      findings.push(createFinding(
        'Social Media',
        'medium',
        'No Facebook presence',
        'No Facebook page found in search results.',
        'Create a Facebook Business Page with complete information.',
        {
          effort: 'low'
        }
      ))
    }

    if (!serpData.visibility.linkedin) {
      findings.push(createFinding(
        'Social Media',
        'low',
        'No LinkedIn presence',
        'No LinkedIn company page found in search results.',
        'Create a LinkedIn Company Page to enhance professional presence.',
        {
          effort: 'low'
        }
      ))
    }
  }

  // AI Agent Readiness Findings (from business type analysis)
  if (websiteAnalysis.agenticFlows) {
    const flows = websiteAnalysis.agenticFlows

    if (flows.informationGathering.score < 60) {
      findings.push(createFinding(
        'AI Readiness',
        'high',
        'Poor information gathering support',
        'Website structure makes it difficult for AI agents to extract key information.',
        'Implement clear structured data, FAQ sections, and machine-readable business information.',
        {
          url: websiteUrl,
          impact: 'AI agents cannot effectively answer user questions about your business',
          effort: 'medium'
        }
      ))
    }

    if (flows.directBooking.score < 40) {
      findings.push(createFinding(
        'AI Readiness',
        'medium',
        'Limited booking/conversion capabilities',
        'AI agents cannot easily facilitate bookings or conversions from your site.',
        'Implement API-based booking systems with clear calls-to-action and contact methods.',
        {
          effort: 'high'
        }
      ))
    }
  }

  return findings
}

/**
 * Calculate comprehensive scores
 */
function calculateScores(
  websiteAnalysis: any,
  semrushData: any,
  googleBusiness: any,
  yelpBusiness: any,
  serpData: any
): AdminReportData['scores'] {
  // AI Visibility Score (from Semrush or calculated)
  const aiVisibility = semrushData?.aiVisibilityScore || 0

  // Online Presence Score
  let onlinePresence = 0
  if (googleBusiness) onlinePresence += 40
  if (googleBusiness?.verified) onlinePresence += 20
  if (yelpBusiness) onlinePresence += 20
  if (yelpBusiness?.claimed) onlinePresence += 10
  if (serpData) onlinePresence += calculateVisibilityScore(serpData) * 0.1

  // Review Reputation Score
  let reviewReputation = 0
  if (googleBusiness?.rating) {
    reviewReputation += (googleBusiness.rating / 5) * 50
  }
  if (yelpBusiness?.rating) {
    reviewReputation += (yelpBusiness.rating / 5) * 50
  }

  // SEO Performance Score
  let seoPerformance = 0
  if (semrushData) {
    seoPerformance += Math.min(30, (semrushData.domainAuthority / 100) * 30)
    seoPerformance += Math.min(30, semrushData.organicTraffic > 10000 ? 30 : (semrushData.organicTraffic / 10000) * 30)
    seoPerformance += Math.min(40, semrushData.backlinks > 1000 ? 40 : (semrushData.backlinks / 1000) * 40)
  }
  if (websiteAnalysis.hasStructuredData) seoPerformance += 10
  if (websiteAnalysis.metaDescription) seoPerformance += 5

  // Overall Score (weighted average)
  const overall = Math.round(
    aiVisibility * 0.3 +
    onlinePresence * 0.25 +
    reviewReputation * 0.25 +
    seoPerformance * 0.2
  )

  return {
    aiVisibility: Math.round(aiVisibility),
    onlinePresence: Math.round(onlinePresence),
    reviewReputation: Math.round(reviewReputation),
    seoPerformance: Math.round(seoPerformance),
    overall: Math.round(overall)
  }
}

/**
 * Generate prioritized recommendations
 */
function generateRecommendations(
  findings: Finding[],
  scores: AdminReportData['scores']
): string[] {
  const recommendations: string[] = []

  // Critical priorities
  const critical = findings.filter(f => f.severity === 'critical')
  if (critical.length > 0) {
    recommendations.push('🚨 IMMEDIATE ACTION REQUIRED:')
    critical.forEach(f => {
      recommendations.push(`   • ${f.title} - ${f.recommendation}`)
    })
  }

  // High priorities
  const high = findings.filter(f => f.severity === 'high')
  if (high.length > 0) {
    recommendations.push('⚠️  HIGH PRIORITY:')
    high.slice(0, 5).forEach(f => {
      recommendations.push(`   • ${f.title} - ${f.recommendation}`)
    })
  }

  // Quick wins (low effort)
  const quickWins = findings
    .filter(f => f.effort === 'low' && (f.severity === 'medium' || f.severity === 'high'))
    .slice(0, 3)
  
  if (quickWins.length > 0) {
    recommendations.push('✨ QUICK WINS (Low Effort, High Impact):')
    quickWins.forEach(f => {
      recommendations.push(`   • ${f.title}`)
    })
  }

  // Score-based recommendations
  if (scores.aiVisibility < 50) {
    recommendations.push('📊 Focus on improving AI Visibility through structured data and quality content')
  }
  if (scores.onlinePresence < 60) {
    recommendations.push('🌐 Establish presence on missing platforms (Google, Yelp, social media)')
  }
  if (scores.reviewReputation < 70) {
    recommendations.push('⭐ Implement a systematic customer review request process')
  }
  if (scores.seoPerformance < 50) {
    recommendations.push('🔍 Invest in SEO optimization and link building strategy')
  }

  return recommendations
}
