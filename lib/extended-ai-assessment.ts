import 'server-only'
import OpenAI from 'openai'
import { StaticAnalysisSummary } from './ai-assessment'
import { GitHubRepositoryData } from './github-api-client'

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

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_TEMPERATURE = 0
const OPENAI_RESPONSE_FORMAT = { type: 'json_object' as const }

export interface ProjectArchitectureAnalysis {
  codeOrganization: number
  modularity: number
  apiDesign: number
  scalability: number
  maintainability: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface CodeQualityAnalysis {
  complexity: number
  readability: number
  documentation: number
  errorHandling: number
  testing: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface DevelopmentPracticesAnalysis {
  versionControl: number
  branchManagement: number
  codeReview: number
  continuousIntegration: number
  deployment: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface AgentIntegrationReadinessAnalysis {
  compatibility: number
  contextOptimization: number
  fileStructure: number
  agentRequirements: number
  processingEfficiency: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface MaintenanceSustainabilityAnalysis {
  maintenancePatterns: number
  communityEngagement: number
  documentationCompleteness: number
  longTermViability: number
  supportStructure: number
  findings: string[]
  recommendations: string[]
  confidence: number
}

export interface ExtendedAIAssessmentResult {
  readinessScore: number
  aiAnalysisStatus: {
    enabled: boolean
    projectArchitecture: boolean
    codeQuality: boolean
    developmentPractices: boolean
    agentIntegration: boolean
    maintenanceSustainability: boolean
    overallSuccess: boolean
    reason?: string
  }
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
    // New categories
    projectArchitecture: number
    codeQuality: number
    developmentPractices: number
    agentIntegration: number
    maintenanceSustainability: number
  }
  findings: string[]
  recommendations: string[]
  detailedAnalysis: {
    projectArchitecture: {
      codeOrganization: number
      modularity: number
      apiDesign: number
      scalability: number
      maintainability: number
      overallScore: number
    }
    codeQuality: {
      complexity: number
      readability: number
      documentation: number
      errorHandling: number
      testing: number
      overallScore: number
    }
    developmentPractices: {
      versionControl: number
      branchManagement: number
      codeReview: number
      continuousIntegration: number
      deployment: number
      overallScore: number
    }
    agentIntegration: {
      compatibility: number
      contextOptimization: number
      fileStructure: number
      agentRequirements: number
      processingEfficiency: number
      overallScore: number
    }
    maintenanceSustainability: {
      maintenancePatterns: number
      communityEngagement: number
      documentationCompleteness: number
      longTermViability: number
      supportStructure: number
      overallScore: number
    }
  }
  confidence: {
    overall: number
    projectArchitecture: number
    codeQuality: number
    developmentPractices: number
    agentIntegration: number
    maintenanceSustainability: number
  }
}

export async function generateExtendedAIAssessment(
  staticAnalysis: StaticAnalysisSummary,
  githubData?: GitHubRepositoryData
): Promise<ExtendedAIAssessmentResult> {
  try {
    console.log('🔍 Starting Extended AI Assessment...')
    console.log('📊 Static Analysis Summary:', {
      hasReadme: staticAnalysis.hasReadme,
      hasAgents: staticAnalysis.hasAgents,
      hasWorkflows: staticAnalysis.hasWorkflows,
      hasTests: staticAnalysis.hasTests,
      fileCount: staticAnalysis.fileCount,
      languages: staticAnalysis.languages.length
    })

    if (githubData) {
      console.log('📊 GitHub Data Summary:', {
        repository: githubData.metadata.fullName,
        language: githubData.metadata.language,
        openIssues: githubData.metadata.openIssuesCount,
        lastPush: githubData.metadata.pushedAt,
        communityHealth: githubData.communityHealth.communityProfile.healthPercentage
      })
    }

    // Check if OpenAI API key is available and valid
    const hasValidApiKey = process.env.OPENAI_API_KEY && 
      process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && 
      process.env.OPENAI_API_KEY.length > 20

    if (!hasValidApiKey) {
      console.error('❌ AI ANALYSIS FAILED: No valid OpenAI API key found!')
      return generateExtendedFallbackAssessment(staticAnalysis, githubData)
    }

    console.log('✅ OpenAI API Key validated, proceeding with extended AI analysis...')

    // Generate multiple specialized assessments
    console.log('🚀 Starting parallel extended AI analysis calls...')
    const [projectArchitecture, codeQuality, developmentPractices, agentIntegration, maintenanceSustainability] = await Promise.all([
      analyzeProjectArchitecture(staticAnalysis, githubData),
      analyzeCodeQuality(staticAnalysis, githubData),
      analyzeDevelopmentPractices(staticAnalysis, githubData),
      analyzeAgentIntegration(staticAnalysis, githubData),
      analyzeMaintenanceSustainability(staticAnalysis, githubData)
    ])

    console.log('✅ Extended AI Analysis Results:', {
      projectArchitecture: { score: projectArchitecture.codeOrganization, findings: projectArchitecture.findings.length },
      codeQuality: { score: codeQuality.complexity, findings: codeQuality.findings.length },
      developmentPractices: { score: developmentPractices.versionControl, findings: developmentPractices.findings.length },
      agentIntegration: { score: agentIntegration.compatibility, findings: agentIntegration.findings.length },
      maintenanceSustainability: { score: maintenanceSustainability.maintenancePatterns, findings: maintenanceSustainability.findings.length }
    })

    // Combine results into final assessment
    const result = combineExtendedAssessmentResults(
      projectArchitecture, 
      codeQuality, 
      developmentPractices, 
      agentIntegration, 
      maintenanceSustainability, 
      staticAnalysis, 
      githubData
    )
    
    console.log('🎯 Final Extended Assessment Score:', result.readinessScore)
    return result

  } catch (error) {
    console.error('❌ EXTENDED AI ANALYSIS FAILED: Error during AI processing!')
    console.error('🔧 Error Type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('📋 Error Details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    console.warn('⚠️ Falling back to extended static analysis only - AI insights will be limited!')
    return generateExtendedFallbackAssessment(staticAnalysis, githubData)
  }
}

async function analyzeProjectArchitecture(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): Promise<ProjectArchitectureAnalysis> {
  console.log('🏗️ Analyzing Project Architecture...')
  const prompt = createProjectArchitecturePrompt(staticAnalysis, githubData)
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert software architect. Analyze the provided repository information and assess the project's architecture quality and organization.

Focus on:
1. Code organization and structure (0-20)
2. Modularity and separation of concerns (0-20)
3. API design and interfaces (0-20)
4. Scalability and performance (0-20)
5. Maintainability and extensibility (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      codeOrganization: Number(parsed.codeOrganization) || 0,
      modularity: Number(parsed.modularity) || 0,
      apiDesign: Number(parsed.apiDesign) || 0,
      scalability: Number(parsed.scalability) || 0,
      maintainability: Number(parsed.maintainability) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse project architecture analysis:', error)
    return {
      codeOrganization: staticAnalysis.hasWorkflows ? 12 : 6,
      modularity: staticAnalysis.hasTests ? 14 : 6,
      apiDesign: staticAnalysis.hasReadme ? 10 : 4,
      scalability: staticAnalysis.hasWorkflows ? 12 : 6,
      maintainability: staticAnalysis.hasTests ? 14 : 6,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeCodeQuality(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): Promise<CodeQualityAnalysis> {
  console.log('🔍 Analyzing Code Quality...')
  const prompt = createCodeQualityPrompt(staticAnalysis, githubData)
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert code quality analyst. Analyze the provided repository information and assess the code quality and development standards.

Focus on:
1. Code complexity and maintainability (0-20)
2. Readability and style consistency (0-20)
3. Documentation and comments (0-20)
4. Error handling and validation (0-20)
5. Testing coverage and quality (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      complexity: Number(parsed.complexity) || 0,
      readability: Number(parsed.readability) || 0,
      documentation: Number(parsed.documentation) || 0,
      errorHandling: Number(parsed.errorHandling) || 0,
      testing: Number(parsed.testing) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse code quality analysis:', error)
    return {
      complexity: staticAnalysis.errorHandling ? 12 : 6,
      readability: staticAnalysis.hasReadme ? 14 : 6,
      documentation: staticAnalysis.hasReadme ? 16 : 4,
      errorHandling: staticAnalysis.errorHandling ? 18 : 4,
      testing: staticAnalysis.hasTests ? 16 : 4,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeDevelopmentPractices(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): Promise<DevelopmentPracticesAnalysis> {
  console.log('⚙️ Analyzing Development Practices...')
  const prompt = createDevelopmentPracticesPrompt(staticAnalysis, githubData)
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert DevOps and development practices analyst. Analyze the provided repository information and assess the development practices and workflow quality.

Focus on:
1. Version control practices and commit patterns (0-20)
2. Branch management and merging strategies (0-20)
3. Code review processes and quality control (0-20)
4. Continuous integration and automation (0-20)
5. Deployment and release practices (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      versionControl: Number(parsed.versionControl) || 0,
      branchManagement: Number(parsed.branchManagement) || 0,
      codeReview: Number(parsed.codeReview) || 0,
      continuousIntegration: Number(parsed.continuousIntegration) || 0,
      deployment: Number(parsed.deployment) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse development practices analysis:', error)
    return {
      versionControl: githubData?.activityMetrics.recentActivity ? 14 : 6,
      branchManagement: githubData?.prQuality?.pullRequests?.hasReviews ? 16 : 6,
      codeReview: githubData?.prQuality?.pullRequests?.hasReviews ? 18 : 4,
      continuousIntegration: staticAnalysis.hasWorkflows ? 16 : 4,
      deployment: staticAnalysis.hasWorkflows ? 12 : 4,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeAgentIntegration(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): Promise<AgentIntegrationReadinessAnalysis> {
  console.log('🤖 Analyzing Agent Integration Readiness...')
  const prompt = createAgentIntegrationPrompt(staticAnalysis, githubData)
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert in AI agent integration and compatibility. Analyze the provided repository information and assess how well-prepared the repository is for AI agent interaction.

Focus on:
1. AI agent compatibility and support (0-20)
2. Context window optimization and efficiency (0-20)
3. File structure and organization for agents (0-20)
4. Agent-specific requirements and guidelines (0-20)
5. Processing efficiency and performance (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      compatibility: Number(parsed.compatibility) || 0,
      contextOptimization: Number(parsed.contextOptimization) || 0,
      fileStructure: Number(parsed.fileStructure) || 0,
      agentRequirements: Number(parsed.agentRequirements) || 0,
      processingEfficiency: Number(parsed.processingEfficiency) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse agent integration analysis:', error)
    return {
      compatibility: staticAnalysis.hasAgents ? 16 : 6,
      contextOptimization: staticAnalysis.fileSizeAnalysis ? 14 : 6,
      fileStructure: staticAnalysis.hasReadme ? 12 : 6,
      agentRequirements: staticAnalysis.hasAgents ? 18 : 4,
      processingEfficiency: staticAnalysis.fileSizeAnalysis ? 16 : 6,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeMaintenanceSustainability(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): Promise<MaintenanceSustainabilityAnalysis> {
  console.log('🔄 Analyzing Maintenance & Sustainability...')
  const prompt = createMaintenanceSustainabilityPrompt(staticAnalysis, githubData)
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert in software maintenance and project sustainability. Analyze the provided repository information and assess the long-term viability and maintenance patterns.

Focus on:
1. Maintenance patterns and consistency (0-20)
2. Community engagement and support (0-20)
3. Documentation completeness and quality (0-20)
4. Long-term viability and sustainability (0-20)
5. Support structure and resources (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      maintenancePatterns: Number(parsed.maintenancePatterns) || 0,
      communityEngagement: Number(parsed.communityEngagement) || 0,
      documentationCompleteness: Number(parsed.documentationCompleteness) || 0,
      longTermViability: Number(parsed.longTermViability) || 0,
      supportStructure: Number(parsed.supportStructure) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse maintenance sustainability analysis:', error)
    return {
      maintenancePatterns: githubData?.activityMetrics.recentActivity ? 14 : 6,
      communityEngagement: (githubData?.communityHealth?.communityProfile?.healthPercentage ?? 0) > 50 ? 16 : 6,
      documentationCompleteness: staticAnalysis.hasReadme ? 16 : 4,
      longTermViability: githubData?.activityMetrics.recentActivity ? 12 : 6,
      supportStructure: staticAnalysis.hasContributing ? 14 : 6,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

// Prompt creation functions
function createProjectArchitecturePrompt(staticAnalysis: StaticAnalysisSummary, githubData?: GitHubRepositoryData): string {
  let prompt = `Project Architecture Analysis

Repository Information:
- Languages: ${staticAnalysis.languages.join(', ')}
- File Count: ${staticAnalysis.fileCount}
- Repository Size: ${(staticAnalysis.repositorySizeMB || 0).toFixed(2)} MB
- Has Workflows: ${staticAnalysis.hasWorkflows}
- Has Tests: ${staticAnalysis.hasTests}
- Error Handling: ${staticAnalysis.errorHandling}`

  if (githubData) {
    prompt += `
GitHub Data:
- Repository: ${githubData.metadata.fullName}
- Primary Language: ${githubData.metadata.language}
- Topics: ${githubData.metadata.topics.join(', ')}
- Open Issues: ${githubData.metadata.openIssuesCount}
- Recent Activity: ${githubData.activityMetrics.recentActivity}
- Community Health: ${githubData.communityHealth.communityProfile.healthPercentage}%`
  }

  if (staticAnalysis.readmeContent) {
    prompt += `\n\nREADME Content (first 2000 chars):\n${staticAnalysis.readmeContent.substring(0, 2000)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate code organization and structure
2. Assess modularity and separation of concerns
3. Check API design and interfaces
4. Review scalability and performance considerations
5. Analyze maintainability and extensibility

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createCodeQualityPrompt(staticAnalysis: StaticAnalysisSummary, githubData?: GitHubRepositoryData): string {
  let prompt = `Code Quality Analysis

Repository Information:
- Languages: ${staticAnalysis.languages.join(', ')}
- File Count: ${staticAnalysis.fileCount}
- Has Tests: ${staticAnalysis.hasTests}
- Error Handling: ${staticAnalysis.errorHandling}
- Test Files: ${staticAnalysis.testFiles.length}`

  if (githubData) {
    prompt += `
GitHub Data:
- Repository: ${githubData.metadata.fullName}
- Open Issues: ${githubData.metadata.openIssuesCount}
- PR Quality: ${githubData.prQuality.pullRequests.hasReviews ? 'Has Reviews' : 'No Reviews'}
- Issue Management: ${githubData.issueManagement.issues.hasLabels ? 'Organized' : 'Unorganized'}`
  }

  if (staticAnalysis.readmeContent) {
    prompt += `\n\nREADME Content (first 1500 chars):\n${staticAnalysis.readmeContent.substring(0, 1500)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate code complexity and maintainability
2. Assess readability and style consistency
3. Check documentation and comments
4. Review error handling and validation
5. Analyze testing coverage and quality

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createDevelopmentPracticesPrompt(staticAnalysis: StaticAnalysisSummary, githubData?: GitHubRepositoryData): string {
  let prompt = `Development Practices Analysis

Repository Information:
- Has Workflows: ${staticAnalysis.hasWorkflows}
- Workflow Files: ${staticAnalysis.workflowFiles.join(', ')}
- Has Tests: ${staticAnalysis.hasTests}
- Test Files: ${staticAnalysis.testFiles.length}`

  if (githubData) {
    prompt += `
GitHub Data:
- Repository: ${githubData.metadata.fullName}
- Recent Activity: ${githubData.activityMetrics.recentActivity}
- Active Contributors: ${githubData.activityMetrics.activeContributors}
- PR Quality: ${githubData.prQuality.pullRequests.hasReviews ? 'Has Reviews' : 'No Reviews'}
- Issue Management: ${githubData.issueManagement.issues.hasLabels ? 'Organized' : 'Unorganized'}
- Merge Patterns: Squash=${githubData.prQuality.mergePatterns.squashMerge}, Merge=${githubData.prQuality.mergePatterns.mergeCommit}, Rebase=${githubData.prQuality.mergePatterns.rebaseMerge}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate version control practices and commit patterns
2. Assess branch management and merging strategies
3. Check code review processes and quality control
4. Review continuous integration and automation
5. Analyze deployment and release practices

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createAgentIntegrationPrompt(staticAnalysis: StaticAnalysisSummary, githubData?: GitHubRepositoryData): string {
  let prompt = `Agent Integration Readiness Analysis

Repository Information:
- Languages: ${staticAnalysis.languages.join(', ')}
- File Count: ${staticAnalysis.fileCount}
- Repository Size: ${(staticAnalysis.repositorySizeMB || 0).toFixed(2)} MB
- Has README: ${staticAnalysis.hasReadme}
- Has AGENTS.md: ${staticAnalysis.hasAgents}
- Has CONTRIBUTING: ${staticAnalysis.hasContributing}`

  if (staticAnalysis.fileSizeAnalysis) {
    const fs = staticAnalysis.fileSizeAnalysis
    prompt += `
File Size Analysis:
- Agent Compatibility: Cursor ${fs.agentCompatibility.cursor}%, GitHub Copilot ${fs.agentCompatibility.githubCopilot}%
- Large Files: ${fs.largeFiles.length}
- Context Efficiency: ${fs.contextConsumption.contextEfficiency}
- Critical Files: ${fs.criticalFiles.length}`
  }

  if (githubData) {
    prompt += `
GitHub Data:
- Repository: ${githubData.metadata.fullName}
- Topics: ${githubData.metadata.topics.join(', ')}
- Community Health: ${githubData.communityHealth.communityProfile.healthPercentage}%
- Has Issues: ${githubData.metadata.hasIssues}
- Has Wiki: ${githubData.metadata.hasWiki}`
  }

  if (staticAnalysis.agentsContent) {
    prompt += `\n\nAGENTS.md Content (first 2000 chars):\n${staticAnalysis.agentsContent.substring(0, 2000)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate AI agent compatibility and support
2. Assess context window optimization and efficiency
3. Check file structure and organization for agents
4. Review agent-specific requirements and guidelines
5. Analyze processing efficiency and performance

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createMaintenanceSustainabilityPrompt(staticAnalysis: StaticAnalysisSummary, githubData?: GitHubRepositoryData): string {
  let prompt = `Maintenance & Sustainability Analysis

Repository Information:
- Has README: ${staticAnalysis.hasReadme}
- Has CONTRIBUTING: ${staticAnalysis.hasContributing}
- Has AGENTS.md: ${staticAnalysis.hasAgents}
- Has LICENSE: ${staticAnalysis.hasLicense}
- Has Workflows: ${staticAnalysis.hasWorkflows}
- Has Tests: ${staticAnalysis.hasTests}`

  if (githubData) {
    prompt += `
GitHub Data:
- Repository: ${githubData.metadata.fullName}
- Last Updated: ${githubData.metadata.updatedAt}
- Last Pushed: ${githubData.metadata.pushedAt}
- Recent Activity: ${githubData.activityMetrics.recentActivity}
- Active Contributors: ${githubData.activityMetrics.activeContributors}
- Community Health: ${githubData.communityHealth.communityProfile.healthPercentage}%
- Open Issues: ${githubData.metadata.openIssuesCount}
- Issue Management: ${githubData.issueManagement.issues.hasLabels ? 'Organized' : 'Unorganized'}
- PR Quality: ${githubData.prQuality.pullRequests.hasReviews ? 'Has Reviews' : 'No Reviews'}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate maintenance patterns and consistency
2. Assess community engagement and support
3. Check documentation completeness and quality
4. Review long-term viability and sustainability
5. Analyze support structure and resources

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function combineExtendedAssessmentResults(
  projectArchitecture: ProjectArchitectureAnalysis,
  codeQuality: CodeQualityAnalysis,
  developmentPractices: DevelopmentPracticesAnalysis,
  agentIntegration: AgentIntegrationReadinessAnalysis,
  maintenanceSustainability: MaintenanceSustainabilityAnalysis,
  staticAnalysis: StaticAnalysisSummary,
  githubData?: GitHubRepositoryData
): ExtendedAIAssessmentResult {
  // Helper functions for proper 0-20 score handling
  const clip20 = (v: unknown) => Math.max(0, Math.min(20, Number(v) || 0))
  const avg20 = (vals: unknown[]) =>
    Math.round(vals.map(clip20).reduce((a, b) => a + b, 0) / vals.length)

  // Calculate overall scores (0-20 scale)
  const projectArchitectureScore = avg20([
    projectArchitecture.codeOrganization,
    projectArchitecture.modularity,
    projectArchitecture.apiDesign,
    projectArchitecture.scalability,
    projectArchitecture.maintainability,
  ])
  
  const codeQualityScore = avg20([
    codeQuality.complexity,
    codeQuality.readability,
    codeQuality.documentation,
    codeQuality.errorHandling,
    codeQuality.testing,
  ])
  
  const developmentPracticesScore = avg20([
    developmentPractices.versionControl,
    developmentPractices.branchManagement,
    developmentPractices.codeReview,
    developmentPractices.continuousIntegration,
    developmentPractices.deployment,
  ])
  
  const agentIntegrationScore = avg20([
    agentIntegration.compatibility,
    agentIntegration.contextOptimization,
    agentIntegration.fileStructure,
    agentIntegration.agentRequirements,
    agentIntegration.processingEfficiency,
  ])
  
  const maintenanceSustainabilityScore = avg20([
    maintenanceSustainability.maintenancePatterns,
    maintenanceSustainability.communityEngagement,
    maintenanceSustainability.documentationCompleteness,
    maintenanceSustainability.longTermViability,
    maintenanceSustainability.supportStructure,
  ])

  // Calculate overall readiness score (0-100 scale)
  const overallScore = Math.min(100, Math.round((
    projectArchitectureScore + 
    codeQualityScore + 
    developmentPracticesScore + 
    agentIntegrationScore + 
    maintenanceSustainabilityScore
  ) / 5 * 5))

  // Generate findings and recommendations
  const aiFindings = [
    ...(Array.isArray(projectArchitecture.findings) ? projectArchitecture.findings : []),
    ...(Array.isArray(codeQuality.findings) ? codeQuality.findings : []),
    ...(Array.isArray(developmentPractices.findings) ? developmentPractices.findings : []),
    ...(Array.isArray(agentIntegration.findings) ? agentIntegration.findings : []),
    ...(Array.isArray(maintenanceSustainability.findings) ? maintenanceSustainability.findings : [])
  ]

  const aiRecommendations = [
    ...(Array.isArray(projectArchitecture.recommendations) ? projectArchitecture.recommendations : []),
    ...(Array.isArray(codeQuality.recommendations) ? codeQuality.recommendations : []),
    ...(Array.isArray(developmentPractices.recommendations) ? developmentPractices.recommendations : []),
    ...(Array.isArray(agentIntegration.recommendations) ? agentIntegration.recommendations : []),
    ...(Array.isArray(maintenanceSustainability.recommendations) ? maintenanceSustainability.recommendations : [])
  ]

  return {
    readinessScore: overallScore,
    aiAnalysisStatus: {
      enabled: true,
      projectArchitecture: projectArchitecture.confidence > 0,
      codeQuality: codeQuality.confidence > 0,
      developmentPractices: developmentPractices.confidence > 0,
      agentIntegration: agentIntegration.confidence > 0,
      maintenanceSustainability: maintenanceSustainability.confidence > 0,
      overallSuccess: (projectArchitecture.confidence > 0 && codeQuality.confidence > 0 && 
                      developmentPractices.confidence > 0 && agentIntegration.confidence > 0 && 
                      maintenanceSustainability.confidence > 0)
    },
    categories: {
      documentation: Math.min(20, Math.round(
        (staticAnalysis.hasReadme ? 8 : 0) + 
        (staticAnalysis.hasAgents ? 6 : 0) + 
        (staticAnalysis.hasContributing ? 4 : 0) + 
        (staticAnalysis.hasLicense ? 2 : 0)
      )),
      instructionClarity: Math.min(20, Math.round(
        (staticAnalysis.hasReadme ? 16 : 4) +
        (staticAnalysis.hasAgents ? 18 : 6) +
        (staticAnalysis.hasContributing ? 14 : 6) +
        (staticAnalysis.errorHandling ? 16 : 4) +
        (staticAnalysis.hasReadme ? 12 : 4)
      ) / 5),
      workflowAutomation: Math.min(20, Math.round(
        (staticAnalysis.hasWorkflows ? 18 : 4) +
        (staticAnalysis.hasTests ? 16 : 4) +
        (staticAnalysis.hasWorkflows ? 14 : 6) +
        (staticAnalysis.hasWorkflows ? 12 : 6) +
        (staticAnalysis.hasWorkflows ? 10 : 6)
      ) / 5),
      riskCompliance: Math.min(20, Math.round(
        (staticAnalysis.errorHandling ? 14 : 6) +
        (staticAnalysis.errorHandling ? 18 : 4) +
        (staticAnalysis.hasTests ? 12 : 6) +
        (staticAnalysis.hasTests ? 10 : 6) +
        (staticAnalysis.hasLicense ? 16 : 4)
      ) / 5),
      integrationStructure: Math.min(20, Math.round(
        (staticAnalysis.hasWorkflows ? 8 : 0) + 
        (staticAnalysis.hasTests ? 6 : 0) + 
        (staticAnalysis.workflowFiles?.length > 0 ? Math.min(6, staticAnalysis.workflowFiles.length) : 0)
      )),
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis ? Math.min(20, Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 6)) : 10,
      // New categories
      projectArchitecture: projectArchitectureScore,
      codeQuality: codeQualityScore,
      developmentPractices: developmentPracticesScore,
      agentIntegration: agentIntegrationScore,
      maintenanceSustainability: maintenanceSustainabilityScore
    },
    findings: aiFindings.slice(0, 15), // Limit to top 15 findings
    recommendations: aiRecommendations.slice(0, 15), // Limit to top 15 recommendations
    detailedAnalysis: {
      projectArchitecture: {
        codeOrganization: clip20(projectArchitecture.codeOrganization),
        modularity: clip20(projectArchitecture.modularity),
        apiDesign: clip20(projectArchitecture.apiDesign),
        scalability: clip20(projectArchitecture.scalability),
        maintainability: clip20(projectArchitecture.maintainability),
        overallScore: projectArchitectureScore
      },
      codeQuality: {
        complexity: clip20(codeQuality.complexity),
        readability: clip20(codeQuality.readability),
        documentation: clip20(codeQuality.documentation),
        errorHandling: clip20(codeQuality.errorHandling),
        testing: clip20(codeQuality.testing),
        overallScore: codeQualityScore
      },
      developmentPractices: {
        versionControl: clip20(developmentPractices.versionControl),
        branchManagement: clip20(developmentPractices.branchManagement),
        codeReview: clip20(developmentPractices.codeReview),
        continuousIntegration: clip20(developmentPractices.continuousIntegration),
        deployment: clip20(developmentPractices.deployment),
        overallScore: developmentPracticesScore
      },
      agentIntegration: {
        compatibility: clip20(agentIntegration.compatibility),
        contextOptimization: clip20(agentIntegration.contextOptimization),
        fileStructure: clip20(agentIntegration.fileStructure),
        agentRequirements: clip20(agentIntegration.agentRequirements),
        processingEfficiency: clip20(agentIntegration.processingEfficiency),
        overallScore: agentIntegrationScore
      },
      maintenanceSustainability: {
        maintenancePatterns: clip20(maintenanceSustainability.maintenancePatterns),
        communityEngagement: clip20(maintenanceSustainability.communityEngagement),
        documentationCompleteness: clip20(maintenanceSustainability.documentationCompleteness),
        longTermViability: clip20(maintenanceSustainability.longTermViability),
        supportStructure: clip20(maintenanceSustainability.supportStructure),
        overallScore: maintenanceSustainabilityScore
      }
    },
    confidence: {
      overall: Math.round((
        (projectArchitecture.confidence ?? 70) + 
        (codeQuality.confidence ?? 70) + 
        (developmentPractices.confidence ?? 70) + 
        (agentIntegration.confidence ?? 70) + 
        (maintenanceSustainability.confidence ?? 70)
      ) / 5),
      projectArchitecture: projectArchitecture.confidence ?? 70,
      codeQuality: codeQuality.confidence ?? 70,
      developmentPractices: developmentPractices.confidence ?? 70,
      agentIntegration: agentIntegration.confidence ?? 70,
      maintenanceSustainability: maintenanceSustainability.confidence ?? 70
    }
  }
}

function generateExtendedFallbackAssessment(
  staticAnalysis: StaticAnalysisSummary, 
  githubData?: GitHubRepositoryData
): ExtendedAIAssessmentResult {
  // Basic fallback assessment with extended structure
  const baseScore = Math.round(
    (staticAnalysis.hasReadme ? 15 : 0) +
    (staticAnalysis.hasAgents ? 10 : 0) +
    (staticAnalysis.hasContributing ? 5 : 0) +
    (staticAnalysis.hasLicense ? 5 : 0) +
    (staticAnalysis.hasWorkflows ? 10 : 0) +
    (staticAnalysis.hasTests ? 10 : 0) +
    (staticAnalysis.errorHandling ? 10 : 0)
  )

  return {
    readinessScore: Math.min(baseScore, 100),
    aiAnalysisStatus: {
      enabled: false,
      projectArchitecture: false,
      codeQuality: false,
      developmentPractices: false,
      agentIntegration: false,
      maintenanceSustainability: false,
      overallSuccess: false,
      reason: 'No valid OpenAI API key available'
    },
    categories: {
      documentation: Math.min(20, Math.round(
        (staticAnalysis.hasReadme ? 8 : 0) + 
        (staticAnalysis.hasAgents ? 6 : 0) + 
        (staticAnalysis.hasContributing ? 4 : 0) + 
        (staticAnalysis.hasLicense ? 2 : 0)
      )),
      instructionClarity: 12,
      workflowAutomation: 14,
      riskCompliance: 12,
      integrationStructure: 16,
      fileSizeOptimization: 14,
      projectArchitecture: 12,
      codeQuality: 14,
      developmentPractices: 12,
      agentIntegration: 16,
      maintenanceSustainability: 10
    },
    findings: [
      'Repository analysis completed with limited AI insights',
      'Consider adding OpenAI API key for enhanced analysis',
      'Basic static analysis provides foundation for assessment'
    ],
    recommendations: [
      'Configure OpenAI API key for comprehensive AI analysis',
      'Review repository structure and documentation',
      'Consider implementing additional development practices'
    ],
    detailedAnalysis: {
      projectArchitecture: {
        codeOrganization: 12,
        modularity: 14,
        apiDesign: 10,
        scalability: 12,
        maintainability: 14,
        overallScore: 12
      },
      codeQuality: {
        complexity: 14,
        readability: 16,
        documentation: 12,
        errorHandling: 14,
        testing: 12,
        overallScore: 14
      },
      developmentPractices: {
        versionControl: 12,
        branchManagement: 10,
        codeReview: 8,
        continuousIntegration: 14,
        deployment: 10,
        overallScore: 12
      },
      agentIntegration: {
        compatibility: 16,
        contextOptimization: 14,
        fileStructure: 12,
        agentRequirements: 18,
        processingEfficiency: 14,
        overallScore: 16
      },
      maintenanceSustainability: {
        maintenancePatterns: 10,
        communityEngagement: 8,
        documentationCompleteness: 12,
        longTermViability: 10,
        supportStructure: 12,
        overallScore: 10
      }
    },
    confidence: {
      overall: 60,
      projectArchitecture: 60,
      codeQuality: 60,
      developmentPractices: 60,
      agentIntegration: 60,
      maintenanceSustainability: 60
    }
  }
}