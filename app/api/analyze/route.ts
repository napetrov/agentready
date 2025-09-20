import { NextRequest, NextResponse } from 'next/server'
import { UnifiedAssessmentEngine } from '../../../lib/unified-assessment-engine'
import { AssessmentInput } from '../../../lib/unified-types'
import { promises as dns } from 'dns'

// Helper function to check if an IP address is public/routable
function isPublicIP(ip: string): boolean {
  // IPv4 checks
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number)
    if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) return false
    
    // Private/reserved ranges
    if (parts[0] === 0) return false // 0.0.0.0/8
    if (parts[0] === 10) return false
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false
    if (parts[0] === 192 && parts[1] === 168) return false
    if (parts[0] === 127) return false // loopback
    if (parts[0] === 169 && parts[1] === 254) return false // link-local
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false // 100.64/10
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return false // 198.18/15
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return false // 192.0.0.0/24
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return false // 192.0.2.0/24
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return false // 198.51.100.0/24
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return false // 203.0.113.0/24
    if (parts[0] >= 224) return false // 224-239: multicast (Class D), 240-255: reserved (Class E)
    
    return true
  }
  
  // IPv6 checks
  if (ip.includes(':')) {
    if (ip === '::' || ip === '::1') return false // unspecified/loopback
    // Link-local
    if (ip.startsWith('fe80:')) return false
    // Unique local
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return false
    // Documentation range
    if (ip.toLowerCase().startsWith('2001:db8')) return false
    // IPv4-mapped
    if (ip.startsWith('::ffff:') && ip.includes('.')) {
      const v4 = ip.substring('::ffff:'.length)
      return isPublicIP(v4)
    }
    
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

    // Initialize unified assessment engine
    const assessmentEngine = new UnifiedAssessmentEngine({
      enableAIAssessment: true,
      enableValidation: true,
      requireAlignment: false,
      maxRetries: 2,
      fallbackToStatic: true,
      timeout: 30000,
      includeDetailedAnalysis: true
    })

    // Perform unified assessment
    const input: AssessmentInput = {
      url: inputUrl,
      type: inputType as 'repository' | 'website',
      options: {
        enableAIAssessment: true,
        enableValidation: true,
        maxRetries: 2,
        timeout: 30000,
        includeDetailedAnalysis: true
      }
    }

    const result = await assessmentEngine.assess(input)

    // Convert to legacy format for backward compatibility
    const legacyResult = assessmentEngine.convertToLegacyFormat(result)

    return NextResponse.json(legacyResult)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze source' },
      { status: 500 }
    )
  }
}