import axios from 'axios'

export interface GoogleBusinessProfile {
  name: string
  address: string
  phone: string
  website: string
  rating: number
  reviewCount: number
  categories: string[]
  hours: Record<string, string>
  photos: string[]
  reviews: Array<{
    author: string
    rating: number
    text: string
    date: string
  }>
  attributes: string[]
  verified: boolean
}

export interface GoogleBusinessData {
  success: boolean
  profile?: GoogleBusinessProfile
  error?: string
}

/**
 * Scrape Google Business Profile data using Apify actor
 * @param businessName - The business name to search for
 * @param location - Optional location to narrow search
 * @param apifyToken - Apify API token for authentication
 */
export async function scrapeGoogleBusinessProfile(
  businessName: string,
  location?: string,
  apifyToken?: string
): Promise<GoogleBusinessData> {
  try {
    if (!apifyToken) {
      console.warn('⚠️ APIFY_API_TOKEN not provided, skipping Google Business Profile scraping')
      return {
        success: false,
        error: 'APIFY_API_TOKEN not configured'
      }
    }

    console.log(`🔍 Scraping Google Business Profile for: ${businessName}`)

    const profile = await runGoogleBusinessScraper(businessName, location, apifyToken)

    console.log(`✅ Google Business Profile scraped successfully for ${businessName}`)

    return {
      success: true,
      profile
    }
  } catch (error: any) {
    console.error('❌ Google Business Profile scraping failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Run Google Business Profile scraper using Apify actor
 * @param businessName - The business name to search
 * @param location - Optional location parameter
 * @param apifyToken - Apify API token
 */
export async function runGoogleBusinessScraper(
  businessName: string,
  location: string | undefined,
  apifyToken: string
): Promise<GoogleBusinessProfile> {
  try {
    // Use Apify's Google Maps scraper actor
    const actorId = 'nwua9Gu5YrADL7ZDj' // Google Maps Scraper by drobnikj

    const searchQuery = location ? `${businessName} ${location}` : businessName

    // Start actor run
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 1,
        language: 'en',
        includeReviews: true,
        maxReviews: 50,
        includeImages: true,
        maxImages: 10
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
      throw new Error(`Google Business Profile scraping failed with status: ${status}`)
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

    // Parse and structure the Google Business Profile data
    return parseGoogleBusinessResults(results)
  } catch (error: any) {
    console.error('❌ Google Business Profile API error:', error.message)
    
    // Return mock data in development or when API fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using mock Google Business Profile data in development')
      return generateMockGoogleBusinessData(businessName, location)
    }
    
    throw error
  }
}

/**
 * Parse Google Business Profile results from Apify dataset
 */
function parseGoogleBusinessResults(results: any[]): GoogleBusinessProfile {
  if (!results || results.length === 0) {
    throw new Error('No Google Business Profile data returned')
  }

  const data = results[0]

  return {
    name: data.title || data.name || '',
    address: data.address || data.location?.address || '',
    phone: data.phone || data.phoneNumber || '',
    website: data.website || data.url || '',
    rating: data.totalScore || data.rating || 0,
    reviewCount: data.reviewsCount || data.reviews?.length || 0,
    categories: data.categories || data.category ? [data.category] : [],
    hours: data.openingHours || data.hours || {},
    photos: (data.imageUrls || data.images || []).slice(0, 10),
    reviews: (data.reviews || []).slice(0, 50).map((review: any) => ({
      author: review.name || review.author || 'Anonymous',
      rating: review.stars || review.rating || 0,
      text: review.text || review.reviewText || '',
      date: review.publishedAtDate || review.date || ''
    })),
    attributes: data.attributes || data.amenities || [],
    verified: data.claimStatus === 'CLAIMED' || data.verified || false
  }
}

/**
 * Generate mock Google Business Profile data for development/testing
 */
function generateMockGoogleBusinessData(
  businessName: string,
  location?: string
): GoogleBusinessProfile {
  return {
    name: businessName,
    address: location ? `123 Main St, ${location}` : '123 Main St, City, ST 12345',
    phone: '(555) 123-4567',
    website: `https://${businessName.toLowerCase().replace(/\s+/g, '')}.com`,
    rating: 4.2 + Math.random() * 0.8, // 4.2-5.0
    reviewCount: Math.floor(Math.random() * 500) + 50, // 50-550
    categories: ['Business', 'Service'],
    hours: {
      Monday: '9:00 AM - 5:00 PM',
      Tuesday: '9:00 AM - 5:00 PM',
      Wednesday: '9:00 AM - 5:00 PM',
      Thursday: '9:00 AM - 5:00 PM',
      Friday: '9:00 AM - 5:00 PM',
      Saturday: 'Closed',
      Sunday: 'Closed'
    },
    photos: [
      'https://via.placeholder.com/400x300',
      'https://via.placeholder.com/400x300',
      'https://via.placeholder.com/400x300'
    ],
    reviews: [
      {
        author: 'John Doe',
        rating: 5,
        text: 'Excellent service! Highly recommended.',
        date: '2024-01-15'
      },
      {
        author: 'Jane Smith',
        rating: 4,
        text: 'Good experience overall. Professional staff.',
        date: '2024-01-10'
      },
      {
        author: 'Bob Johnson',
        rating: 5,
        text: 'Outstanding quality and attention to detail.',
        date: '2024-01-05'
      }
    ],
    attributes: ['Wheelchair accessible', 'Free Wi-Fi', 'Parking available'],
    verified: true
  }
}

/**
 * Extract business name from website URL or content
 * @param websiteUrl - The website URL
 * @param pageTitle - The page title from the website
 */
export function extractBusinessName(websiteUrl: string, pageTitle: string): string {
  // First try to use the page title
  if (pageTitle && pageTitle.length > 0 && pageTitle.toLowerCase() !== 'home') {
    // Remove common suffixes
    const cleaned = pageTitle
      .replace(/\s*[-|]\s*(Home|Welcome).*$/i, '')
      .replace(/\s*[-|]\s*Official Site.*$/i, '')
      .trim()
    
    if (cleaned.length > 0) {
      return cleaned
    }
  }

  // Fallback to domain name
  try {
    const url = new URL(websiteUrl)
    const domain = url.hostname.replace(/^www\./, '')
    const parts = domain.split('.')
    
    if (parts.length > 0) {
      // Capitalize first letter of each word
      return parts[0]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
  } catch (e) {
    // Invalid URL, return as-is
  }

  return websiteUrl
}
