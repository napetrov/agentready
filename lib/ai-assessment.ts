import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
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
      // GPT-5-nano only supports default temperature (1), so we omit the temperature parameter
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
    
    if (!Array.isArray(assessment.recommendations)) {
      throw new Error('Invalid recommendations: must be an array')
    }

    return assessment
  } catch (error) {
    console.error('AI Assessment error:', error)
    
    // Fallback assessment based on static analysis
    return generateFallbackAssessment(staticAnalysis)
  }
}

function createAssessmentPrompt(staticAnalysis: any): string {
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

  prompt += `\n\nWorkflow Files: ${(workflowFiles || []).join(', ')}`
  prompt += `\n\nTest Files: ${(testFiles || []).slice(0, 10).join(', ')}${(testFiles || []).length > 10 ? '...' : ''}`

  return prompt
}

function generateFallbackAssessment(staticAnalysis: any): AIAssessmentResult {
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

  const findings = []
  const recommendations = []

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