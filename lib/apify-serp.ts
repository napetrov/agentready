import axios from 'axios'

export interface SerpResult {
  title: string
  url: string
  description: string
  position: number
  platform: string
}

export interface PlatformPresence {
  platform: string
  listed: boolean
  url?: string
  position?: number
  verified?: boolean
  rating?: number
  reviewCount?: number
}

export interface SerpData {
  query: string
  totalResults: number
  results: SerpResult[]
  platformPresence: PlatformPresence[]
  visibility: {
    google: boolean
    yelp: boolean
    facebook: boolean
    linkedin: boolean
    instagram: boolean
    twitter: boolean
    yellowPages: boolean
    bbb: boolean
  }
}

export interface SerpScraperResult {
  success: boolean
  data?: SerpData
  error?: string
}

/**
 * Scrape SERP data using Apify actor
 * @param businessName - The business name to search for
 * @param location - Optional location to narrow search
 * @param apifyToken - Apify API token for authentication
 */
export async function scrapeSerpData(
  businessName: string,
  location?: string,
  apifyToken?: string
): Promise<SerpScraperResult> {
  try {
    if (!apifyToken) {
      console.warn('⚠️ APIFY_API_TOKEN not provided, skipping SERP scraping')
      return {
        success: false,
        error: 'APIFY_API_TOKEN not configured'
      }
    }

    console.log(`🔍 Scraping SERP data for: ${businessName}`)

    const serpData = await runApifySerpScraper(businessName, location, apifyToken)

    console.log(`✅ SERP data scraped successfully for ${businessName}`)

    return {
      success: true,
      data: serpData
    }
  } catch (error: any) {
    console.error('❌ SERP scraping failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Run Apify SERP scraper actor
 * @param businessName - The business name to search
 * @param location - Optional location parameter
 * @param apifyToken - Apify API token
 */
export async function runApifySerpScraper(
  businessName: string,
  location: string | undefined,
  apifyToken: string
): Promise<SerpData> {
  try {
    // Use Apify's Google Search Results scraper
    const actorId = 'apify/google-search-scraper'

    const searchQuery = location ? `${businessName} ${location}` : businessName

    // Start actor run
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        queries: [searchQuery],
        maxPagesPerQuery: 1,
        resultsPerPage: 100,
        languageCode: 'en',
        countryCode: 'us',
        mobileResults: false
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
      throw new Error(`SERP scraping failed with status: ${status}`)
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

    // Parse and structure the SERP data
    return parseSerpResults(results, searchQuery)
  } catch (error: any) {
    console.error('❌ SERP API error:', error.message)
    
    // Return mock data in development or when API fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using mock SERP data in development')
      return generateMockSerpData(businessName, location)
    }
    
    throw error
  }
}

/**
 * Parse SERP results from Apify dataset
 */
function parseSerpResults(results: any[], query: string): SerpData {
  if (!results || results.length === 0) {
    throw new Error('No SERP data returned')
  }

  const organicResults = results[0]?.organicResults || []
  
  // Map results to our format
  const serpResults: SerpResult[] = organicResults.map((result: any, index: number) => ({
    title: result.title || '',
    url: result.url || result.link || '',
    description: result.description || result.snippet || '',
    position: result.position || index + 1,
    platform: extractPlatform(result.url || result.link || '')
  }))

  // Analyze platform presence
  const platformPresence = analyzePlatformPresence(serpResults)

  // Calculate visibility
  const visibility = {
    google: platformPresence.some(p => p.platform === 'Google' && p.listed),
    yelp: platformPresence.some(p => p.platform === 'Yelp' && p.listed),
    facebook: platformPresence.some(p => p.platform === 'Facebook' && p.listed),
    linkedin: platformPresence.some(p => p.platform === 'LinkedIn' && p.listed),
    instagram: platformPresence.some(p => p.platform === 'Instagram' && p.listed),
    twitter: platformPresence.some(p => p.platform === 'Twitter' && p.listed),
    yellowPages: platformPresence.some(p => p.platform === 'Yellow Pages' && p.listed),
    bbb: platformPresence.some(p => p.platform === 'BBB' && p.listed)
  }

  return {
    query,
    totalResults: results[0]?.searchInformation?.totalResults || organicResults.length,
    results: serpResults,
    platformPresence,
    visibility
  }
}

/**
 * Extract platform name from URL
 */
function extractPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    
    if (hostname.includes('google.com')) return 'Google'
    if (hostname.includes('yelp.com')) return 'Yelp'
    if (hostname.includes('facebook.com')) return 'Facebook'
    if (hostname.includes('linkedin.com')) return 'LinkedIn'
    if (hostname.includes('instagram.com')) return 'Instagram'
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'Twitter'
    if (hostname.includes('yellowpages.com')) return 'Yellow Pages'
    if (hostname.includes('bbb.org')) return 'BBB'
    if (hostname.includes('tripadvisor.com')) return 'TripAdvisor'
    if (hostname.includes('foursquare.com')) return 'Foursquare'
    
    return 'Other'
  } catch (e) {
    return 'Unknown'
  }
}

/**
 * Analyze platform presence from SERP results
 */
function analyzePlatformPresence(results: SerpResult[]): PlatformPresence[] {
  const platformMap = new Map<string, PlatformPresence>()

  for (const result of results) {
    if (!platformMap.has(result.platform)) {
      platformMap.set(result.platform, {
        platform: result.platform,
        listed: true,
        url: result.url,
        position: result.position,
        verified: false
      })
    }
  }

  return Array.from(platformMap.values())
}

/**
 * Generate mock SERP data for development/testing
 */
function generateMockSerpData(
  businessName: string,
  location?: string
): SerpData {
  const query = location ? `${businessName} ${location}` : businessName
  
  const mockResults: SerpResult[] = [
    {
      title: `${businessName} - Official Website`,
      url: `https://${businessName.toLowerCase().replace(/\s+/g, '')}.com`,
      description: `Welcome to ${businessName}. We provide excellent service and quality products.`,
      position: 1,
      platform: 'Other'
    },
    {
      title: `${businessName} - Google Business Profile`,
      url: `https://www.google.com/maps/place/${encodeURIComponent(businessName)}`,
      description: `View ${businessName} on Google Maps. See ratings, reviews, hours, and photos.`,
      position: 2,
      platform: 'Google'
    },
    {
      title: `${businessName} - Yelp`,
      url: `https://www.yelp.com/biz/${businessName.toLowerCase().replace(/\s+/g, '-')}`,
      description: `Read reviews and see photos of ${businessName} on Yelp.`,
      position: 3,
      platform: 'Yelp'
    },
    {
      title: `${businessName} | Facebook`,
      url: `https://www.facebook.com/${businessName.toLowerCase().replace(/\s+/g, '')}`,
      description: `Connect with ${businessName} on Facebook. See posts, photos, and more.`,
      position: 4,
      platform: 'Facebook'
    },
    {
      title: `${businessName} | LinkedIn`,
      url: `https://www.linkedin.com/company/${businessName.toLowerCase().replace(/\s+/g, '-')}`,
      description: `View ${businessName}'s professional profile on LinkedIn.`,
      position: 5,
      platform: 'LinkedIn'
    }
  ]

  const platformPresence: PlatformPresence[] = [
    { platform: 'Google', listed: true, url: mockResults[1].url, position: 2, verified: true },
    { platform: 'Yelp', listed: true, url: mockResults[2].url, position: 3, verified: true, rating: 4.5, reviewCount: 120 },
    { platform: 'Facebook', listed: true, url: mockResults[3].url, position: 4, verified: false },
    { platform: 'LinkedIn', listed: true, url: mockResults[4].url, position: 5, verified: true }
  ]

  return {
    query,
    totalResults: 125000,
    results: mockResults,
    platformPresence,
    visibility: {
      google: true,
      yelp: true,
      facebook: true,
      linkedin: true,
      instagram: false,
      twitter: false,
      yellowPages: false,
      bbb: false
    }
  }
}

/**
 * Calculate visibility score based on platform presence
 */
export function calculateVisibilityScore(serpData: SerpData): number {
  let score = 0
  const weights = {
    google: 30,
    yelp: 20,
    facebook: 15,
    linkedin: 10,
    instagram: 10,
    twitter: 5,
    yellowPages: 5,
    bbb: 5
  }

  for (const [platform, weight] of Object.entries(weights)) {
    if (serpData.visibility[platform as keyof typeof serpData.visibility]) {
      score += weight
    }
  }

  return score
}
