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

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_TEMPERATURE = 0
const OPENAI_RESPONSE_FORMAT = { type: 'json_object' as const }

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

export interface EnhancedAIAssessmentResult {
  readinessScore: number
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
    fileSizeOptimization: number
  }
  findings: string[]
  recommendations: string[]
  detailedAnalysis: {
    instructionClarity: {
      stepByStepQuality: number
      commandClarity: number
      environmentSetup: number
      errorHandling: number
      dependencySpecification: number
      overallScore: number
    }
    workflowAutomation: {
      ciCdQuality: number
      testAutomation: number
      buildScripts: number
      deploymentAutomation: number
      monitoringLogging: number
      overallScore: number
    }
    contextEfficiency: {
      instructionFileOptimization: number
      codeDocumentation: number
      apiDocumentation: number
      contextWindowUsage: number
      overallScore: number
    }
    riskCompliance: {
      securityPractices: number
      errorHandling: number
      inputValidation: number
      dependencySecurity: number
      licenseCompliance: number
      overallScore: number
    }
  }
  confidence: {
    overall: number
    instructionClarity: number
    workflowAutomation: number
    contextEfficiency: number
    riskCompliance: number
  }
}

export async function generateEnhancedAIAssessment(staticAnalysis: StaticAnalysisSummary): Promise<EnhancedAIAssessmentResult> {
  try {
    console.log('🔍 Starting Enhanced AI Assessment...')
    console.log('📊 Static Analysis Summary:', {
      hasReadme: staticAnalysis.hasReadme,
      hasAgents: staticAnalysis.hasAgents,
      hasWorkflows: staticAnalysis.hasWorkflows,
      hasTests: staticAnalysis.hasTests,
      fileCount: staticAnalysis.fileCount,
      languages: staticAnalysis.languages.length
    })

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OPENAI_API_KEY is not set; falling back to basic assessment.')
      return generateEnhancedFallbackAssessment(staticAnalysis)
    }

    console.log('🤖 OpenAI API Key found, proceeding with AI analysis...')
    console.log('🔧 OpenAI Config:', {
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      baseURL: process.env.OPENAI_BASE_URL || 'default',
      timeout: process.env.OPENAI_TIMEOUT_MS || '30000'
    })

    // Generate multiple specialized assessments
    console.log('🚀 Starting parallel AI analysis calls...')
    const [instructionAnalysis, workflowAnalysis, contextAnalysis, riskAnalysis] = await Promise.all([
      analyzeInstructionClarity(staticAnalysis),
      analyzeWorkflowAutomation(staticAnalysis),
      analyzeContextEfficiency(staticAnalysis),
      analyzeRiskCompliance(staticAnalysis)
    ])

    console.log('✅ AI Analysis Results:', {
      instruction: { score: instructionAnalysis.stepByStepQuality, findings: instructionAnalysis.findings.length },
      workflow: { score: workflowAnalysis.ciCdQuality, findings: workflowAnalysis.findings.length },
      context: { score: contextAnalysis.instructionFileOptimization, findings: contextAnalysis.findings.length },
      risk: { score: riskAnalysis.securityPractices, findings: riskAnalysis.findings.length }
    })

    // Combine results into final assessment
    const result = combineAssessmentResults(instructionAnalysis, workflowAnalysis, contextAnalysis, riskAnalysis, staticAnalysis)
    console.log('🎯 Final Assessment Score:', result.readinessScore)
    return result

  } catch (error) {
    console.error('❌ Enhanced AI assessment error:', error)
    console.error('📋 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    return generateEnhancedFallbackAssessment(staticAnalysis)
  }
}

async function analyzeInstructionClarity(staticAnalysis: StaticAnalysisSummary): Promise<InstructionClarityAnalysis> {
  console.log('📝 Analyzing Instruction Clarity...')
  const prompt = createInstructionClarityPrompt(staticAnalysis)
  console.log('📋 Prompt length:', prompt.length, 'characters')
  console.log('📋 Prompt preview:', prompt.substring(0, 200) + '...')
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      response_format: OPENAI_RESPONSE_FORMAT,
      temperature: OPENAI_TEMPERATURE,
      messages: [
        {
          role: 'system',
          content: `You are an expert in technical documentation and instruction clarity. Analyze the provided repository documentation and assess how clear and actionable the instructions are for AI agents and human developers.

Focus on:
1. Step-by-step instruction quality (0-20)
2. Command clarity and syntax (0-20)
3. Environment setup completeness (0-20)
4. Error handling instructions (0-20)
5. Dependency specification clarity (0-20)

Provide a JSON response with detailed scoring and analysis.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    console.log('🤖 OpenAI Response received:', {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length || 0,
      hasContent: !!response.choices?.[0]?.message?.content,
      contentLength: response.choices?.[0]?.message?.content?.length || 0
    })

    const content = response.choices[0]?.message?.content || '{}'
    console.log('📄 Raw AI Response:', content.substring(0, 500) + (content.length > 500 ? '...' : ''))
    
    const parsed = JSON.parse(content)
    console.log('🔍 Parsed JSON:', {
      hasStepByStepQuality: 'stepByStepQuality' in parsed,
      hasCommandClarity: 'commandClarity' in parsed,
      hasEnvironmentSetup: 'environmentSetup' in parsed,
      hasErrorHandling: 'errorHandling' in parsed,
      hasDependencySpecification: 'dependencySpecification' in parsed,
      hasFindings: 'findings' in parsed,
      hasRecommendations: 'recommendations' in parsed,
      findingsLength: Array.isArray(parsed.findings) ? parsed.findings.length : 'not array',
      recommendationsLength: Array.isArray(parsed.recommendations) ? parsed.recommendations.length : 'not array'
    })
    
    // Validate that we have the required numeric fields
    const hasRequiredFields = [
      'stepByStepQuality', 'commandClarity', 'environmentSetup', 
      'errorHandling', 'dependencySpecification'
    ].every(field => typeof parsed[field] === 'number' && !isNaN(parsed[field]))
    
    if (!hasRequiredFields) {
      console.error('❌ Missing or invalid required numeric fields in AI response')
      throw new Error('Missing or invalid required numeric fields')
    }
    
    // Ensure required properties exist and are arrays
    const result = {
      stepByStepQuality: Number(parsed.stepByStepQuality) || 0,
      commandClarity: Number(parsed.commandClarity) || 0,
      environmentSetup: Number(parsed.environmentSetup) || 0,
      errorHandling: Number(parsed.errorHandling) || 0,
      dependencySpecification: Number(parsed.dependencySpecification) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
    
    console.log('✅ Instruction Clarity Analysis Result:', {
      scores: {
        stepByStepQuality: result.stepByStepQuality,
        commandClarity: result.commandClarity,
        environmentSetup: result.environmentSetup,
        errorHandling: result.errorHandling,
        dependencySpecification: result.dependencySpecification
      },
      findingsCount: result.findings.length,
      recommendationsCount: result.recommendations.length,
      confidence: result.confidence
    })
    
    return result
  } catch (error) {
    console.error('❌ Failed to analyze instruction clarity:', error)
    console.error('📋 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    })
    
    // Return reasonable fallback values based on static analysis
    const fallback = {
      stepByStepQuality: staticAnalysis.hasReadme ? 12 : 4,
      commandClarity: staticAnalysis.hasAgents ? 15 : 6,
      environmentSetup: staticAnalysis.hasContributing ? 10 : 4,
      errorHandling: staticAnalysis.errorHandling ? 14 : 6,
      dependencySpecification: staticAnalysis.hasReadme ? 8 : 4,
      findings: [],
      recommendations: [],
      confidence: 30
    }
    
    console.log('🔄 Using fallback values for instruction clarity:', fallback)
    return fallback
  }
}

async function analyzeWorkflowAutomation(staticAnalysis: StaticAnalysisSummary): Promise<WorkflowAutomationAnalysis> {
  const prompt = createWorkflowAutomationPrompt(staticAnalysis)
  
  const response = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    response_format: OPENAI_RESPONSE_FORMAT,
    temperature: OPENAI_TEMPERATURE,
    messages: [
      {
        role: 'system',
        content: `You are an expert in DevOps and automation. Analyze the repository's automation potential and current implementation.

Focus on:
1. CI/CD pipeline quality (0-20)
2. Test automation coverage (0-20)
3. Build script quality (0-20)
4. Deployment automation (0-20)
5. Monitoring and logging (0-20)

Provide a JSON response with detailed scoring and analysis.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    // Validate that we have the required numeric fields
    const hasRequiredFields = [
      'ciCdQuality', 'testAutomation', 'buildScripts', 
      'deploymentAutomation', 'monitoringLogging'
    ].every(field => typeof parsed[field] === 'number' && !isNaN(parsed[field]))
    
    if (!hasRequiredFields) {
      throw new Error('Missing or invalid required numeric fields')
    }
    
    // Ensure required properties exist and are arrays
    return {
      ciCdQuality: Number(parsed.ciCdQuality) || 0,
      testAutomation: Number(parsed.testAutomation) || 0,
      buildScripts: Number(parsed.buildScripts) || 0,
      deploymentAutomation: Number(parsed.deploymentAutomation) || 0,
      monitoringLogging: Number(parsed.monitoringLogging) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse workflow automation analysis:', error)
    // Return reasonable fallback values based on static analysis
    return {
      ciCdQuality: staticAnalysis.hasWorkflows ? 14 : 4,
      testAutomation: staticAnalysis.hasTests ? 12 : 4,
      buildScripts: staticAnalysis.hasWorkflows ? 10 : 4,
      deploymentAutomation: staticAnalysis.hasWorkflows ? 8 : 4,
      monitoringLogging: staticAnalysis.hasWorkflows ? 6 : 4,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeContextEfficiency(staticAnalysis: StaticAnalysisSummary): Promise<ContextEfficiencyAnalysis> {
  const prompt = createContextEfficiencyPrompt(staticAnalysis)
  
  const response = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    response_format: OPENAI_RESPONSE_FORMAT,
    temperature: OPENAI_TEMPERATURE,
    messages: [
      {
        role: 'system',
        content: `You are an expert in AI context optimization. Analyze how efficiently the repository uses context windows and provides information to AI agents.

Focus on:
1. Instruction file optimization (0-20)
2. Code documentation quality (0-20)
3. API documentation completeness (0-20)
4. Context window usage efficiency (0-20)
5. Information density and clarity (0-20)

Provide a JSON response with detailed scoring and analysis.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    // Validate that we have the required numeric fields
    const hasRequiredFields = [
      'instructionFileOptimization', 'codeDocumentation', 
      'apiDocumentation', 'contextWindowUsage'
    ].every(field => typeof parsed[field] === 'number' && !isNaN(parsed[field]))
    
    if (!hasRequiredFields) {
      throw new Error('Missing or invalid required numeric fields')
    }
    
    // Ensure required properties exist and are arrays
    return {
      instructionFileOptimization: Number(parsed.instructionFileOptimization) || 0,
      codeDocumentation: Number(parsed.codeDocumentation) || 0,
      apiDocumentation: Number(parsed.apiDocumentation) || 0,
      contextWindowUsage: Number(parsed.contextWindowUsage) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse context efficiency analysis:', error)
    // Return reasonable fallback values based on static analysis
    return {
      instructionFileOptimization: staticAnalysis.hasAgents ? 12 : 6,
      codeDocumentation: staticAnalysis.hasReadme ? 10 : 4,
      apiDocumentation: staticAnalysis.hasReadme ? 8 : 4,
      contextWindowUsage: staticAnalysis.hasAgents ? 14 : 6,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

async function analyzeRiskCompliance(staticAnalysis: StaticAnalysisSummary): Promise<RiskComplianceAnalysis> {
  const prompt = createRiskCompliancePrompt(staticAnalysis)
  
  const response = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    response_format: OPENAI_RESPONSE_FORMAT,
    temperature: OPENAI_TEMPERATURE,
    messages: [
      {
        role: 'system',
        content: `You are an expert in software security and compliance. Analyze the repository's security practices and compliance readiness.

Focus on:
1. Security practices implementation (0-20)
2. Error handling and validation (0-20)
3. Input validation and sanitization (0-20)
4. Dependency security management (0-20)
5. License compliance and legal aspects (0-20)

Provide a JSON response with detailed scoring and analysis.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
  })

  try {
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    // Validate that we have the required numeric fields
    const hasRequiredFields = [
      'securityPractices', 'errorHandling', 'inputValidation', 
      'dependencySecurity', 'licenseCompliance'
    ].every(field => typeof parsed[field] === 'number' && !isNaN(parsed[field]))
    
    if (!hasRequiredFields) {
      throw new Error('Missing or invalid required numeric fields')
    }
    
    // Ensure required properties exist and are arrays
    return {
      securityPractices: Number(parsed.securityPractices) || 0,
      errorHandling: Number(parsed.errorHandling) || 0,
      inputValidation: Number(parsed.inputValidation) || 0,
      dependencySecurity: Number(parsed.dependencySecurity) || 0,
      licenseCompliance: Number(parsed.licenseCompliance) || 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      confidence: Number(parsed.confidence) || 70
    }
  } catch (error) {
    console.error('Failed to parse risk compliance analysis:', error)
    // Return reasonable fallback values based on static analysis
    return {
      securityPractices: staticAnalysis.errorHandling ? 10 : 4,
      errorHandling: staticAnalysis.errorHandling ? 14 : 4,
      inputValidation: staticAnalysis.hasTests ? 8 : 4,
      dependencySecurity: staticAnalysis.hasTests ? 6 : 4,
      licenseCompliance: staticAnalysis.hasLicense ? 12 : 4,
      findings: [],
      recommendations: [],
      confidence: 30
    }
  }
}

function createInstructionClarityPrompt(staticAnalysis: StaticAnalysisSummary): string {
  let prompt = `Instruction Clarity Analysis

Repository Documentation:
- Has README: ${staticAnalysis.hasReadme}
- Has AGENTS.md: ${staticAnalysis.hasAgents}
- Has CONTRIBUTING: ${staticAnalysis.hasContributing}
- Primary Languages: ${staticAnalysis.languages.join(', ')}

Documentation Content:`

  if (staticAnalysis.readmeContent) {
    prompt += `\n\nREADME Content:\n${staticAnalysis.readmeContent.substring(0, 3000)}`
  }

  if (staticAnalysis.agentsContent) {
    prompt += `\n\nAGENTS.md Content:\n${staticAnalysis.agentsContent.substring(0, 2000)}`
  }

  if (staticAnalysis.contributingContent) {
    prompt += `\n\nCONTRIBUTING.md Content:\n${staticAnalysis.contributingContent.substring(0, 1500)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate step-by-step instruction quality
2. Assess command clarity and syntax
3. Check environment setup completeness
4. Review error handling instructions
5. Analyze dependency specification clarity

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createWorkflowAutomationPrompt(staticAnalysis: StaticAnalysisSummary): string {
  let prompt = `Workflow Automation Analysis

Repository Automation Status:
- Has CI/CD Workflows: ${staticAnalysis.hasWorkflows}
- Workflow Files: ${staticAnalysis.workflowFiles.join(', ')}
- Has Tests: ${staticAnalysis.hasTests}
- Test Files: ${staticAnalysis.testFiles.slice(0, 10).join(', ')}
- Error Handling: ${staticAnalysis.errorHandling}
- Total Files: ${staticAnalysis.fileCount}
- Repository Size: ${(staticAnalysis.repositorySizeMB || 0).toFixed(2)} MB`

  if (staticAnalysis.workflowFiles.length > 0) {
    prompt += `\n\nWorkflow Files Analysis:`
    staticAnalysis.workflowFiles.forEach(file => {
      prompt += `\n- ${file}`
    })
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate CI/CD pipeline quality and completeness
2. Assess test automation coverage and quality
3. Check build script quality and reliability
4. Review deployment automation capabilities
5. Analyze monitoring and logging implementation

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createContextEfficiencyPrompt(staticAnalysis: StaticAnalysisSummary): string {
  let prompt = `Context Efficiency Analysis

Repository Context Usage:
- Total Files: ${staticAnalysis.fileCount}
- Primary Languages: ${staticAnalysis.languages.join(', ')}
- Has README: ${staticAnalysis.hasReadme}
- Has AGENTS.md: ${staticAnalysis.hasAgents}
- Has CONTRIBUTING: ${staticAnalysis.hasContributing}`

  if (staticAnalysis.fileSizeAnalysis) {
    const fs = staticAnalysis.fileSizeAnalysis
    prompt += `\n\nFile Size Analysis:
- Total Files Analyzed: ${fs.totalFiles}
- Files by Size: ${fs.filesBySize.under100KB} under 100KB, ${fs.filesBySize.under500KB} under 500KB, ${fs.filesBySize.under1MB} under 1MB, ${fs.filesBySize.under5MB} under 5MB, ${fs.filesBySize.over5MB} over 5MB
- Large Files: ${fs.largeFiles.length}
- Context Efficiency: ${fs.contextConsumption.contextEfficiency}
- Agent Compatibility: Cursor ${fs.agentCompatibility.cursor}%, GitHub Copilot ${fs.agentCompatibility.githubCopilot}%`

    if (fs.contextConsumption.instructionFiles.agentsMd) {
      const agents = fs.contextConsumption.instructionFiles.agentsMd
      prompt += `\n- AGENTS.md: ${Math.round(agents.size / 1024)}KB, ${agents.lines} lines, ~${agents.estimatedTokens} tokens`
    }
  }

  if (staticAnalysis.readmeContent) {
    prompt += `\n\nREADME Content (first 2000 chars):\n${staticAnalysis.readmeContent.substring(0, 2000)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate instruction file optimization for AI agents
2. Assess code documentation quality and completeness
3. Check API documentation completeness
4. Review context window usage efficiency
5. Analyze information density and clarity

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function createRiskCompliancePrompt(staticAnalysis: StaticAnalysisSummary): string {
  let prompt = `Risk & Compliance Analysis

Repository Security Status:
- Has LICENSE: ${staticAnalysis.hasLicense}
- Error Handling: ${staticAnalysis.errorHandling}
- Has Tests: ${staticAnalysis.hasTests}
- Test Files: ${staticAnalysis.testFiles.length}
- Primary Languages: ${staticAnalysis.languages.join(', ')}
- Total Files: ${staticAnalysis.fileCount}
- Repository Size: ${(staticAnalysis.repositorySizeMB || 0).toFixed(2)} MB`

  if (staticAnalysis.readmeContent) {
    prompt += `\n\nREADME Content (first 1500 chars):\n${staticAnalysis.readmeContent.substring(0, 1500)}`
  }

  prompt += `\n\nAnalysis Requirements:
1. Evaluate security practices implementation
2. Assess error handling and input validation
3. Check dependency security management
4. Review license compliance and legal aspects
5. Analyze code quality and security patterns

Provide detailed scoring and specific findings for each area.`

  return prompt
}

function combineAssessmentResults(
  instructionAnalysis: InstructionClarityAnalysis,
  workflowAnalysis: WorkflowAutomationAnalysis,
  contextAnalysis: ContextEfficiencyAnalysis,
  riskAnalysis: RiskComplianceAnalysis,
  staticAnalysis: StaticAnalysisSummary
): EnhancedAIAssessmentResult {
  // Helper functions for proper 0-20 score handling
  const clip20 = (v: unknown) => Math.max(0, Math.min(20, Number(v) || 0))
  const avg20 = (vals: unknown[]) =>
    Math.round(vals.map(clip20).reduce((a, b) => a + b, 0) / vals.length)

  // Calculate overall scores (0-20 scale)
  const instructionScore = avg20([
    instructionAnalysis.stepByStepQuality,
    instructionAnalysis.commandClarity,
    instructionAnalysis.environmentSetup,
    instructionAnalysis.errorHandling,
    instructionAnalysis.dependencySpecification,
  ])
  
  const workflowScore = avg20([
    workflowAnalysis.ciCdQuality,
    workflowAnalysis.testAutomation,
    workflowAnalysis.buildScripts,
    workflowAnalysis.deploymentAutomation,
    workflowAnalysis.monitoringLogging,
  ])
  
  // Accept optional fifth metric if model returns it
  const contextParts: unknown[] = [
    contextAnalysis.instructionFileOptimization,
    contextAnalysis.codeDocumentation,
    contextAnalysis.apiDocumentation,
    contextAnalysis.contextWindowUsage,
    (contextAnalysis as any).informationDensity, // optional
  ].filter(v => Number.isFinite(Number(v)))
  const contextScore = avg20(contextParts.length ? contextParts : [0, 0, 0, 0])
  
  const riskScore = avg20([
    riskAnalysis.securityPractices,
    riskAnalysis.errorHandling,
    riskAnalysis.inputValidation,
    riskAnalysis.dependencySecurity,
    riskAnalysis.licenseCompliance,
  ])

  // Calculate overall readiness score (0-100 scale)
  const overallScore = Math.min(100, Math.round((instructionScore + workflowScore + contextScore + riskScore) / 4 * 5))

  // Generate findings and recommendations with proper type guards and fallbacks
  const aiFindings = [
    ...(Array.isArray(instructionAnalysis.findings) ? instructionAnalysis.findings : []),
    ...(Array.isArray(workflowAnalysis.findings) ? workflowAnalysis.findings : []),
    ...(Array.isArray(contextAnalysis.findings) ? contextAnalysis.findings : []),
    ...(Array.isArray(riskAnalysis.findings) ? riskAnalysis.findings : [])
  ]

  const aiRecommendations = [
    ...(Array.isArray(instructionAnalysis.recommendations) ? instructionAnalysis.recommendations : []),
    ...(Array.isArray(workflowAnalysis.recommendations) ? workflowAnalysis.recommendations : []),
    ...(Array.isArray(contextAnalysis.recommendations) ? contextAnalysis.recommendations : []),
    ...(Array.isArray(riskAnalysis.recommendations) ? riskAnalysis.recommendations : [])
  ]

  // Fallback to static analysis findings if AI findings are empty
  const findings = aiFindings.length > 0 ? aiFindings : [
    // FINDINGS: Describe current state
    staticAnalysis.hasReadme ? 'README.md documentation is present and accessible' : 'No README.md found in repository',
    staticAnalysis.hasAgents ? 'AGENTS.md file provides AI agent context and instructions' : 'No AGENTS.md file found for AI agent guidance',
    staticAnalysis.hasWorkflows ? `Found ${staticAnalysis.workflowFiles?.length || 0} CI/CD workflow files` : 'No CI/CD workflows detected',
    staticAnalysis.hasTests ? `Test suite includes ${staticAnalysis.testFiles?.length || 0} test files` : 'No automated test files found',
    staticAnalysis.errorHandling ? 'Error handling patterns are implemented in codebase' : 'Limited error handling patterns detected',
    staticAnalysis.fileCount > 0 ? `Repository contains ${staticAnalysis.fileCount} files across ${staticAnalysis.languages.length} programming languages` : 'Repository structure analysis incomplete'
  ]

  const recommendations = aiRecommendations.length > 0 ? aiRecommendations : [
    // RECOMMENDATIONS: Provide actionable next steps
    !staticAnalysis.hasReadme ? 'Create a comprehensive README.md with project overview, setup instructions, and usage examples' : 'Consider enhancing README.md with more detailed AI agent context',
    !staticAnalysis.hasAgents ? 'Add AGENTS.md file with specific instructions for AI agents working with this codebase' : 'Review and update AGENTS.md with current best practices',
    !staticAnalysis.hasWorkflows ? 'Implement GitHub Actions workflows for automated testing, building, and deployment' : 'Expand CI/CD coverage to include more comprehensive testing and deployment stages',
    !staticAnalysis.hasTests ? 'Develop automated test suite covering critical functionality and edge cases' : 'Increase test coverage and add integration tests for better reliability',
    !staticAnalysis.errorHandling ? 'Implement comprehensive error handling with proper logging and user feedback' : 'Enhance error handling with more specific error types and recovery mechanisms',
    staticAnalysis.fileSizeAnalysis?.agentCompatibility.overall < 90 ? 'Optimize file sizes to improve AI agent compatibility and processing speed' : 'Maintain current file size practices for optimal AI agent performance'
  ]

  return {
    readinessScore: overallScore,
    categories: {
      documentation: Math.min(20, Math.round(
        (staticAnalysis.hasReadme ? 8 : 0) + 
        (staticAnalysis.hasAgents ? 6 : 0) + 
        (staticAnalysis.hasContributing ? 4 : 0) + 
        (staticAnalysis.hasLicense ? 2 : 0)
      )),
      instructionClarity: instructionScore,
      workflowAutomation: workflowScore,
      riskCompliance: riskScore,
      integrationStructure: Math.min(20, Math.round(
        (staticAnalysis.hasWorkflows ? 8 : 0) + 
        (staticAnalysis.hasTests ? 6 : 0) + 
        (staticAnalysis.workflowFiles?.length > 0 ? Math.min(6, staticAnalysis.workflowFiles.length) : 0)
      )),
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis ? Math.min(20, Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 6)) : 10
    },
    findings: findings.slice(0, 10), // Limit to top 10 findings
    recommendations: recommendations.slice(0, 10), // Limit to top 10 recommendations
    detailedAnalysis: {
      instructionClarity: {
        stepByStepQuality: clip20(instructionAnalysis.stepByStepQuality),
        commandClarity: clip20(instructionAnalysis.commandClarity),
        environmentSetup: clip20(instructionAnalysis.environmentSetup),
        errorHandling: clip20(instructionAnalysis.errorHandling),
        dependencySpecification: clip20(instructionAnalysis.dependencySpecification),
        overallScore: instructionScore
      },
      workflowAutomation: {
        ciCdQuality: clip20(workflowAnalysis.ciCdQuality),
        testAutomation: clip20(workflowAnalysis.testAutomation),
        buildScripts: clip20(workflowAnalysis.buildScripts),
        deploymentAutomation: clip20(workflowAnalysis.deploymentAutomation),
        monitoringLogging: clip20(workflowAnalysis.monitoringLogging),
        overallScore: workflowScore
      },
      contextEfficiency: {
        instructionFileOptimization: clip20(contextAnalysis.instructionFileOptimization),
        codeDocumentation: clip20(contextAnalysis.codeDocumentation),
        apiDocumentation: clip20(contextAnalysis.apiDocumentation),
        contextWindowUsage: clip20(contextAnalysis.contextWindowUsage),
        overallScore: contextScore
      },
      riskCompliance: {
        securityPractices: clip20(riskAnalysis.securityPractices),
        errorHandling: clip20(riskAnalysis.errorHandling),
        inputValidation: clip20(riskAnalysis.inputValidation),
        dependencySecurity: clip20(riskAnalysis.dependencySecurity),
        licenseCompliance: clip20(riskAnalysis.licenseCompliance),
        overallScore: riskScore
      }
    },
    confidence: {
      overall: Math.round((
        (instructionAnalysis.confidence ?? 70) + 
        (workflowAnalysis.confidence ?? 70) + 
        (contextAnalysis.confidence ?? 70) + 
        (riskAnalysis.confidence ?? 70)
      ) / 4),
      instructionClarity: instructionAnalysis.confidence ?? 70,
      workflowAutomation: workflowAnalysis.confidence ?? 70,
      contextEfficiency: contextAnalysis.confidence ?? 70,
      riskCompliance: riskAnalysis.confidence ?? 70
    }
  }
}

function generateEnhancedFallbackAssessment(staticAnalysis: StaticAnalysisSummary): EnhancedAIAssessmentResult {
  // Basic fallback assessment with enhanced structure
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
    categories: {
      documentation: Math.min(20, Math.round(
        (staticAnalysis.hasReadme ? 8 : 0) + 
        (staticAnalysis.hasAgents ? 6 : 0) + 
        (staticAnalysis.hasContributing ? 4 : 0) + 
        (staticAnalysis.hasLicense ? 2 : 0)
      )),
      instructionClarity: Math.round((
        (staticAnalysis.hasReadme ? 16 : 4) +
        (staticAnalysis.hasAgents ? 18 : 6) +
        (staticAnalysis.hasContributing ? 14 : 6) +
        (staticAnalysis.errorHandling ? 16 : 4) +
        (staticAnalysis.hasReadme ? 12 : 4)
      ) / 5),
      workflowAutomation: Math.round((
        (staticAnalysis.hasWorkflows ? 18 : 4) +
        (staticAnalysis.hasTests ? 16 : 4) +
        (staticAnalysis.hasWorkflows ? 14 : 6) +
        (staticAnalysis.hasWorkflows ? 12 : 6) +
        (staticAnalysis.hasWorkflows ? 10 : 6)
      ) / 5),
      riskCompliance: Math.round((
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
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis ? Math.min(20, Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 6)) : 10
    },
    findings: [
      // FINDINGS: Describe current state
      staticAnalysis.hasReadme ? 'README.md documentation is present and accessible' : 'No README.md found in repository',
      staticAnalysis.hasAgents ? 'AGENTS.md file provides AI agent context and instructions' : 'No AGENTS.md file found for AI agent guidance',
      staticAnalysis.hasWorkflows ? `Found ${staticAnalysis.workflowFiles?.length || 0} CI/CD workflow files` : 'No CI/CD workflows detected',
      staticAnalysis.hasTests ? `Test suite includes ${staticAnalysis.testFiles?.length || 0} test files` : 'No automated test files found',
      staticAnalysis.errorHandling ? 'Error handling patterns are implemented in codebase' : 'Limited error handling patterns detected',
      staticAnalysis.fileCount > 0 ? `Repository contains ${staticAnalysis.fileCount} files across ${staticAnalysis.languages.length} programming languages` : 'Repository structure analysis incomplete'
    ],
    recommendations: [
      // RECOMMENDATIONS: Provide actionable next steps
      !staticAnalysis.hasReadme ? 'Create a comprehensive README.md with project overview, setup instructions, and usage examples' : 'Consider enhancing README.md with more detailed AI agent context',
      !staticAnalysis.hasAgents ? 'Add AGENTS.md file with specific instructions for AI agents working with this codebase' : 'Review and update AGENTS.md with current best practices',
      !staticAnalysis.hasWorkflows ? 'Implement GitHub Actions workflows for automated testing, building, and deployment' : 'Expand CI/CD coverage to include more comprehensive testing and deployment stages',
      !staticAnalysis.hasTests ? 'Develop automated test suite covering critical functionality and edge cases' : 'Increase test coverage and add integration tests for better reliability',
      !staticAnalysis.errorHandling ? 'Implement comprehensive error handling with proper logging and user feedback' : 'Enhance error handling with more specific error types and recovery mechanisms',
      staticAnalysis.fileSizeAnalysis?.agentCompatibility.overall < 90 ? 'Optimize file sizes to improve AI agent compatibility and processing speed' : 'Maintain current file size practices for optimal AI agent performance'
    ],
    detailedAnalysis: {
      instructionClarity: {
        stepByStepQuality: Math.min(20, staticAnalysis.hasReadme ? 16 : 4),
        commandClarity: Math.min(20, staticAnalysis.hasAgents ? 18 : 6),
        environmentSetup: Math.min(20, staticAnalysis.hasContributing ? 14 : 6),
        errorHandling: Math.min(20, staticAnalysis.errorHandling ? 16 : 4),
        dependencySpecification: Math.min(20, staticAnalysis.hasReadme ? 12 : 4),
        overallScore: Math.round((
          (staticAnalysis.hasReadme ? 16 : 4) +
          (staticAnalysis.hasAgents ? 18 : 6) +
          (staticAnalysis.hasContributing ? 14 : 6) +
          (staticAnalysis.errorHandling ? 16 : 4) +
          (staticAnalysis.hasReadme ? 12 : 4)
        ) / 5)
      },
      workflowAutomation: {
        ciCdQuality: Math.min(20, staticAnalysis.hasWorkflows ? 18 : 4),
        testAutomation: Math.min(20, staticAnalysis.hasTests ? 16 : 4),
        buildScripts: Math.min(20, staticAnalysis.hasWorkflows ? 14 : 6),
        deploymentAutomation: Math.min(20, staticAnalysis.hasWorkflows ? 12 : 6),
        monitoringLogging: Math.min(20, staticAnalysis.hasWorkflows ? 10 : 6),
        overallScore: Math.round((
          (staticAnalysis.hasWorkflows ? 18 : 4) +
          (staticAnalysis.hasTests ? 16 : 4) +
          (staticAnalysis.hasWorkflows ? 14 : 6) +
          (staticAnalysis.hasWorkflows ? 12 : 6) +
          (staticAnalysis.hasWorkflows ? 10 : 6)
        ) / 5)
      },
      contextEfficiency: {
        instructionFileOptimization: Math.min(20, staticAnalysis.hasAgents ? 16 : 8),
        codeDocumentation: Math.min(20, staticAnalysis.hasReadme ? 14 : 6),
        apiDocumentation: Math.min(20, staticAnalysis.hasReadme ? 12 : 6),
        contextWindowUsage: Math.min(20, staticAnalysis.hasAgents ? 18 : 6),
        overallScore: Math.round((
          (staticAnalysis.hasAgents ? 16 : 8) +
          (staticAnalysis.hasReadme ? 14 : 6) +
          (staticAnalysis.hasReadme ? 12 : 6) +
          (staticAnalysis.hasAgents ? 18 : 6)
        ) / 4)
      },
      riskCompliance: {
        securityPractices: Math.min(20, staticAnalysis.errorHandling ? 14 : 6),
        errorHandling: Math.min(20, staticAnalysis.errorHandling ? 18 : 4),
        inputValidation: Math.min(20, staticAnalysis.hasTests ? 12 : 6),
        dependencySecurity: Math.min(20, staticAnalysis.hasTests ? 10 : 6),
        licenseCompliance: Math.min(20, staticAnalysis.hasLicense ? 16 : 4),
        overallScore: Math.round((
          (staticAnalysis.errorHandling ? 14 : 6) +
          (staticAnalysis.errorHandling ? 18 : 4) +
          (staticAnalysis.hasTests ? 12 : 6) +
          (staticAnalysis.hasTests ? 10 : 6) +
          (staticAnalysis.hasLicense ? 16 : 4)
        ) / 5)
      }
    },
    confidence: {
      overall: 60,
      instructionClarity: 60,
      workflowAutomation: 60,
      contextEfficiency: 60,
      riskCompliance: 60
    }
  }
}

export { combineAssessmentResults }