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
  // Remove markdown code blocks if present
  const cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()
  
  return cleaned
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
  aiAnalysisStatus: {
    enabled: boolean
    instructionClarity: boolean
    workflowAutomation: boolean
    contextEfficiency: boolean
    riskCompliance: boolean
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

export async function generateWebsiteAIAssessment(staticAnalysis: StaticAnalysisSummary, agenticFlows?: any): Promise<EnhancedAIAssessmentResult> {
  try {
    console.log('🌐 Starting Website AI Agent Readiness Assessment...')
    console.log('📊 Website Analysis Summary:', {
      hasStructuredData: staticAnalysis.hasStructuredData,
      hasOpenGraph: staticAnalysis.hasOpenGraph,
      hasTwitterCards: staticAnalysis.hasTwitterCards,
      accessibilityScore: staticAnalysis.accessibilityScore,
      seoScore: staticAnalysis.seoScore,
      technologies: staticAnalysis.technologies?.length || 0,
      contactInfo: staticAnalysis.contactInfo?.length || 0,
      socialMediaLinks: staticAnalysis.socialMediaLinks?.length || 0
    })

    // Check for valid OpenAI API key
    const hasValidApiKey = process.env.OPENAI_API_KEY && 
                          process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' &&
                          process.env.OPENAI_API_KEY.length > 20 &&
                          process.env.OPENAI_API_KEY.startsWith('sk-')

    if (!hasValidApiKey) {
      console.error('❌ AI ANALYSIS FAILED: No valid OpenAI API key found!')
      console.error('🔧 API Key Status:', {
        exists: !!process.env.OPENAI_API_KEY,
        isPlaceholder: process.env.OPENAI_API_KEY === 'your_openai_api_key_here'
      })
      console.warn('⚠️ Falling back to static analysis only - AI insights will be limited!')
      return generateWebsiteFallbackAssessment(staticAnalysis)
    }

    console.log('✅ OpenAI API Key validated, proceeding with AI analysis...')
    console.log('🔧 OpenAI Config:', {
      model: OPENAI_MODEL,
      temperature: OPENAI_TEMPERATURE,
      baseURL: process.env.OPENAI_BASE_URL || 'default',
      timeout: '30000'
    })

    console.log('🚀 Starting parallel AI analysis calls...')

    // Parallel AI analysis for website-specific categories
    const [structuredDataAnalysis, apiReadinessAnalysis, conversationalReadinessAnalysis, businessDataAnalysis] = await Promise.all([
      analyzeStructuredData(staticAnalysis),
      analyzeAPIReadiness(staticAnalysis),
      analyzeConversationalReadiness(staticAnalysis),
      analyzeBusinessData(staticAnalysis)
    ])

    console.log('✅ AI Analysis Results:', {
      structuredData: { score: structuredDataAnalysis.overallScore, findings: structuredDataAnalysis.findings?.length || 0 },
      apiReadiness: { score: apiReadinessAnalysis.overallScore, findings: apiReadinessAnalysis.findings?.length || 0 },
      conversational: { score: conversationalReadinessAnalysis.overallScore, findings: conversationalReadinessAnalysis.findings?.length || 0 },
      businessData: { score: businessDataAnalysis.overallScore, findings: businessDataAnalysis.findings?.length || 0 }
    })

    // Calculate category scores (0-20 scale)
    const structuredDataScore = Math.round(structuredDataAnalysis.overallScore * 4) // Convert 0-5 to 0-20
    const apiReadinessScore = Math.round(apiReadinessAnalysis.overallScore * 4)
    const conversationalScore = Math.round(conversationalReadinessAnalysis.overallScore * 4)
    const businessDataScore = Math.round(businessDataAnalysis.overallScore * 4)

    // Calculate overall readiness score (0-100 scale)
    let overallScore: number
    if (agenticFlows) {
      // Use agentic flows for scoring if available
      const flowScores = [
        agenticFlows.informationGathering?.score || 0,
        agenticFlows.directBooking?.score || 0,
        agenticFlows.faqSupport?.score || 0,
        agenticFlows.taskManagement?.score || 0,
        agenticFlows.personalization?.score || 0
      ]
      const averageFlowScore = flowScores.reduce((sum, score) => sum + score, 0) / flowScores.length
      overallScore = Math.min(100, Math.round(averageFlowScore))
    } else {
      // Fallback to AI analysis categories
      const averageScore = (structuredDataScore + apiReadinessScore + conversationalScore + businessDataScore) / 4
      overallScore = Math.min(100, Math.round(averageScore * 5))
    }

    console.log('🎯 Final Assessment Score:', overallScore)

    // Generate findings and recommendations
    const aiFindings = [
      ...(Array.isArray(structuredDataAnalysis.findings) ? structuredDataAnalysis.findings : []),
      ...(Array.isArray(apiReadinessAnalysis.findings) ? apiReadinessAnalysis.findings : []),
      ...(Array.isArray(conversationalReadinessAnalysis.findings) ? conversationalReadinessAnalysis.findings : []),
      ...(Array.isArray(businessDataAnalysis.findings) ? businessDataAnalysis.findings : [])
    ]

    const aiRecommendations = [
      ...(Array.isArray(structuredDataAnalysis.recommendations) ? structuredDataAnalysis.recommendations : []),
      ...(Array.isArray(apiReadinessAnalysis.recommendations) ? apiReadinessAnalysis.recommendations : []),
      ...(Array.isArray(conversationalReadinessAnalysis.recommendations) ? conversationalReadinessAnalysis.recommendations : []),
      ...(Array.isArray(businessDataAnalysis.recommendations) ? businessDataAnalysis.recommendations : [])
    ]

    // Fallback to static analysis findings if AI findings are empty
    const findings = aiFindings.length > 0 ? aiFindings.slice(0, 10) : generateWebsiteStaticFindings(staticAnalysis)
    const recommendations = aiRecommendations.length > 0 ? aiRecommendations.slice(0, 10) : generateWebsiteStaticRecommendations(staticAnalysis)

    return {
      readinessScore: overallScore,
      aiAnalysisStatus: {
        enabled: true,
        instructionClarity: true,
        workflowAutomation: true,
        contextEfficiency: true,
        riskCompliance: true,
        overallSuccess: true
      },
      categories: {
        documentation: structuredDataScore,
        instructionClarity: apiReadinessScore,
        workflowAutomation: conversationalScore,
        riskCompliance: businessDataScore,
        integrationStructure: Math.round((structuredDataScore + apiReadinessScore) / 2),
        fileSizeOptimization: Math.round((conversationalScore + businessDataScore) / 2)
      },
      findings,
      recommendations,
      detailedAnalysis: {
        instructionClarity: {
          stepByStepQuality: structuredDataAnalysis.stepByStepQuality || 0,
          commandClarity: structuredDataAnalysis.commandClarity || 0,
          environmentSetup: structuredDataAnalysis.environmentSetup || 0,
          errorHandling: structuredDataAnalysis.errorHandling || 0,
          dependencySpecification: structuredDataAnalysis.dependencySpecification || 0,
          overallScore: structuredDataScore
        },
        workflowAutomation: {
          ciCdQuality: apiReadinessAnalysis.ciCdQuality || 0,
          testAutomation: apiReadinessAnalysis.testAutomation || 0,
          buildScripts: apiReadinessAnalysis.buildScripts || 0,
          deploymentAutomation: apiReadinessAnalysis.deploymentAutomation || 0,
          monitoringLogging: apiReadinessAnalysis.monitoringLogging || 0,
          overallScore: apiReadinessScore
        },
        contextEfficiency: {
          instructionFileOptimization: conversationalReadinessAnalysis.instructionFileOptimization || 0,
          codeDocumentation: conversationalReadinessAnalysis.codeDocumentation || 0,
          apiDocumentation: conversationalReadinessAnalysis.apiDocumentation || 0,
          contextWindowUsage: conversationalReadinessAnalysis.contextWindowUsage || 0,
          overallScore: conversationalScore
        },
        riskCompliance: {
          securityPractices: businessDataAnalysis.securityPractices || 0,
          errorHandling: businessDataAnalysis.errorHandling || 0,
          inputValidation: businessDataAnalysis.inputValidation || 0,
          dependencySecurity: businessDataAnalysis.dependencySecurity || 0,
          licenseCompliance: businessDataAnalysis.licenseCompliance || 0,
          overallScore: businessDataScore
        }
      },
      confidence: {
        overall: Math.round((structuredDataAnalysis.confidence + apiReadinessAnalysis.confidence + conversationalReadinessAnalysis.confidence + businessDataAnalysis.confidence) / 4),
        instructionClarity: structuredDataAnalysis.confidence || 0,
        workflowAutomation: apiReadinessAnalysis.confidence || 0,
        contextEfficiency: conversationalReadinessAnalysis.confidence || 0,
        riskCompliance: businessDataAnalysis.confidence || 0
      }
    }
  } catch (error) {
    console.error('Website AI Assessment error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    })
    console.warn('⚠️ Falling back to static analysis only - AI insights will be limited!')
    return generateWebsiteFallbackAssessment(staticAnalysis)
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

    // Check if OpenAI API key is available and valid
    const hasValidApiKey = process.env.OPENAI_API_KEY && 
      process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' && 
      process.env.OPENAI_API_KEY.length > 20

    if (!hasValidApiKey) {
      console.error('❌ AI ANALYSIS FAILED: No valid OpenAI API key found!')
      console.error('🔧 API Key Status:', {
        exists: !!process.env.OPENAI_API_KEY,
        isPlaceholder: process.env.OPENAI_API_KEY === 'your_openai_api_key_here'
      })
      console.warn('⚠️ Falling back to static analysis only - AI insights will be limited!')
      return generateEnhancedFallbackAssessment(staticAnalysis)
    }

    console.log('✅ OpenAI API Key validated, proceeding with AI analysis...')
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
    console.error('❌ AI ANALYSIS FAILED: Error during AI processing!')
    console.error('🔧 Error Type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('📋 Error Details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    console.warn('⚠️ Falling back to static analysis only - AI insights will be limited!')
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
    console.log('📄 Raw AI Response (full):', content)
    console.log('📄 Raw AI Response (first 1000 chars):', content.substring(0, 1000))
    
    const cleanedContent = cleanJsonResponse(content)
    const parsed = JSON.parse(cleanedContent)
    console.log('🔍 Parsed JSON:', {
      hasStepByStepQuality: 'stepByStepQuality' in parsed,
      hasCommandClarity: 'commandClarity' in parsed,
      hasEnvironmentSetup: 'environmentSetup' in parsed,
      hasErrorHandling: 'errorHandling' in parsed,
      hasDependencySpecification: 'dependencySpecification' in parsed,
      hasFindings: 'findings' in parsed,
      hasRecommendations: 'recommendations' in parsed,
      findingsLength: Array.isArray(parsed.findings) ? parsed.findings.length : 'not array',
      recommendationsLength: Array.isArray(parsed.recommendations) ? parsed.recommendations.length : 'not array',
      actualKeys: Object.keys(parsed),
      stepByStepQualityValue: parsed.stepByStepQuality,
      stepByStepQualityType: typeof parsed.stepByStepQuality,
      commandClarityValue: parsed.commandClarity,
      commandClarityType: typeof parsed.commandClarity
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
    console.error('❌ AI ANALYSIS FAILED: Instruction Clarity analysis failed!')
    console.error('🔧 Error Type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('📋 Error Details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    })
    console.warn('⚠️ Using fallback values for Instruction Clarity - AI insights will be limited!')
    
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
    const cleanedContent = cleanJsonResponse(content)
    const parsed = JSON.parse(cleanedContent)
    
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
    const cleanedContent = cleanJsonResponse(content)
    const parsed = JSON.parse(cleanedContent)
    
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
    const cleanedContent = cleanJsonResponse(content)
    const parsed = JSON.parse(cleanedContent)
    
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
  const averageScore = (instructionScore + workflowScore + contextScore + riskScore) / 4
  const overallScore = Math.min(100, Math.round(averageScore * 5))

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
    (staticAnalysis.fileSizeAnalysis?.agentCompatibility?.overall ?? 100) < 90 ? 'Optimize file sizes to improve AI agent compatibility and processing speed' : 'Maintain current file size practices for optimal AI agent performance'
  ]

  return {
    readinessScore: overallScore,
    aiAnalysisStatus: {
      enabled: true,
      instructionClarity: instructionAnalysis.confidence > 0,
      workflowAutomation: workflowAnalysis.confidence > 0,
      contextEfficiency: contextAnalysis.confidence > 0,
      riskCompliance: riskAnalysis.confidence > 0,
      overallSuccess: (instructionAnalysis.confidence > 0 && workflowAnalysis.confidence > 0 && 
                      contextAnalysis.confidence > 0 && riskAnalysis.confidence > 0)
    },
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

// Website-specific analysis functions
async function analyzeStructuredData(staticAnalysis: StaticAnalysisSummary) {
  const prompt = `Analyze the structured data and machine-readability of this website for AI agent compatibility.

Website Analysis:
- Has Structured Data (JSON-LD): ${staticAnalysis.hasStructuredData}
- Has Open Graph: ${staticAnalysis.hasOpenGraph}
- Has Twitter Cards: ${staticAnalysis.hasTwitterCards}
- Page Title: ${staticAnalysis.pageTitle || 'Not found'}
- Meta Description: ${staticAnalysis.metaDescription || 'Not found'}
- Technologies: ${staticAnalysis.technologies?.join(', ') || 'None detected'}

Rate each aspect 1-5 (1=poor, 5=excellent) and provide findings and recommendations for AI agent compatibility.

Respond with JSON:
{
  "structuredDataQuality": 1-5,
  "metaTagCompleteness": 1-5,
  "semanticMarkup": 1-5,
  "machineReadability": 1-5,
  "overallScore": 1-5,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 1-100
}`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: OPENAI_TEMPERATURE,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const cleanedContent = cleanJsonResponse(content)
    const result = JSON.parse(cleanedContent)
    return {
      stepByStepQuality: result.structuredDataQuality || 1,
      commandClarity: result.metaTagCompleteness || 1,
      environmentSetup: result.semanticMarkup || 1,
      errorHandling: result.machineReadability || 1,
      dependencySpecification: result.overallScore || 1,
      overallScore: result.overallScore || 1,
      findings: result.findings || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 50
    }
  } catch (error) {
    console.error('Failed to parse structured data analysis:', error)
    return {
      stepByStepQuality: staticAnalysis.hasStructuredData ? 3 : 1,
      commandClarity: (staticAnalysis.hasOpenGraph && staticAnalysis.hasTwitterCards) ? 4 : 2,
      environmentSetup: 2,
      errorHandling: 2,
      dependencySpecification: 2,
      overallScore: 2,
      findings: ['Structured data analysis failed'],
      recommendations: ['Add JSON-LD structured data'],
      confidence: 30
    }
  }
}

async function analyzeAPIReadiness(staticAnalysis: StaticAnalysisSummary) {
  const prompt = `Analyze the API readiness and integration potential of this website for AI agents.

Website Analysis:
- Technologies: ${staticAnalysis.technologies?.join(', ') || 'None detected'}
- Contact Info Available: ${staticAnalysis.contactInfo?.length || 0} items
- Social Media Links: ${staticAnalysis.socialMediaLinks?.join(', ') || 'None'}
- Has Service Worker: ${staticAnalysis.hasServiceWorker}
- Has Web App Manifest: ${staticAnalysis.hasManifest}

Rate each aspect 1-5 (1=poor, 5=excellent) for AI agent integration potential.

Respond with JSON:
{
  "apiAvailability": 1-5,
  "integrationPoints": 1-5,
  "dataAccessibility": 1-5,
  "automationPotential": 1-5,
  "overallScore": 1-5,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 1-100
}`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: OPENAI_TEMPERATURE,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const cleanedContent = cleanJsonResponse(content)
    const result = JSON.parse(cleanedContent)
    return {
      ciCdQuality: result.apiAvailability || 1,
      testAutomation: result.integrationPoints || 1,
      buildScripts: result.dataAccessibility || 1,
      deploymentAutomation: result.automationPotential || 1,
      monitoringLogging: result.overallScore || 1,
      overallScore: result.overallScore || 1,
      findings: result.findings || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 50
    }
  } catch (error) {
    console.error('Failed to parse API readiness analysis:', error)
    return {
      ciCdQuality: 1,
      testAutomation: 1,
      buildScripts: staticAnalysis.contactInfo?.length ? 3 : 1,
      deploymentAutomation: 1,
      monitoringLogging: 1,
      overallScore: 1,
      findings: ['API readiness analysis failed'],
      recommendations: ['Add API endpoints for AI agent integration'],
      confidence: 30
    }
  }
}

async function analyzeConversationalReadiness(staticAnalysis: StaticAnalysisSummary) {
  const prompt = `Analyze the conversational readiness and natural language compatibility of this website for AI agents.

Website Analysis:
- Page Title: ${staticAnalysis.pageTitle || 'Not found'}
- Meta Description: ${staticAnalysis.metaDescription || 'Not found'}
- Content Length: ${staticAnalysis.contentLength || 0} characters
- Navigation Items: ${staticAnalysis.navigationStructure?.join(', ') || 'None'}
- Accessibility Score: ${staticAnalysis.accessibilityScore || 0}/100
- SEO Score: ${staticAnalysis.seoScore || 0}/100

Rate each aspect 1-5 (1=poor, 5=excellent) for conversational AI agent compatibility.

Respond with JSON:
{
  "contentClarity": 1-5,
  "naturalLanguageStructure": 1-5,
  "conversationFlow": 1-5,
  "userIntentMatching": 1-5,
  "overallScore": 1-5,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 1-100
}`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: OPENAI_TEMPERATURE,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const cleanedContent = cleanJsonResponse(content)
    const result = JSON.parse(cleanedContent)
    return {
      instructionFileOptimization: result.contentClarity || 1,
      codeDocumentation: result.naturalLanguageStructure || 1,
      apiDocumentation: result.conversationFlow || 1,
      contextWindowUsage: result.userIntentMatching || 1,
      overallScore: result.overallScore || 1,
      findings: result.findings || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 50
    }
  } catch (error) {
    console.error('Failed to parse conversational readiness analysis:', error)
    return {
      instructionFileOptimization: staticAnalysis.pageTitle ? 3 : 1,
      codeDocumentation: 2,
      apiDocumentation: 2,
      contextWindowUsage: 2,
      overallScore: 2,
      findings: ['Conversational readiness analysis failed'],
      recommendations: ['Improve content structure for AI agents'],
      confidence: 30
    }
  }
}

async function analyzeBusinessData(staticAnalysis: StaticAnalysisSummary) {
  const prompt = `Analyze the business data completeness and AI agent accessibility of this website.

Website Analysis:
- Contact Information: ${staticAnalysis.contactInfo?.join(', ') || 'None found'}
- Social Media Links: ${staticAnalysis.socialMediaLinks?.join(', ') || 'None found'}
- Business Hours/Location: Not analyzed
- Services/Products: Not analyzed
- Pricing Information: Not analyzed

Rate each aspect 1-5 (1=poor, 5=excellent) for business data AI agent accessibility.

Respond with JSON:
{
  "contactDataCompleteness": 1-5,
  "businessInfoAccessibility": 1-5,
  "serviceDataClarity": 1-5,
  "pricingTransparency": 1-5,
  "overallScore": 1-5,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "confidence": 1-100
}`

  try {
    const response = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: OPENAI_TEMPERATURE,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No response from OpenAI')

    const cleanedContent = cleanJsonResponse(content)
    const result = JSON.parse(cleanedContent)
    return {
      securityPractices: result.contactDataCompleteness || 1,
      errorHandling: result.businessInfoAccessibility || 1,
      inputValidation: result.serviceDataClarity || 1,
      dependencySecurity: result.pricingTransparency || 1,
      licenseCompliance: result.overallScore || 1,
      overallScore: result.overallScore || 1,
      findings: result.findings || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 50
    }
  } catch (error) {
    console.error('Failed to parse business data analysis:', error)
    return {
      securityPractices: staticAnalysis.contactInfo?.length ? 3 : 1,
      errorHandling: 2,
      inputValidation: 2,
      dependencySecurity: 1,
      licenseCompliance: 2,
      overallScore: 2,
      findings: ['Business data analysis failed'],
      recommendations: ['Add structured business information'],
      confidence: 30
    }
  }
}

function generateWebsiteStaticFindings(staticAnalysis: StaticAnalysisSummary): string[] {
  const findings: string[] = []
  
  if (!staticAnalysis.hasStructuredData) {
    findings.push('No structured data (JSON-LD) found - AI agents will have difficulty understanding content')
  }
  
  if (!staticAnalysis.hasOpenGraph) {
    findings.push('Missing Open Graph meta tags - limits social sharing and AI agent context')
  }
  
  if (!staticAnalysis.pageTitle) {
    findings.push('No page title found - critical for AI agent identification')
  }
  
  if (!staticAnalysis.metaDescription) {
    findings.push('No meta description found - limits AI agent understanding of page purpose')
  }
  
  if ((staticAnalysis.accessibilityScore || 0) < 50) {
    findings.push('Low accessibility score - may impact AI agent content parsing')
  }
  
  if (staticAnalysis.contactInfo?.length === 0) {
    findings.push('No contact information found - limits AI agent business data access')
  }
  
  return findings
}

function generateWebsiteStaticRecommendations(staticAnalysis: StaticAnalysisSummary): string[] {
  const recommendations: string[] = []
  
  if (!staticAnalysis.hasStructuredData) {
    recommendations.push('Add JSON-LD structured data to help AI agents understand content structure')
  }
  
  if (!staticAnalysis.hasOpenGraph) {
    recommendations.push('Implement Open Graph meta tags for better social sharing and AI agent context')
  }
  
  if (!staticAnalysis.hasTwitterCards) {
    recommendations.push('Add Twitter Card meta tags for enhanced social media integration')
  }
  
  if ((staticAnalysis.accessibilityScore || 0) < 70) {
    recommendations.push('Improve accessibility with semantic HTML, alt text, and proper heading structure')
  }
  
  if (staticAnalysis.contactInfo?.length === 0) {
    recommendations.push('Add clear contact information (phone, email, address) for AI agent access')
  }
  
  if (!staticAnalysis.hasSitemap) {
    recommendations.push('Create and submit an XML sitemap to help AI agents discover all pages')
  }
  
  return recommendations
}

function generateWebsiteFallbackAssessment(staticAnalysis: StaticAnalysisSummary): EnhancedAIAssessmentResult {
  // Basic fallback assessment for websites
  const baseScore = Math.round(
    (staticAnalysis.hasStructuredData ? 15 : 0) +
    (staticAnalysis.hasOpenGraph ? 10 : 0) +
    (staticAnalysis.hasTwitterCards ? 5 : 0) +
    (staticAnalysis.pageTitle ? 10 : 0) +
    (staticAnalysis.metaDescription ? 10 : 0) +
    ((staticAnalysis.accessibilityScore || 0) > 50 ? 10 : 0) +
    (staticAnalysis.contactInfo?.length ? 10 : 0) +
    (staticAnalysis.socialMediaLinks?.length ? 5 : 0) +
    (staticAnalysis.hasSitemap ? 5 : 0) +
    (staticAnalysis.hasRobotsTxt ? 5 : 0) +
    (staticAnalysis.technologies?.length ? 5 : 0)
  )

  return {
    readinessScore: Math.min(baseScore, 100),
    aiAnalysisStatus: {
      enabled: false,
      instructionClarity: false,
      workflowAutomation: false,
      contextEfficiency: false,
      riskCompliance: false,
      overallSuccess: false,
      reason: 'AI analysis unavailable - using static analysis only'
    },
    categories: {
      documentation: staticAnalysis.hasStructuredData ? 15 : 5,
      instructionClarity: staticAnalysis.hasOpenGraph ? 12 : 5,
      workflowAutomation: staticAnalysis.contactInfo?.length ? 10 : 5,
      riskCompliance: (staticAnalysis.accessibilityScore || 0) > 50 ? 12 : 5,
      integrationStructure: staticAnalysis.technologies?.length ? 10 : 5,
      fileSizeOptimization: staticAnalysis.hasSitemap ? 8 : 5
    },
    findings: generateWebsiteStaticFindings(staticAnalysis),
    recommendations: generateWebsiteStaticRecommendations(staticAnalysis),
    detailedAnalysis: {
      instructionClarity: {
        stepByStepQuality: 5,
        commandClarity: 5,
        environmentSetup: 5,
        errorHandling: 5,
        dependencySpecification: 5,
        overallScore: 5
      },
      workflowAutomation: {
        ciCdQuality: 5,
        testAutomation: 5,
        buildScripts: 5,
        deploymentAutomation: 5,
        monitoringLogging: 5,
        overallScore: 5
      },
      contextEfficiency: {
        instructionFileOptimization: 5,
        codeDocumentation: 5,
        apiDocumentation: 5,
        contextWindowUsage: 5,
        overallScore: 5
      },
      riskCompliance: {
        securityPractices: 5,
        errorHandling: 5,
        inputValidation: 5,
        dependencySecurity: 5,
        licenseCompliance: 5,
        overallScore: 5
      }
    },
    confidence: {
      overall: 30,
      instructionClarity: 30,
      workflowAutomation: 30,
      contextEfficiency: 30,
      riskCompliance: 30
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
    aiAnalysisStatus: {
      enabled: false,
      instructionClarity: false,
      workflowAutomation: false,
      contextEfficiency: false,
      riskCompliance: false,
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
      (staticAnalysis.fileSizeAnalysis?.agentCompatibility?.overall ?? 100) < 90 ? 'Optimize file sizes to improve AI agent compatibility and processing speed' : 'Maintain current file size practices for optimal AI agent performance'
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