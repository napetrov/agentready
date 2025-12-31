import axios from 'axios'

export interface SemrushData {
  domainAuthority: number
  organicTraffic: number
  backlinks: number
  aiVisibilityScore: number
  keywords: Array<{
    keyword: string
    position: number
    volume: number
    difficulty: number
  }>
  topPages: Array<{
    url: string
    traffic: number
    keywords: number
  }>
  competitors: Array<{
    domain: string
    commonKeywords: number
  }>
}

export interface SemrushEnhancement {
  success: boolean
  data?: SemrushData
  error?: string
}

/**
 * Enhance report with Semrush data using Apify actor
 * @param domain - The target domain to analyze (without protocol)
 * @param apifyToken - Apify API token for authentication
 */
export async function enhanceReportWithSemrush(
  domain: string,
  apifyToken?: string
): Promise<SemrushEnhancement> {
  try {
    if (!apifyToken) {
      console.warn('⚠️ APIFY_API_TOKEN not provided, skipping Semrush enhancement')
      return {
        success: false,
        error: 'APIFY_API_TOKEN not configured'
      }
    }

    // Clean domain (remove protocol if present)
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')

    console.log(`🔍 Fetching Semrush data for domain: ${cleanDomain}`)

    const semrushData = await runSemrushAnalysis(cleanDomain, apifyToken)

    console.log(`✅ Semrush data fetched successfully for ${cleanDomain}`)

    return {
      success: true,
      data: semrushData
    }
  } catch (error: any) {
    console.error('❌ Semrush enhancement failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Run Semrush analysis using Apify actor
 * @param domain - The clean domain to analyze
 * @param apifyToken - Apify API token
 */
export async function runSemrushAnalysis(
  domain: string,
  apifyToken: string
): Promise<SemrushData> {
  try {
    // Use Apify's Semrush scraper actor
    // Note: This is a generic implementation - the actual actor ID may vary
    const actorId = 'semrush-scraper' // Replace with actual Apify actor ID

    // Start actor run
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        domain,
        includeKeywords: true,
        includeBacklinks: true,
        includeCompetitors: true,
        maxKeywords: 100,
        maxPages: 50,
        maxCompetitors: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${apifyToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          token: apifyToken
        },
        timeout: 30000
      }
    )

    const runId = runResponse.data.data.id

    // Wait for the run to complete (with timeout)
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max

    while (status === 'RUNNING' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

      const statusResponse = await axios.get(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}`,
        {
          headers: {
            'Authorization': `Bearer ${apifyToken}`
          },
          params: {
            token: apifyToken
          }
        }
      )

      status = statusResponse.data.data.status
      attempts++
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Semrush analysis failed with status: ${status}`)
    }

    // Get the dataset results
    const datasetId = runResponse.data.data.defaultDatasetId

    const resultsResponse = await axios.get(
      `https://api.apify.com/v2/datasets/${datasetId}/items`,
      {
        headers: {
          'Authorization': `Bearer ${apifyToken}`
        },
        params: {
          token: apifyToken,
          format: 'json'
        }
      }
    )

    const results = resultsResponse.data

    // Parse and structure the Semrush data
    return parseSemrushResults(results)
  } catch (error: any) {
    console.error('❌ Semrush API error:', error.message)
    
    // Return mock data in development or when API fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using mock Semrush data in development')
      return generateMockSemrushData(domain)
    }
    
    throw error
  }
}

/**
 * Parse Semrush results from Apify dataset
 */
function parseSemrushResults(results: any[]): SemrushData {
  if (!results || results.length === 0) {
    throw new Error('No Semrush data returned')
  }

  const data = results[0]

  // Calculate AI Visibility Score based on structured data presence, 
  // mobile optimization, and keyword rankings
  const aiVisibilityScore = calculateAIVisibilityScore(data)

  return {
    domainAuthority: data.domainAuthority || data.authorityScore || 0,
    organicTraffic: data.organicTraffic || data.trafficCost || 0,
    backlinks: data.backlinks || data.totalBacklinks || 0,
    aiVisibilityScore,
    keywords: (data.keywords || []).slice(0, 100).map((kw: any) => ({
      keyword: kw.keyword || kw.searchTerm || '',
      position: kw.position || kw.rank || 0,
      volume: kw.volume || kw.searchVolume || 0,
      difficulty: kw.difficulty || kw.keywordDifficulty || 0
    })),
    topPages: (data.topPages || []).slice(0, 50).map((page: any) => ({
      url: page.url || page.pageUrl || '',
      traffic: page.traffic || page.visits || 0,
      keywords: page.keywords || page.keywordCount || 0
    })),
    competitors: (data.competitors || []).slice(0, 10).map((comp: any) => ({
      domain: comp.domain || comp.competitorDomain || '',
      commonKeywords: comp.commonKeywords || comp.sharedKeywords || 0
    }))
  }
}

/**
 * Calculate AI Visibility Score based on various SEO factors
 */
function calculateAIVisibilityScore(data: any): number {
  let score = 0

  // Domain authority contribution (0-30 points)
  const authority = data.domainAuthority || data.authorityScore || 0
  score += Math.min(30, (authority / 100) * 30)

  // Keyword rankings contribution (0-30 points)
  const keywords = data.keywords || []
  const topRankings = keywords.filter((kw: any) => (kw.position || 100) <= 10).length
  score += Math.min(30, (topRankings / 20) * 30)

  // Organic traffic contribution (0-20 points)
  const traffic = data.organicTraffic || 0
  if (traffic > 100000) score += 20
  else if (traffic > 50000) score += 15
  else if (traffic > 10000) score += 10
  else if (traffic > 1000) score += 5

  // Backlinks contribution (0-20 points)
  const backlinks = data.backlinks || 0
  if (backlinks > 10000) score += 20
  else if (backlinks > 5000) score += 15
  else if (backlinks > 1000) score += 10
  else if (backlinks > 100) score += 5

  return Math.round(Math.min(100, score))
}

/**
 * Generate mock Semrush data for development/testing
 */
function generateMockSemrushData(domain: string): SemrushData {
  return {
    domainAuthority: Math.floor(Math.random() * 40) + 30, // 30-70
    organicTraffic: Math.floor(Math.random() * 50000) + 5000, // 5k-55k
    backlinks: Math.floor(Math.random() * 5000) + 500, // 500-5500
    aiVisibilityScore: Math.floor(Math.random() * 40) + 40, // 40-80
    keywords: [
      {
        keyword: `${domain.split('.')[0]} services`,
        position: 3,
        volume: 1200,
        difficulty: 45
      },
      {
        keyword: `best ${domain.split('.')[0]}`,
        position: 7,
        volume: 800,
        difficulty: 62
      },
      {
        keyword: `${domain.split('.')[0]} near me`,
        position: 12,
        volume: 2100,
        difficulty: 38
      }
    ],
    topPages: [
      {
        url: `https://${domain}/`,
        traffic: 12500,
        keywords: 45
      },
      {
        url: `https://${domain}/services`,
        traffic: 8200,
        keywords: 32
      },
      {
        url: `https://${domain}/about`,
        traffic: 3100,
        keywords: 18
      }
    ],
    competitors: [
      {
        domain: `competitor1-${domain}`,
        commonKeywords: 28
      },
      {
        domain: `competitor2-${domain}`,
        commonKeywords: 22
      }
    ]
  }
}
