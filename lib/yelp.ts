import axios from 'axios'

export interface YelpBusiness {
  name: string
  rating: number
  reviewCount: number
  priceLevel: string
  categories: string[]
  address: string
  phone: string
  website: string
  hours: Record<string, string>
  photos: string[]
  reviews: Array<{
    author: string
    rating: number
    text: string
    date: string
    helpful: number
  }>
  attributes: string[]
  claimed: boolean
}

export interface YelpData {
  success: boolean
  business?: YelpBusiness
  error?: string
}

/**
 * Scrape Yelp business data using Apify actor
 * @param businessName - The business name to search for
 * @param location - Optional location to narrow search
 * @param apifyToken - Apify API token for authentication
 */
export async function scrapeYelpBusiness(
  businessName: string,
  location?: string,
  apifyToken?: string
): Promise<YelpData> {
  try {
    if (!apifyToken) {
      console.warn('⚠️ APIFY_API_TOKEN not provided, skipping Yelp scraping')
      return {
        success: false,
        error: 'APIFY_API_TOKEN not configured'
      }
    }

    console.log(`🔍 Scraping Yelp data for: ${businessName}`)

    const business = await runYelpScraper(businessName, location, apifyToken)

    console.log(`✅ Yelp data scraped successfully for ${businessName}`)

    return {
      success: true,
      business
    }
  } catch (error: any) {
    console.error('❌ Yelp scraping failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Run Yelp scraper using Apify actor
 * @param businessName - The business name to search
 * @param location - Optional location parameter
 * @param apifyToken - Apify API token
 */
export async function runYelpScraper(
  businessName: string,
  location: string | undefined,
  apifyToken: string
): Promise<YelpBusiness> {
  try {
    // Use Apify's Yelp scraper actor
    const actorId = 'trudax/yelp-scraper' // Yelp Scraper by Trudax

    const searchQuery = location ? `${businessName} ${location}` : businessName

    // Start actor run
    const runResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      {
        searchTerms: [searchQuery],
        maxItems: 1,
        includeReviews: true,
        maxReviews: 50
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
      throw new Error(`Yelp scraping failed with status: ${status}`)
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

    // Parse and structure the Yelp data
    return parseYelpResults(results)
  } catch (error: any) {
    console.error('❌ Yelp API error:', error.message)
    
    // Return mock data in development or when API fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Using mock Yelp data in development')
      return generateMockYelpData(businessName, location)
    }
    
    throw error
  }
}

/**
 * Parse Yelp results from Apify dataset
 */
function parseYelpResults(results: any[]): YelpBusiness {
  if (!results || results.length === 0) {
    throw new Error('No Yelp data returned')
  }

  const data = results[0]

  return {
    name: data.name || data.businessName || '',
    rating: data.rating || data.stars || 0,
    reviewCount: data.reviewCount || data.numberOfReviews || 0,
    priceLevel: data.priceRange || data.price || '',
    categories: data.categories || data.category ? [data.category] : [],
    address: data.address || data.location?.address || '',
    phone: data.phone || data.phoneNumber || '',
    website: data.website || data.businessUrl || '',
    hours: data.hours || data.openingHours || {},
    photos: (data.photos || data.images || []).slice(0, 10),
    reviews: (data.reviews || []).slice(0, 50).map((review: any) => ({
      author: review.userName || review.author || 'Anonymous',
      rating: review.rating || review.stars || 0,
      text: review.text || review.reviewText || '',
      date: review.date || review.publishedDate || '',
      helpful: review.useful || review.helpfulCount || 0
    })),
    attributes: data.attributes || data.amenities || [],
    claimed: data.claimed || data.isClaimed || false
  }
}

/**
 * Generate mock Yelp data for development/testing
 */
function generateMockYelpData(
  businessName: string,
  location?: string
): YelpBusiness {
  return {
    name: businessName,
    rating: 4.0 + Math.random() * 1.0, // 4.0-5.0
    reviewCount: Math.floor(Math.random() * 300) + 50, // 50-350
    priceLevel: '$$',
    categories: ['Business', 'Service', 'Local'],
    address: location ? `456 Oak Ave, ${location}` : '456 Oak Ave, City, ST 12345',
    phone: '(555) 987-6543',
    website: `https://${businessName.toLowerCase().replace(/\s+/g, '')}.com`,
    hours: {
      Monday: '10:00 AM - 6:00 PM',
      Tuesday: '10:00 AM - 6:00 PM',
      Wednesday: '10:00 AM - 6:00 PM',
      Thursday: '10:00 AM - 6:00 PM',
      Friday: '10:00 AM - 8:00 PM',
      Saturday: '10:00 AM - 8:00 PM',
      Sunday: '12:00 PM - 5:00 PM'
    },
    photos: [
      'https://via.placeholder.com/400x300',
      'https://via.placeholder.com/400x300',
      'https://via.placeholder.com/400x300'
    ],
    reviews: [
      {
        author: 'Alice Williams',
        rating: 5,
        text: 'Amazing experience! The team was professional and efficient.',
        date: '2024-01-20',
        helpful: 12
      },
      {
        author: 'Mike Brown',
        rating: 4,
        text: 'Great service, would definitely recommend to others.',
        date: '2024-01-15',
        helpful: 8
      },
      {
        author: 'Sarah Davis',
        rating: 5,
        text: 'Exceeded my expectations in every way. Highly satisfied!',
        date: '2024-01-10',
        helpful: 15
      }
    ],
    attributes: [
      'Accepts Credit Cards',
      'Good for Groups',
      'Wheelchair Accessible',
      'Free Wi-Fi'
    ],
    claimed: true
  }
}

/**
 * Merge review data from multiple sources
 * @param googleReviews - Reviews from Google Business Profile
 * @param yelpReviews - Reviews from Yelp
 */
export function mergeReviews(
  googleReviews: Array<{ author: string; rating: number; text: string; date: string }>,
  yelpReviews: Array<{ author: string; rating: number; text: string; date: string; helpful: number }>
): Array<{ source: string; author: string; rating: number; text: string; date: string; helpful?: number }> {
  const merged = [
    ...googleReviews.map(r => ({ ...r, source: 'Google' })),
    ...yelpReviews.map(r => ({ ...r, source: 'Yelp' }))
  ]

  // Sort by date (newest first)
  return merged.sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return dateB - dateA
  })
}

/**
 * Calculate average rating across platforms
 */
export function calculateAverageRating(
  googleRating: number,
  yelpRating: number,
  googleWeight: number = 0.6,
  yelpWeight: number = 0.4
): number {
  return Math.round((googleRating * googleWeight + yelpRating * yelpWeight) * 10) / 10
}
