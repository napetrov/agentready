import 'server-only'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,           // optional: Azure / proxy / compat providers
  timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000), // fail fast
})

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

export interface StaticAnalysisSummary {
  hasReadme: boolean
  hasContributing: boolean
  hasAgents: boolean
  hasLicense: boolean
  hasWorkflows: boolean
  hasTests: boolean
  languages: string[]
  errorHandling: boolean
  fileCount: number
  readmeContent?: string
  contributingContent?: string
  agentsContent?: string
  workflowFiles: string[]
  testFiles: string[]
}

export interface AIAssessmentResult {
  readinessScore: number
  categories: {
    documentation: number
    instructionClarity: number
    workflowAutomation: number
    riskCompliance: number
    integrationStructure: number
  }
  findings: string[]
  recommendations: string[]
}

export async function generateAIAssessment(staticAnalysis: StaticAnalysisSummary): Promise<AIAssessmentResult> {
  try {
    const prompt = createAssessmentPrompt(staticAnalysis)
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY is not set; falling back to deterministic assessment.')
      return generateFallbackAssessment(staticAnalysis)
    }
    
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI agent readiness assessor. Analyze the provided repository information and provide a comprehensive assessment focusing on how well-prepared the repository is for AI agent interaction and automation.

Assessment Categories (0-20 points each):
1. Documentation Completeness: README, CONTRIBUTING, AGENTS docs, code comments
2. Instruction Clarity: Clear setup instructions, API documentation, usage examples
3. Workflow Automation Potential: CI/CD, automated testing, deployment scripts
4. Risk & Compliance: Error handling, security considerations, license compliance
5. Integration & Structure: Code organization, modularity, API design

Provide a JSON response with the following structure:
{
  "readinessScore": 0-100,
  "categories": {
    "documentation": 0-20,
    "instructionClarity": 0-20,
    "workflowAutomation": 0-20,
    "riskCompliance": 0-20,
    "integrationStructure": 0-20
  },
  "findings": ["finding1", "finding2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse JSON response - try to parse the entire trimmed content first
    let assessment
    try {
      const trimmedContent = content.trim()
      assessment = JSON.parse(trimmedContent)
    } catch (parseError) {
      // Fallback to regex extraction if direct parsing fails
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response')
      }
      try {
        assessment = JSON.parse(jsonMatch[0])
      } catch (regexParseError) {
        throw new Error(`Failed to parse JSON response: ${regexParseError instanceof Error ? regexParseError.message : 'Unknown error'}`)
      }
    }
    
    // Validate the response structure with proper type checking
    if (typeof assessment.readinessScore !== 'number' || assessment.readinessScore < 0 || assessment.readinessScore > 100) {
      throw new Error('Invalid readinessScore: must be a number between 0 and 100')
    }
    
    if (!assessment.categories || typeof assessment.categories !== 'object') {
      throw new Error('Invalid categories: must be an object')
    }
    
    const requiredCategories = ['documentation', 'instructionClarity', 'workflowAutomation', 'riskCompliance', 'integrationStructure']
    for (const category of requiredCategories) {
      if (typeof assessment.categories[category] !== 'number' || assessment.categories[category] < 0 || assessment.categories[category] > 20) {
        throw new Error(`Invalid ${category} score: must be a number between 0 and 20`)
      }
    }
    
    if (!Array.isArray(assessment.findings)) {
      throw new Error('Invalid findings: must be an array')
    }
    if (!assessment.findings.every((x: unknown) => typeof x === 'string')) {
      throw new Error('Invalid findings: items must be strings')
    }
    
    if (!Array.isArray(assessment.recommendations)) {
      throw new Error('Invalid recommendations: must be an array')
    }
    if (!assessment.recommendations.every((x: unknown) => typeof x === 'string')) {
      throw new Error('Invalid recommendations: items must be strings')
    }

    return assessment
  } catch (error) {
    console.error('AI Assessment error:', error)
    
    // Fallback assessment based on static analysis
    return generateFallbackAssessment(staticAnalysis)
  }
}

function createAssessmentPrompt(staticAnalysis: StaticAnalysisSummary): string {
  const {
    hasReadme,
    hasContributing,
    hasAgents,
    hasLicense,
    hasWorkflows,
    hasTests,
    languages,
    errorHandling,
    fileCount,
    readmeContent,
    contributingContent,
    agentsContent,
    workflowFiles,
    testFiles
  } = staticAnalysis

  let prompt = `Repository Analysis Data:

Static Analysis Results:
- Has README: ${hasReadme}
- Has CONTRIBUTING: ${hasContributing}
- Has AGENTS documentation: ${hasAgents}
- Has LICENSE: ${hasLicense}
- Has CI/CD Workflows: ${hasWorkflows} (${(workflowFiles || []).length} files)
- Has Tests: ${hasTests} (${(testFiles || []).length} files)
- Error Handling Detected: ${errorHandling}
- Total Files: ${fileCount}
- Primary Languages: ${(languages || []).join(', ')}

Documentation Content:`

  if (readmeContent) {
    prompt += `\n\nREADME Content (first 2000 chars):\n${readmeContent.substring(0, 2000)}`
  }

  if (contributingContent) {
    prompt += `\n\nCONTRIBUTING Content (first 1000 chars):\n${contributingContent.substring(0, 1000)}`
  }

  if (agentsContent) {
    prompt += `\n\nAGENTS Content (first 1000 chars):\n${agentsContent.substring(0, 1000)}`
  }

  // Filter out binary/lock files from workflow and test file lists
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.ico', '.lock', '.zip', '.tar', '.gz', '.7z', '.exe', '.dll', '.dylib', '.bin']
  const filteredWorkflowFiles = (workflowFiles || []).filter(file => 
    !binaryExtensions.some(ext => file.toLowerCase().endsWith(ext))
  )
  const filteredTestFiles = (testFiles || []).filter(file => 
    !binaryExtensions.some(ext => file.toLowerCase().endsWith(ext))
  )
  
  prompt += `\n\nWorkflow Files: ${filteredWorkflowFiles.join(', ')}`
  prompt += `\n\nTest Files: ${filteredTestFiles.slice(0, 10).join(', ')}${filteredTestFiles.length > 10 ? '...' : ''}`

  return prompt
}

function generateFallbackAssessment(staticAnalysis: StaticAnalysisSummary): AIAssessmentResult {
  const {
    hasReadme = false,
    hasContributing = false,
    hasAgents = false,
    hasLicense = false,
    hasWorkflows = false,
    hasTests = false,
    errorHandling = false,
    languages = []
  } = staticAnalysis

  // Calculate basic scores
  let documentationScore = 0
  if (hasReadme) documentationScore += 8
  if (hasContributing) documentationScore += 4
  if (hasAgents) documentationScore += 4
  if (hasLicense) documentationScore += 4

  let instructionClarityScore = hasReadme ? 12 : 0
  if (hasContributing) instructionClarityScore += 4
  if (hasAgents) instructionClarityScore += 4

  let workflowAutomationScore = hasWorkflows ? 15 : 0
  if (hasTests) workflowAutomationScore += 5

  let riskComplianceScore = hasLicense ? 5 : 0
  if (errorHandling) riskComplianceScore += 10
  if (hasTests) riskComplianceScore += 5

  let integrationStructureScore = 10
  if (languages.length > 0) integrationStructureScore += 5
  if (hasTests) integrationStructureScore += 5

  const totalScore = documentationScore + instructionClarityScore + workflowAutomationScore + riskComplianceScore + integrationStructureScore

  const findings: string[] = []
  const recommendations: string[] = []

  if (!hasReadme) {
    findings.push('No README.md file found')
    recommendations.push('Create a comprehensive README.md with setup instructions and usage examples')
  }

  if (!hasContributing) {
    findings.push('No CONTRIBUTING.md file found')
    recommendations.push('Add CONTRIBUTING.md to guide contributors and AI agents')
  }

  if (!hasAgents) {
    findings.push('No AGENTS.md file found')
    recommendations.push('Create AGENTS.md specifically for AI agent interaction guidelines')
  }

  if (!hasLicense) {
    findings.push('No LICENSE file found')
    recommendations.push('Add a LICENSE file to clarify usage rights')
  }

  if (!hasWorkflows) {
    findings.push('No CI/CD workflows detected')
    recommendations.push('Set up GitHub Actions for automated testing and deployment')
  }

  if (!hasTests) {
    findings.push('No test files detected')
    recommendations.push('Add comprehensive test suite for better reliability')
  }

  if (!errorHandling) {
    findings.push('Limited error handling detected')
    recommendations.push('Implement proper error handling and logging throughout the codebase')
  }

  return {
    readinessScore: Math.min(totalScore, 100),
    categories: {
      documentation: Math.min(documentationScore, 20),
      instructionClarity: Math.min(instructionClarityScore, 20),
      workflowAutomation: Math.min(workflowAutomationScore, 20),
      riskCompliance: Math.min(riskComplianceScore, 20),
      integrationStructure: Math.min(integrationStructureScore, 20),
    },
    findings,
    recommendations,
  }
}