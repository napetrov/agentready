/**
 * Enhanced types for admin scan data
 */

/**
 * Enhanced Finding type with URL and evidence fields
 */
export interface Finding {
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  url?: string // URL to the page where the issue was found
  evidence?: string // Specific evidence or code snippet
  recommendation: string
  impact?: string
  effort?: 'low' | 'medium' | 'high'
}

/**
 * Admin report data structure
 */
export interface AdminReportData {
  websiteUrl: string
  generatedAt: string
  
  // Basic website info
  pageTitle: string
  metaDescription: string
  
  // Semrush data
  semrush?: {
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
  
  // Google Business Profile data
  googleBusiness?: {
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
  
  // Yelp data
  yelp?: {
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
  
  // SERP data
  serp?: {
    query: string
    totalResults: number
    results: Array<{
      title: string
      url: string
      description: string
      position: number
      platform: string
    }>
    platformPresence: Array<{
      platform: string
      listed: boolean
      url?: string
      position?: number
      verified?: boolean
      rating?: number
      reviewCount?: number
    }>
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
  
  // Enhanced findings with URLs and evidence
  findings: Finding[]
  
  // Recommendations
  recommendations: string[]
  
  // Overall scores
  scores: {
    aiVisibility: number
    onlinePresence: number
    reviewReputation: number
    seoPerformance: number
    overall: number
  }
}

/**
 * Generate finding with structured data
 */
export function createFinding(
  category: string,
  severity: Finding['severity'],
  title: string,
  description: string,
  recommendation: string,
  options?: {
    url?: string
    evidence?: string
    impact?: string
    effort?: Finding['effort']
  }
): Finding {
  return {
    category,
    severity,
    title,
    description,
    url: options?.url,
    evidence: options?.evidence,
    recommendation,
    impact: options?.impact,
    effort: options?.effort
  }
}

/**
 * Categorize findings by severity
 */
export function categorizeFindingsBySeverity(findings: Finding[]): {
  critical: Finding[]
  high: Finding[]
  medium: Finding[]
  low: Finding[]
  info: Finding[]
} {
  return {
    critical: findings.filter(f => f.severity === 'critical'),
    high: findings.filter(f => f.severity === 'high'),
    medium: findings.filter(f => f.severity === 'medium'),
    low: findings.filter(f => f.severity === 'low'),
    info: findings.filter(f => f.severity === 'info')
  }
}

/**
 * Categorize findings by category
 */
export function categorizeFindingsByCategory(findings: Finding[]): Record<string, Finding[]> {
  const categorized: Record<string, Finding[]> = {}
  
  for (const finding of findings) {
    if (!categorized[finding.category]) {
      categorized[finding.category] = []
    }
    categorized[finding.category].push(finding)
  }
  
  return categorized
}

/**
 * Priority score for findings (higher = more important)
 */
export function calculateFindingPriority(finding: Finding): number {
  const severityWeights = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
    info: 10
  }
  
  const effortWeights = {
    low: 1.5,    // Low effort = higher priority
    medium: 1.0,
    high: 0.5    // High effort = lower priority
  }
  
  let score = severityWeights[finding.severity]
  
  if (finding.effort) {
    score *= effortWeights[finding.effort]
  }
  
  // Findings with evidence get a slight boost
  if (finding.evidence) {
    score *= 1.1
  }
  
  return Math.round(score)
}

/**
 * Sort findings by priority
 */
export function sortFindingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const priorityA = calculateFindingPriority(a)
    const priorityB = calculateFindingPriority(b)
    return priorityB - priorityA
  })
}
