import 'server-only'
import OpenAI from 'openai'
import { StaticAnalysisSummary } from './ai-assessment'

// Lazy initialization to avoid build-time errors
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
    })
  }
  return openai
}

// Helper function to clean JSON response from markdown code blocks
function cleanJsonResponse(content: string): string {
  const cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()
  return cleaned
}

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_TEMPERATURE = 0
const OPENAI_RESPONSE_FORMAT = { type: 'json_object' as const }

export interface UnifiedAIAssessmentConfig {
  model: string
  temperature: number
  maxRetries: number
  timeout: number
  enableDetailedAnalysis: boolean
  enableSubMetrics: boolean
}

export interface UnifiedAIAssessmentResult {
  // Core scores (0-100 scale)
  overallScore: number
  confidence: number
  
  // Category scores (0-100 scale)
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  
  // Detailed analysis (if enabled)
  detailedAnalysis?: {
    instructionClarity: InstructionClarityAnalysis
    workflowAutomation: WorkflowAutomationAnalysis
    contextEfficiency: ContextEfficiencyAnalysis
    riskCompliance: RiskComplianceAnalysis
  }
  
  // Findings and recommendations
  findings: string[]
  recommendations: string[]
  
  // Metadata
  metadata: {
    model: string
    processingTime: number
    retryCount: number
    success: boolean
    error?: string
  }
}

export interface InstructionClarityAnalysis {
  stepByStepQuality: number
  commandClarity: number
  environmentSetup: number
  errorHandling: number
  dependencySpecification: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface WorkflowAutomationAnalysis {
  ciCdQuality: number
  testAutomation: number
  buildScripts: number
  deploymentAutomation: number
  monitoringLogging: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface ContextEfficiencyAnalysis {
  instructionFileOptimization: number
  codeDocumentation: number
  apiDocumentation: number
  contextWindowUsage: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface RiskComplianceAnalysis {
  securityPractices: number
  errorHandling: number
  inputValidation: number
  dependencySecurity: number
  licenseCompliance: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export class UnifiedAIAssessmentEngine {
  private config: UnifiedAIAssessmentConfig

  constructor(config?: Partial<UnifiedAIAssessmentConfig>) {
    this.config = {
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      maxRetries: 2,
      timeout: 30000,
      enableDetailedAnalysis: true,
      enableSubMetrics: true,
      ...config
    }
  }

  async assessRepository(staticAnalysis: StaticAnalysisSummary): Promise<UnifiedAIAssessmentResult> {
    const startTime = Date.now()
    let retryCount = 0
    let lastError: Error | null = null

    while (retryCount <= this.config.maxRetries) {
      try {
        const result = await this.performAssessment(staticAnalysis, 'repository')
        return {
          ...result,
          metadata: {
            model: this.config.model,
            processingTime: Date.now() - startTime,
            retryCount,
            success: true
          }
        }
      } catch (error) {
        lastError = error as Error
        retryCount++
        
        if (retryCount > this.config.maxRetries) {
          break
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
      }
    }

    // Fallback to static-only assessment
    return this.createFallbackAssessment(staticAnalysis, lastError)
  }

  async assessWebsite(staticAnalysis: StaticAnalysisSummary): Promise<UnifiedAIAssessmentResult> {
    const startTime = Date.now()
    let retryCount = 0
    let lastError: Error | null = null

    while (retryCount <= this.config.maxRetries) {
      try {
        const result = await this.performAssessment(staticAnalysis, 'website')
        return {
          ...result,
          metadata: {
            model: this.config.model,
            processingTime: Date.now() - startTime,
            retryCount,
            success: true
          }
        }
      } catch (error) {
        lastError = error as Error
        retryCount++
        
        if (retryCount > this.config.maxRetries) {
          break
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
      }
    }

    return this.createFallbackAssessment(staticAnalysis, lastError)
  }

  private async performAssessment(
    staticAnalysis: StaticAnalysisSummary, 
    type: 'repository' | 'website'
  ): Promise<Omit<UnifiedAIAssessmentResult, 'metadata'>> {
    const client = getOpenAI()
    
    const prompt = this.buildPrompt(staticAnalysis, type)
    
    const response = await client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(type)
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: OPENAI_RESPONSE_FORMAT
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response content from OpenAI')
    }

    const cleanedContent = cleanJsonResponse(content)
    const assessment = JSON.parse(cleanedContent)

    return this.validateAndNormalizeResult(assessment, type)
  }

  private buildPrompt(staticAnalysis: StaticAnalysisSummary, type: 'repository' | 'website'): string {
    if (type === 'repository') {
      return this.buildRepositoryPrompt(staticAnalysis)
    } else {
      return this.buildWebsitePrompt(staticAnalysis)
    }
  }

  private buildRepositoryPrompt(staticAnalysis: StaticAnalysisSummary): string {
    return `Analyze this repository for AI agent readiness:

Repository Analysis:
- Has README: ${staticAnalysis.hasReadme}
- Has CONTRIBUTING: ${staticAnalysis.hasContributing}
- Has AGENTS.md: ${staticAnalysis.hasAgents}
- Has LICENSE: ${staticAnalysis.hasLicense}
- Has CI/CD workflows: ${staticAnalysis.hasWorkflows}
- Has tests: ${staticAnalysis.hasTests}
- Languages: ${staticAnalysis.languages.join(', ')}
- Error handling: ${staticAnalysis.errorHandling}
- File count: ${staticAnalysis.fileCount}
- Lines of code: ${staticAnalysis.linesOfCode}
- Repository size: ${staticAnalysis.repositorySizeMB}MB

README Content:
${staticAnalysis.readmeContent || 'Not available'}

CONTRIBUTING Content:
${staticAnalysis.contributingContent || 'Not available'}

AGENTS.md Content:
${staticAnalysis.agentsContent || 'Not available'}

Workflow Files:
${staticAnalysis.workflowFiles.join(', ') || 'None'}

Test Files:
${staticAnalysis.testFiles.join(', ') || 'None'}

File Size Analysis:
${JSON.stringify(staticAnalysis.fileSizeAnalysis, null, 2)}

Please provide a comprehensive AI agent readiness assessment with scores from 0-100 for each category.`
  }

  private buildWebsitePrompt(staticAnalysis: StaticAnalysisSummary): string {
    return `Analyze this website for AI agent readiness:

Website Analysis:
- URL: ${staticAnalysis.websiteUrl}
- Page title: ${staticAnalysis.pageTitle}
- Meta description: ${staticAnalysis.metaDescription}
- Has structured data: ${staticAnalysis.hasStructuredData}
- Has OpenGraph: ${staticAnalysis.hasOpenGraph}
- Has Twitter cards: ${staticAnalysis.hasTwitterCards}
- Has sitemap: ${staticAnalysis.hasSitemap}
- Has robots.txt: ${staticAnalysis.hasRobotsTxt}
- Has favicon: ${staticAnalysis.hasFavicon}
- Content length: ${staticAnalysis.contentLength}
- Image count: ${staticAnalysis.imageCount}
- Link count: ${staticAnalysis.linkCount}
- Technologies: ${staticAnalysis.technologies?.join(', ') || 'None'}
- Social media links: ${JSON.stringify(staticAnalysis.socialMediaLinks, null, 2)}
- Contact info: ${staticAnalysis.contactInfo?.join(', ') || 'None'}

Please provide a comprehensive AI agent readiness assessment with scores from 0-100 for each category.`
  }

  private getSystemPrompt(type: 'repository' | 'website'): string {
    const basePrompt = `You are an expert AI agent readiness assessor. Evaluate the provided ${type} for its readiness to work with AI agents.

Assessment Categories (score 0-100 each):
1. Documentation: Quality and completeness of documentation
2. Instruction Clarity: Clear, actionable instructions for AI agents
3. Workflow Automation: Potential for automated workflows
4. Risk Compliance: Security, error handling, and compliance
5. Integration Structure: Code organization and API design
6. File Size Optimization: File sizes optimized for AI agent processing

Provide detailed analysis with specific findings and actionable recommendations.

Return your response as a JSON object with the following structure:
{
  "overallScore": <number 0-100>,
  "confidence": <number 0-100>,
  "categories": {
    "documentation": <number 0-100>,
    "instructionClarity": <number 0-100>,
    "workflowAutomation": <number 0-100>,
    "riskCompliance": <number 0-100>,
    "integrationStructure": <number 0-100>,
    "fileSizeOptimization": <number 0-100>
  },
  "detailedAnalysis": {
    "instructionClarity": {
      "stepByStepQuality": <number 0-20>,
      "commandClarity": <number 0-20>,
      "environmentSetup": <number 0-20>,
      "errorHandling": <number 0-20>,
      "dependencySpecification": <number 0-20>,
      "findings": ["<finding1>", "<finding2>"],
      "recommendations": ["<recommendation1>", "<recommendation2>"],
      "confidence": <number 0-100>
    },
    "workflowAutomation": {
      "ciCdQuality": <number 0-20>,
      "testAutomation": <number 0-20>,
      "buildScripts": <number 0-20>,
      "deploymentAutomation": <number 0-20>,
      "monitoringLogging": <number 0-20>,
      "findings": ["<finding1>", "<finding2>"],
      "recommendations": ["<recommendation1>", "<recommendation2>"],
      "confidence": <number 0-100>
    },
    "contextEfficiency": {
      "instructionFileOptimization": <number 0-20>,
      "codeDocumentation": <number 0-20>,
      "apiDocumentation": <number 0-20>,
      "contextWindowUsage": <number 0-20>,
      "findings": ["<finding1>", "<finding2>"],
      "recommendations": ["<recommendation1>", "<recommendation2>"],
      "confidence": <number 0-100>
    },
    "riskCompliance": {
      "securityPractices": <number 0-20>,
      "errorHandling": <number 0-20>,
      "inputValidation": <number 0-20>,
      "dependencySecurity": <number 0-20>,
      "licenseCompliance": <number 0-20>,
      "findings": ["<finding1>", "<finding2>"],
      "recommendations": ["<recommendation1>", "<recommendation2>"],
      "confidence": <number 0-100>
    }
  },
  "findings": ["<overall finding1>", "<overall finding2>"],
  "recommendations": ["<overall recommendation1>", "<overall recommendation2>"]
}`

    if (type === 'website') {
      return basePrompt + `

For websites, focus on:
- Information discoverability and structure
- Machine-readable content and APIs
- Contact information accessibility
- Business process automation potential
- AI agent interaction readiness`
    }

    return basePrompt + `

For repositories, focus on:
- Code documentation and comments
- Setup and installation instructions
- CI/CD and automation workflows
- Error handling and security practices
- File size optimization for agent processing`
  }

  private validateAndNormalizeResult(assessment: any, type: 'repository' | 'website'): Omit<UnifiedAIAssessmentResult, 'metadata'> {
    // Validate required fields
    if (!assessment.overallScore || typeof assessment.overallScore !== 'number') {
      throw new Error('Invalid overall score in AI assessment')
    }

    if (!assessment.categories || typeof assessment.categories !== 'object') {
      throw new Error('Invalid categories in AI assessment')
    }

    // Normalize scores to 0-100 range
    const normalizeScore = (score: any): number => {
      if (typeof score !== 'number') return 0
      return Math.max(0, Math.min(100, Math.round(score)))
    }

    return {
      overallScore: normalizeScore(assessment.overallScore),
      confidence: normalizeScore(assessment.confidence || 80),
      categories: {
        documentation: normalizeScore(assessment.categories.documentation || 0),
        instructionClarity: normalizeScore(assessment.categories.instructionClarity || 0),
        workflowAutomation: normalizeScore(assessment.categories.workflowAutomation || 0),
        riskCompliance: normalizeScore(assessment.categories.riskCompliance || 0),
        integrationStructure: normalizeScore(assessment.categories.integrationStructure || 0),
        fileSizeOptimization: normalizeScore(assessment.categories.fileSizeOptimization || 0)
      },
      detailedAnalysis: this.config.enableDetailedAnalysis ? assessment.detailedAnalysis : undefined,
      findings: Array.isArray(assessment.findings) ? assessment.findings.slice(0, 10) : [],
      recommendations: Array.isArray(assessment.recommendations) ? assessment.recommendations.slice(0, 10) : []
    }
  }

  private createFallbackAssessment(staticAnalysis: StaticAnalysisSummary, error: Error | null): UnifiedAIAssessmentResult {
    // Create a basic assessment based on static analysis only
    const hasDocumentation = staticAnalysis.hasReadme && staticAnalysis.hasContributing
    const hasAutomation = staticAnalysis.hasWorkflows && staticAnalysis.hasTests
    const hasStructure = staticAnalysis.languages.length > 0 && staticAnalysis.errorHandling

    const baseScore = hasDocumentation ? 40 : 20
    const automationBonus = hasAutomation ? 20 : 0
    const structureBonus = hasStructure ? 20 : 0
    const overallScore = Math.min(100, baseScore + automationBonus + structureBonus)

    return {
      overallScore,
      confidence: 60, // Lower confidence for fallback
      categories: {
        documentation: hasDocumentation ? 70 : 30,
        instructionClarity: staticAnalysis.hasAgents ? 80 : 40,
        workflowAutomation: hasAutomation ? 80 : 30,
        riskCompliance: staticAnalysis.errorHandling ? 70 : 40,
        integrationStructure: hasStructure ? 70 : 40,
        fileSizeOptimization: 50 // Neutral score for file size
      },
      findings: [
        'AI assessment unavailable - using static analysis only',
        error ? `Error: ${error.message}` : 'Fallback assessment based on static analysis'
      ],
      recommendations: [
        'Enable AI assessment for more detailed analysis',
        'Check OpenAI API configuration and connectivity'
      ],
      metadata: {
        model: this.config.model,
        processingTime: 0,
        retryCount: this.config.maxRetries,
        success: false,
        error: error?.message
      }
    }
  }
}

// Export convenience functions for backward compatibility
export async function generateUnifiedAIAssessment(
  staticAnalysis: StaticAnalysisSummary,
  type: 'repository' | 'website' = 'repository'
): Promise<UnifiedAIAssessmentResult> {
  const engine = new UnifiedAIAssessmentEngine()
  
  if (type === 'repository') {
    return engine.assessRepository(staticAnalysis)
  } else {
    return engine.assessWebsite(staticAnalysis)
  }
}