import { NextRequest, NextResponse } from 'next/server'
import { analyzeRepository, analyzeWebsite, WebsiteAnalysisResult } from '../../../lib/analyzer'
import { generateEnhancedAIAssessment, generateWebsiteAIAssessment } from '../../../lib/enhanced-ai-assessment'
import { AlignedAssessmentEngine } from '../../../lib/aligned-assessment-engine'
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
    if (parts[0] >= 224) return false // 224/4 multicast and 240/4 reserved
    
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

    // Initialize aligned assessment engine
    const assessmentEngine = new AlignedAssessmentEngine({
      enableValidation: true,
      requireAlignment: false, // Set to true for strict alignment requirements
      maxRetries: 2,
      fallbackToStatic: true
    })

    // Perform aligned assessment based on input type
    let result: any
    
    if (inputType === 'repository') {
      result = await assessmentEngine.assessRepository(inputUrl)
    } else {
      result = await assessmentEngine.assessWebsite(inputUrl)
    }

    // Add legacy compatibility fields for existing frontend
    const legacyResult = {
      readinessScore: result.overallScore.value,
      aiAnalysisStatus: {
        enabled: result.assessmentStatus.aiAnalysisEnabled,
        instructionClarity: result.assessmentStatus.aiAnalysisEnabled,
        workflowAutomation: result.assessmentStatus.aiAnalysisEnabled,
        contextEfficiency: result.assessmentStatus.aiAnalysisEnabled,
        riskCompliance: result.assessmentStatus.aiAnalysisEnabled,
        overallSuccess: result.assessmentStatus.aiAnalysisEnabled && result.validation.passed
      },
      staticAnalysis: result.staticAnalysis || {},
      websiteAnalysis: result.websiteAnalysis || null,
      categories: {
        documentation: result.categories.documentation.score.value,
        instructionClarity: result.categories.instructionClarity.score.value,
        workflowAutomation: result.categories.workflowAutomation.score.value,
        riskCompliance: result.categories.riskCompliance.score.value,
        integrationStructure: result.categories.integrationStructure.score.value,
        fileSizeOptimization: result.categories.fileSizeOptimization.score.value
      },
      findings: result.insights.findings.slice(0, 10), // Use unified insights
      recommendations: result.insights.recommendations.slice(0, 10), // Use unified insights
      detailedAnalysis: {
        instructionClarity: {
          stepByStepQuality: result.categories.instructionClarity.subMetrics.stepByStepQuality?.value || 0,
          commandClarity: result.categories.instructionClarity.subMetrics.commandClarity?.value || 0,
          environmentSetup: result.categories.instructionClarity.subMetrics.environmentSetup?.value || 0,
          errorHandling: result.categories.instructionClarity.subMetrics.errorHandling?.value || 0,
          dependencySpecification: result.categories.instructionClarity.subMetrics.dependencySpecification?.value || 0,
          overallScore: result.categories.instructionClarity.score.value
        },
        workflowAutomation: {
          ciCdQuality: result.categories.workflowAutomation.subMetrics.ciCdQuality?.value || 0,
          testAutomation: result.categories.workflowAutomation.subMetrics.testAutomation?.value || 0,
          buildScripts: result.categories.workflowAutomation.subMetrics.buildScripts?.value || 0,
          deploymentAutomation: result.categories.workflowAutomation.subMetrics.deploymentAutomation?.value || 0,
          monitoringLogging: result.categories.workflowAutomation.subMetrics.monitoringLogging?.value || 0,
          overallScore: result.categories.workflowAutomation.score.value
        },
        contextEfficiency: {
          instructionFileOptimization: result.categories.fileSizeOptimization.subMetrics.instructionFileOptimization?.value || 0,
          codeDocumentation: result.categories.documentation.subMetrics.codeDocumentation?.value || 0,
          apiDocumentation: result.categories.integrationStructure.subMetrics.apiDocumentation?.value || 0,
          contextWindowUsage: result.categories.fileSizeOptimization.subMetrics.contextWindowUsage?.value || 0,
          overallScore: result.categories.fileSizeOptimization.score.value
        },
        riskCompliance: {
          securityPractices: result.categories.riskCompliance.subMetrics.securityPractices?.value || 0,
          errorHandling: result.categories.riskCompliance.subMetrics.errorHandling?.value || 0,
          inputValidation: result.categories.riskCompliance.subMetrics.inputValidation?.value || 0,
          dependencySecurity: result.categories.riskCompliance.subMetrics.dependencySecurity?.value || 0,
          licenseCompliance: result.categories.riskCompliance.subMetrics.licenseCompliance?.value || 0,
          overallScore: result.categories.riskCompliance.score.value
        }
      },
      confidence: {
        overall: result.overallScore.confidence,
        instructionClarity: result.categories.instructionClarity.score.confidence,
        workflowAutomation: result.categories.workflowAutomation.score.confidence,
        contextEfficiency: result.categories.fileSizeOptimization.score.confidence,
        riskCompliance: result.categories.riskCompliance.score.confidence
      },
      // Include new aligned assessment data
      alignedAssessment: {
        validation: result.validation,
        assessmentMetadata: result.assessmentMetadata,
        unifiedMetrics: {
          overallScore: result.overallScore,
          categories: result.categories,
          assessmentStatus: result.assessmentStatus
        }
      },
      // Business-type-aware website analysis data
      businessTypeAnalysis: result.websiteAnalysis ? {
        businessType: result.websiteAnalysis.businessType,
        businessTypeConfidence: result.websiteAnalysis.businessTypeConfidence,
        overallScore: result.websiteAnalysis.overallScore,
        agenticFlows: result.websiteAnalysis.agenticFlows,
        aiRelevantChecks: result.websiteAnalysis.aiRelevantChecks,
        findings: (result.websiteAnalysis.findings || []).slice(0, 10),
        recommendations: (result.websiteAnalysis.recommendations || []).slice(0, 10)
      } : null
    }

    return NextResponse.json(legacyResult)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze source' },
      { status: 500 }
    )
  }
}