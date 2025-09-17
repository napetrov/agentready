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
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set; falling back to basic assessment.')
      return generateEnhancedFallbackAssessment(staticAnalysis)
    }

    // Generate multiple specialized assessments
    const [instructionAnalysis, workflowAnalysis, contextAnalysis, riskAnalysis] = await Promise.all([
      analyzeInstructionClarity(staticAnalysis),
      analyzeWorkflowAutomation(staticAnalysis),
      analyzeContextEfficiency(staticAnalysis),
      analyzeRiskCompliance(staticAnalysis)
    ])

    // Combine results into final assessment
    return combineAssessmentResults(instructionAnalysis, workflowAnalysis, contextAnalysis, riskAnalysis, staticAnalysis)

  } catch (error) {
    console.error('Enhanced AI assessment error:', error)
    return generateEnhancedFallbackAssessment(staticAnalysis)
  }
}

async function analyzeInstructionClarity(staticAnalysis: StaticAnalysisSummary): Promise<any> {
  const prompt = createInstructionClarityPrompt(staticAnalysis)
  
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

  return JSON.parse(response.choices[0]?.message?.content || '{}')
}

async function analyzeWorkflowAutomation(staticAnalysis: StaticAnalysisSummary): Promise<any> {
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

  return JSON.parse(response.choices[0]?.message?.content || '{}')
}

async function analyzeContextEfficiency(staticAnalysis: StaticAnalysisSummary): Promise<any> {
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

  return JSON.parse(response.choices[0]?.message?.content || '{}')
}

async function analyzeRiskCompliance(staticAnalysis: StaticAnalysisSummary): Promise<any> {
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

  return JSON.parse(response.choices[0]?.message?.content || '{}')
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
- Total Files: ${staticAnalysis.fileCount}`

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
- Files by Size: ${fs.filesBySize.under1MB} under 1MB, ${fs.filesBySize.under2MB} under 2MB, ${fs.filesBySize.under10MB} under 10MB
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
- Total Files: ${staticAnalysis.fileCount}`

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
  instructionAnalysis: any,
  workflowAnalysis: any,
  contextAnalysis: any,
  riskAnalysis: any,
  staticAnalysis: StaticAnalysisSummary
): EnhancedAIAssessmentResult {
  // Calculate overall scores
  const instructionScore = Math.round((instructionAnalysis.stepByStepQuality + instructionAnalysis.commandClarity + instructionAnalysis.environmentSetup + instructionAnalysis.errorHandling + instructionAnalysis.dependencySpecification) / 5)
  const workflowScore = Math.round((workflowAnalysis.ciCdQuality + workflowAnalysis.testAutomation + workflowAnalysis.buildScripts + workflowAnalysis.deploymentAutomation + workflowAnalysis.monitoringLogging) / 5)
  const contextScore = Math.round((contextAnalysis.instructionFileOptimization + contextAnalysis.codeDocumentation + contextAnalysis.apiDocumentation + contextAnalysis.contextWindowUsage) / 4)
  const riskScore = Math.round((riskAnalysis.securityPractices + riskAnalysis.errorHandling + riskAnalysis.inputValidation + riskAnalysis.dependencySecurity + riskAnalysis.licenseCompliance) / 5)

  // Calculate overall readiness score
  const overallScore = Math.round((instructionScore + workflowScore + contextScore + riskScore) / 4)

  // Generate findings and recommendations
  const findings = [
    ...(instructionAnalysis.findings || []),
    ...(workflowAnalysis.findings || []),
    ...(contextAnalysis.findings || []),
    ...(riskAnalysis.findings || [])
  ]

  const recommendations = [
    ...(instructionAnalysis.recommendations || []),
    ...(workflowAnalysis.recommendations || []),
    ...(contextAnalysis.recommendations || []),
    ...(riskAnalysis.recommendations || [])
  ]

  return {
    readinessScore: overallScore,
    categories: {
      documentation: Math.round((staticAnalysis.hasReadme ? 15 : 0) + (staticAnalysis.hasAgents ? 5 : 0)),
      instructionClarity: instructionScore,
      workflowAutomation: workflowScore,
      riskCompliance: riskScore,
      integrationStructure: Math.round((staticAnalysis.hasWorkflows ? 10 : 0) + (staticAnalysis.hasTests ? 10 : 0)),
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis ? Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 5) : 10
    },
    findings: findings.slice(0, 10), // Limit to top 10 findings
    recommendations: recommendations.slice(0, 10), // Limit to top 10 recommendations
    detailedAnalysis: {
      instructionClarity: {
        stepByStepQuality: instructionAnalysis.stepByStepQuality || 0,
        commandClarity: instructionAnalysis.commandClarity || 0,
        environmentSetup: instructionAnalysis.environmentSetup || 0,
        errorHandling: instructionAnalysis.errorHandling || 0,
        dependencySpecification: instructionAnalysis.dependencySpecification || 0,
        overallScore: instructionScore
      },
      workflowAutomation: {
        ciCdQuality: workflowAnalysis.ciCdQuality || 0,
        testAutomation: workflowAnalysis.testAutomation || 0,
        buildScripts: workflowAnalysis.buildScripts || 0,
        deploymentAutomation: workflowAnalysis.deploymentAutomation || 0,
        monitoringLogging: workflowAnalysis.monitoringLogging || 0,
        overallScore: workflowScore
      },
      contextEfficiency: {
        instructionFileOptimization: contextAnalysis.instructionFileOptimization || 0,
        codeDocumentation: contextAnalysis.codeDocumentation || 0,
        apiDocumentation: contextAnalysis.apiDocumentation || 0,
        contextWindowUsage: contextAnalysis.contextWindowUsage || 0,
        overallScore: contextScore
      },
      riskCompliance: {
        securityPractices: riskAnalysis.securityPractices || 0,
        errorHandling: riskAnalysis.errorHandling || 0,
        inputValidation: riskAnalysis.inputValidation || 0,
        dependencySecurity: riskAnalysis.dependencySecurity || 0,
        licenseCompliance: riskAnalysis.licenseCompliance || 0,
        overallScore: riskScore
      }
    },
    confidence: {
      overall: Math.round((instructionAnalysis.confidence || 70 + workflowAnalysis.confidence || 70 + contextAnalysis.confidence || 70 + riskAnalysis.confidence || 70) / 4),
      instructionClarity: instructionAnalysis.confidence || 70,
      workflowAutomation: workflowAnalysis.confidence || 70,
      contextEfficiency: contextAnalysis.confidence || 70,
      riskCompliance: riskAnalysis.confidence || 70
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
      documentation: Math.round((staticAnalysis.hasReadme ? 15 : 0) + (staticAnalysis.hasAgents ? 5 : 0)),
      instructionClarity: Math.round(baseScore * 0.8),
      workflowAutomation: Math.round((staticAnalysis.hasWorkflows ? 15 : 0) + (staticAnalysis.hasTests ? 5 : 0)),
      riskCompliance: Math.round((staticAnalysis.hasLicense ? 10 : 0) + (staticAnalysis.errorHandling ? 10 : 0)),
      integrationStructure: Math.round((staticAnalysis.hasWorkflows ? 10 : 0) + (staticAnalysis.hasTests ? 10 : 0)),
      fileSizeOptimization: staticAnalysis.fileSizeAnalysis ? Math.round(staticAnalysis.fileSizeAnalysis.agentCompatibility.overall / 5) : 10
    },
    findings: [
      staticAnalysis.hasReadme ? 'README.md present' : 'Missing README.md',
      staticAnalysis.hasAgents ? 'AGENTS.md present' : 'Missing AGENTS.md for AI agent instructions',
      staticAnalysis.hasWorkflows ? 'CI/CD workflows detected' : 'No CI/CD workflows found',
      staticAnalysis.hasTests ? 'Test files detected' : 'No test files found',
      staticAnalysis.errorHandling ? 'Error handling patterns detected' : 'Limited error handling detected'
    ],
    recommendations: [
      !staticAnalysis.hasReadme ? 'Add comprehensive README.md' : 'README.md is present',
      !staticAnalysis.hasAgents ? 'Create AGENTS.md with AI agent instructions' : 'AGENTS.md is present',
      !staticAnalysis.hasWorkflows ? 'Implement CI/CD workflows' : 'CI/CD workflows are present',
      !staticAnalysis.hasTests ? 'Add automated test suite' : 'Test suite is present',
      !staticAnalysis.errorHandling ? 'Improve error handling patterns' : 'Error handling is adequate'
    ],
    detailedAnalysis: {
      instructionClarity: {
        stepByStepQuality: 10,
        commandClarity: 10,
        environmentSetup: 10,
        errorHandling: 10,
        dependencySpecification: 10,
        overallScore: 10
      },
      workflowAutomation: {
        ciCdQuality: staticAnalysis.hasWorkflows ? 15 : 5,
        testAutomation: staticAnalysis.hasTests ? 15 : 5,
        buildScripts: 10,
        deploymentAutomation: 10,
        monitoringLogging: 10,
        overallScore: staticAnalysis.hasWorkflows ? 15 : 5
      },
      contextEfficiency: {
        instructionFileOptimization: 10,
        codeDocumentation: 10,
        apiDocumentation: 10,
        contextWindowUsage: 10,
        overallScore: 10
      },
      riskCompliance: {
        securityPractices: 10,
        errorHandling: staticAnalysis.errorHandling ? 15 : 5,
        inputValidation: 10,
        dependencySecurity: 10,
        licenseCompliance: staticAnalysis.hasLicense ? 15 : 5,
        overallScore: staticAnalysis.errorHandling ? 15 : 5
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