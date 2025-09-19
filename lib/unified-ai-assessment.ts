/**
 * Unified AI Assessment Engine
 * 
 * Consolidates functionality from ai-assessment.ts and enhanced-ai-assessment.ts
 * into a single, configurable AI assessment engine.
 */

import 'server-only'
import OpenAI from 'openai'
import { 
  AnalysisData, 
  AIAssessment, 
  DetailedAIAnalysis,
  InstructionClarityAnalysis,
  WorkflowAutomationAnalysis,
  ContextEfficiencyAnalysis,
  RiskComplianceAnalysis,
  IntegrationStructureAnalysis,
  FileSizeOptimizationAnalysis,
  AnalysisType,
  AssessmentOptions
} from './unified-types'

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
  enableDetailedAnalysis: boolean
  enableFallback: boolean
  maxRetries: number
  timeout: number
  model: string
  temperature: number
}

export class UnifiedAIAssessmentEngine {
  private config: UnifiedAIAssessmentConfig

  constructor(config?: Partial<UnifiedAIAssessmentConfig>) {
    this.config = {
      enableDetailedAnalysis: true,
      enableFallback: true,
      maxRetries: 2,
      timeout: 30000,
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      ...config
    }
  }

  /**
   * Main assessment method - handles both repository and website analysis
   */
  async assess(
    analysisData: AnalysisData, 
    type: AnalysisType, 
    options?: AssessmentOptions
  ): Promise<AIAssessment> {
    try {
      if (type === 'repository') {
        return await this.assessRepository(analysisData, options)
      } else {
        return await this.assessWebsite(analysisData, options)
      }
    } catch (error) {
      console.error('AI Assessment error:', error)
      
      if (this.config.enableFallback) {
        return this.generateFallbackAssessment(type)
      }
      
      throw error
    }
  }

  /**
   * Repository-specific AI assessment
   */
  private async assessRepository(
    analysisData: AnalysisData, 
    options?: AssessmentOptions
  ): Promise<AIAssessment> {
    const repositoryData = analysisData.repository
    if (!repositoryData) {
      throw new Error('Repository analysis data is required')
    }

    const prompt = this.generateRepositoryPrompt(repositoryData)
    const response = await this.callOpenAI(prompt)
    
    if (this.config.enableDetailedAnalysis && options?.includeDetailedAnalysis) {
      const detailedAnalysis = await this.generateDetailedRepositoryAnalysis(repositoryData)
      return {
        ...response,
        detailedAnalysis
      }
    }

    return response
  }

  /**
   * Website-specific AI assessment
   */
  private async assessWebsite(
    analysisData: AnalysisData, 
    options?: AssessmentOptions
  ): Promise<AIAssessment> {
    const websiteData = analysisData.website
    if (!websiteData) {
      throw new Error('Website analysis data is required')
    }

    const prompt = this.generateWebsitePrompt(websiteData)
    const response = await this.callOpenAI(prompt)
    
    if (this.config.enableDetailedAnalysis && options?.includeDetailedAnalysis) {
      const detailedAnalysis = await this.generateDetailedWebsiteAnalysis(websiteData)
      return {
        ...response,
        detailedAnalysis
      }
    }

    return response
  }

  /**
   * Generate repository assessment prompt
   */
  private generateRepositoryPrompt(repositoryData: any): string {
    return `You are an expert AI agent readiness assessor. Analyze this repository for AI agent compatibility.

Repository Analysis Data:
- Has README: ${repositoryData.hasReadme}
- Has Contributing: ${repositoryData.hasContributing}
- Has AGENTS.md: ${repositoryData.hasAgents}
- Has License: ${repositoryData.hasLicense}
- Has Workflows: ${repositoryData.hasWorkflows}
- Has Tests: ${repositoryData.hasTests}
- Languages: ${repositoryData.languages.join(', ')}
- File Count: ${repositoryData.fileCount}
- Repository Size: ${repositoryData.repositorySizeMB}MB
- Error Handling: ${repositoryData.errorHandling}

README Content (first 2000 chars):
${repositoryData.readmeContent?.substring(0, 2000) || 'Not available'}

AGENTS.md Content (first 2000 chars):
${repositoryData.agentsContent?.substring(0, 2000) || 'Not available'}

Evaluate the repository across these dimensions:
1. Instruction Clarity: Are setup/usage instructions clear and complete?
2. Workflow Automation: Is there good CI/CD and automation?
3. Context Efficiency: Is information well-organized for AI processing?
4. Risk & Compliance: Are there proper security and compliance measures?
5. Integration Structure: Is the code well-structured for AI integration?

Return a JSON response with:
{
  "enabled": boolean,
  "instructionClarity": boolean,
  "workflowAutomation": boolean,
  "contextEfficiency": boolean,
  "riskCompliance": boolean,
  "overallSuccess": boolean,
  "reason": "Brief explanation of the assessment"
}`
  }

  /**
   * Generate website assessment prompt
   */
  private generateWebsitePrompt(websiteData: any): string {
    return `You are an expert AI agent readiness assessor. Analyze this website for AI agent compatibility.

Website Analysis Data:
- URL: ${websiteData.url}
- Page Title: ${websiteData.pageTitle || 'Not available'}
- Meta Description: ${websiteData.metaDescription || 'Not available'}
- Has Structured Data: ${websiteData.hasStructuredData}
- Has Open Graph: ${websiteData.hasOpenGraph}
- Has Twitter Cards: ${websiteData.hasTwitterCards}
- Has Sitemap: ${websiteData.hasSitemap}
- Has Robots.txt: ${websiteData.hasRobotsTxt}
- Content Length: ${websiteData.contentLength}
- Technologies: ${websiteData.technologies.join(', ')}
- Contact Info: ${websiteData.contactInfo.join(', ')}
- Social Media Links: ${websiteData.socialMediaLinks.length}
- Locations: ${websiteData.locations.join(', ')}

Agent Readiness Features:
- Information Gathering: ${websiteData.agentReadinessFeatures?.informationGathering?.score || 0}/${websiteData.agentReadinessFeatures?.informationGathering?.maxScore || 100}
- Direct Booking: ${websiteData.agentReadinessFeatures?.directBooking?.score || 0}/${websiteData.agentReadinessFeatures?.directBooking?.maxScore || 100}
- FAQ Support: ${websiteData.agentReadinessFeatures?.faqSupport?.score || 0}/${websiteData.agentReadinessFeatures?.faqSupport?.maxScore || 100}
- Task Management: ${websiteData.agentReadinessFeatures?.taskManagement?.score || 0}/${websiteData.agentReadinessFeatures?.taskManagement?.maxScore || 100}
- Personalization: ${websiteData.agentReadinessFeatures?.personalization?.score || 0}/${websiteData.agentReadinessFeatures?.personalization?.maxScore || 100}

Evaluate the website across these dimensions:
1. Information Architecture: Is information well-organized and discoverable?
2. Machine-Readable Content: Is there good structured data and metadata?
3. Conversational Query Readiness: Is content optimized for AI processing?
4. Action-Oriented Functionality: Are there clear actions for AI agents?
5. Personalization & Context Awareness: Is there support for personalized interactions?

Return a JSON response with:
{
  "enabled": boolean,
  "instructionClarity": boolean,
  "workflowAutomation": boolean,
  "contextEfficiency": boolean,
  "riskCompliance": boolean,
  "overallSuccess": boolean,
  "reason": "Brief explanation of the assessment"
}`
  }

  /**
   * Generate detailed repository analysis
   */
  private async generateDetailedRepositoryAnalysis(repositoryData: any): Promise<DetailedAIAnalysis> {
    const prompts = {
      instructionClarity: this.generateInstructionClarityPrompt(repositoryData),
      workflowAutomation: this.generateWorkflowAutomationPrompt(repositoryData),
      contextEfficiency: this.generateContextEfficiencyPrompt(repositoryData),
      riskCompliance: this.generateRiskCompliancePrompt(repositoryData),
      integrationStructure: this.generateIntegrationStructurePrompt(repositoryData),
      fileSizeOptimization: this.generateFileSizeOptimizationPrompt(repositoryData)
    }

    const [instructionClarity, workflowAutomation, contextEfficiency, riskCompliance, integrationStructure, fileSizeOptimization] = await Promise.all([
      this.callOpenAI(prompts.instructionClarity).then(parseInstructionClarityAnalysis),
      this.callOpenAI(prompts.workflowAutomation).then(parseWorkflowAutomationAnalysis),
      this.callOpenAI(prompts.contextEfficiency).then(parseContextEfficiencyAnalysis),
      this.callOpenAI(prompts.riskCompliance).then(parseRiskComplianceAnalysis),
      this.callOpenAI(prompts.integrationStructure).then(parseIntegrationStructureAnalysis),
      this.callOpenAI(prompts.fileSizeOptimization).then(parseFileSizeOptimizationAnalysis)
    ])

    return {
      instructionClarity,
      workflowAutomation,
      contextEfficiency,
      riskCompliance,
      integrationStructure,
      fileSizeOptimization
    }
  }

  /**
   * Generate detailed website analysis
   */
  private async generateDetailedWebsiteAnalysis(websiteData: any): Promise<DetailedAIAnalysis> {
    // For websites, we focus on different aspects but use similar structure
    const prompts = {
      instructionClarity: this.generateWebsiteInstructionClarityPrompt(websiteData),
      workflowAutomation: this.generateWebsiteWorkflowAutomationPrompt(websiteData),
      contextEfficiency: this.generateWebsiteContextEfficiencyPrompt(websiteData),
      riskCompliance: this.generateWebsiteRiskCompliancePrompt(websiteData),
      integrationStructure: this.generateWebsiteIntegrationStructurePrompt(websiteData),
      fileSizeOptimization: this.generateWebsiteFileSizeOptimizationPrompt(websiteData)
    }

    const [instructionClarity, workflowAutomation, contextEfficiency, riskCompliance, integrationStructure, fileSizeOptimization] = await Promise.all([
      this.callOpenAI(prompts.instructionClarity).then(parseInstructionClarityAnalysis),
      this.callOpenAI(prompts.workflowAutomation).then(parseWorkflowAutomationAnalysis),
      this.callOpenAI(prompts.contextEfficiency).then(parseContextEfficiencyAnalysis),
      this.callOpenAI(prompts.riskCompliance).then(parseRiskComplianceAnalysis),
      this.callOpenAI(prompts.integrationStructure).then(parseIntegrationStructureAnalysis),
      this.callOpenAI(prompts.fileSizeOptimization).then(parseFileSizeOptimizationAnalysis)
    ])

    return {
      instructionClarity,
      workflowAutomation,
      contextEfficiency,
      riskCompliance,
      integrationStructure,
      fileSizeOptimization
    }
  }

  /**
   * Call OpenAI API with retry logic
   */
  private async callOpenAI(prompt: string): Promise<any> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await getOpenAI().chat.completions.create({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI agent readiness assessor. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          response_format: OPENAI_RESPONSE_FORMAT
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error('No response content from OpenAI')
        }

        const cleanedContent = cleanJsonResponse(content)
        return JSON.parse(cleanedContent)
      } catch (error) {
        lastError = error as Error
        console.warn(`OpenAI API attempt ${attempt + 1} failed:`, error)
        
        if (attempt < this.config.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    throw lastError || new Error('OpenAI API failed after all retries')
  }

  /**
   * Generate fallback assessment when AI fails
   */
  private generateFallbackAssessment(type: AnalysisType): AIAssessment {
    return {
      enabled: false,
      instructionClarity: false,
      workflowAutomation: false,
      contextEfficiency: false,
      riskCompliance: false,
      overallSuccess: false,
      reason: `AI assessment unavailable for ${type}. Using static analysis only.`
    }
  }

  // Prompt generation methods for detailed analysis
  private generateInstructionClarityPrompt(data: any): string {
    return `Analyze instruction clarity for this ${data.repository ? 'repository' : 'website'}...`
  }

  private generateWorkflowAutomationPrompt(data: any): string {
    return `Analyze workflow automation potential for this ${data.repository ? 'repository' : 'website'}...`
  }

  private generateContextEfficiencyPrompt(data: any): string {
    return `Analyze context efficiency for this ${data.repository ? 'repository' : 'website'}...`
  }

  private generateRiskCompliancePrompt(data: any): string {
    return `Analyze risk and compliance for this ${data.repository ? 'repository' : 'website'}...`
  }

  private generateIntegrationStructurePrompt(data: any): string {
    return `Analyze integration structure for this ${data.repository ? 'repository' : 'website'}...`
  }

  private generateFileSizeOptimizationPrompt(data: any): string {
    return `Analyze file size optimization for this ${data.repository ? 'repository' : 'website'}...`
  }

  // Website-specific prompt methods
  private generateWebsiteInstructionClarityPrompt(data: any): string {
    return `Analyze instruction clarity for this website...`
  }

  private generateWebsiteWorkflowAutomationPrompt(data: any): string {
    return `Analyze workflow automation potential for this website...`
  }

  private generateWebsiteContextEfficiencyPrompt(data: any): string {
    return `Analyze context efficiency for this website...`
  }

  private generateWebsiteRiskCompliancePrompt(data: any): string {
    return `Analyze risk and compliance for this website...`
  }

  private generateWebsiteIntegrationStructurePrompt(data: any): string {
    return `Analyze integration structure for this website...`
  }

  private generateWebsiteFileSizeOptimizationPrompt(data: any): string {
    return `Analyze file size optimization for this website...`
  }
}

// Parser functions for detailed analysis responses
function parseInstructionClarityAnalysis(response: any): InstructionClarityAnalysis {
  return {
    stepByStepQuality: response.stepByStepQuality || 0,
    commandClarity: response.commandClarity || 0,
    environmentSetup: response.environmentSetup || 0,
    errorHandling: response.errorHandling || 0,
    dependencySpecification: response.dependencySpecification || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

function parseWorkflowAutomationAnalysis(response: any): WorkflowAutomationAnalysis {
  return {
    ciCdQuality: response.ciCdQuality || 0,
    testAutomation: response.testAutomation || 0,
    buildScripts: response.buildScripts || 0,
    deploymentAutomation: response.deploymentAutomation || 0,
    monitoringLogging: response.monitoringLogging || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

function parseContextEfficiencyAnalysis(response: any): ContextEfficiencyAnalysis {
  return {
    informationCohesion: response.informationCohesion || 0,
    terminologyConsistency: response.terminologyConsistency || 0,
    crossReferenceQuality: response.crossReferenceQuality || 0,
    chunkingOptimization: response.chunkingOptimization || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

function parseRiskComplianceAnalysis(response: any): RiskComplianceAnalysis {
  return {
    securityPractices: response.securityPractices || 0,
    complianceAlignment: response.complianceAlignment || 0,
    safetyGuidelines: response.safetyGuidelines || 0,
    governanceDocumentation: response.governanceDocumentation || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

function parseIntegrationStructureAnalysis(response: any): IntegrationStructureAnalysis {
  return {
    codeOrganization: response.codeOrganization || 0,
    modularity: response.modularity || 0,
    apiDesign: response.apiDesign || 0,
    dependencies: response.dependencies || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

function parseFileSizeOptimizationAnalysis(response: any): FileSizeOptimizationAnalysis {
  return {
    criticalFileCompliance: response.criticalFileCompliance || 0,
    largeFileManagement: response.largeFileManagement || 0,
    contextWindowOptimization: response.contextWindowOptimization || 0,
    agentCompatibility: response.agentCompatibility || 0,
    findings: response.findings || [],
    recommendations: response.recommendations || [],
    confidence: response.confidence || 0
  }
}

// Export the main function for backward compatibility
export async function generateUnifiedAIAssessment(
  analysisData: AnalysisData,
  type: AnalysisType,
  options?: AssessmentOptions
): Promise<AIAssessment> {
  const engine = new UnifiedAIAssessmentEngine()
  return await engine.assess(analysisData, type, options)
}