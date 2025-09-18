const mockCreate = jest.fn().mockImplementation((params) => {
  const mockMode = process.env.MOCK_OPENAI_MODE || 'normal'
  
  // Handle error mode
  if (mockMode === 'error') {
    throw new Error('API error')
  }
  
  // Handle malformed mode
  if (mockMode === 'malformed') {
    return Promise.resolve({
      choices: [{
        message: {
          content: 'invalid json response'
        }
      }]
    })
  }
  
  // Normal mode - concatenate all messages and convert to lowercase for matching
  const allMessages = params.messages.map((m) => m.content).join(' ').toLowerCase()
  let mockResponse = {}
  
  if (allMessages.includes('instruction clarity')) {
    // Check if this is a minimal repository (no README, no documentation)
    const isMinimalRepo = allMessages.includes('has readme: false') || 
                         allMessages.includes('has agents: false') ||
                         allMessages.includes('has contributing: false')
    
    mockResponse = {
      stepByStepQuality: 4,
      commandClarity: 4,
      environmentSetup: 3,
      errorHandling: 4,
      dependencySpecification: 3,
      findings: ['Instructions are clear and well-structured'],
      recommendations: isMinimalRepo ? 
        ['Add a comprehensive README file', 'Create documentation for setup and usage'] : 
        ['Consider adding more detailed examples'],
      confidence: 85
    }
  } else if (allMessages.includes('workflow automation')) {
    mockResponse = {
      ciCdQuality: 4,
      testAutomation: 4,
      buildScripts: 3,
      deploymentAutomation: 3,
      monitoringLogging: 2,
      findings: ['Good CI/CD setup detected'],
      recommendations: ['Add more comprehensive monitoring'],
      confidence: 80
    }
  } else if (allMessages.includes('context efficiency')) {
    mockResponse = {
      instructionFileOptimization: 4,
      codeDocumentation: 4,
      apiDocumentation: 3,
      contextWindowUsage: 4,
      findings: ['Context usage is efficient'],
      recommendations: ['Consider optimizing large files'],
      confidence: 75
    }
  } else if (allMessages.includes('risk & compliance analysis')) {
    mockResponse = {
      securityPractices: 4,
      errorHandling: 4,
      inputValidation: 3,
      dependencySecurity: 3,
      licenseCompliance: 4,
      findings: ['Good security practices'],
      recommendations: ['Enhance input validation'],
      confidence: 82
    }
  } else if (allMessages.includes('expert ai agent readiness assessor')) {
    // Response for the old generateAIAssessment function
    mockResponse = {
      readinessScore: 75,
      categories: {
        documentation: 15,
        instructionClarity: 12,
        workflowAutomation: 14,
        riskCompliance: 13,
        integrationStructure: 11,
        fileSizeOptimization: 10
      },
      findings: ['Repository has good documentation structure', 'CI/CD workflows are well configured'],
      recommendations: ['Add more detailed API documentation', 'Consider improving error handling patterns']
    }
  } else {
    // Default response for other prompts
    mockResponse = {
      score: 4,
      findings: ['Assessment completed'],
      recommendations: ['Continue current practices'],
      confidence: 70
    }
  }
  
  return Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify(mockResponse)
      }
    }]
  })
})

const MockOpenAI = jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate
    }
  }
}))

module.exports = MockOpenAI
module.exports.default = MockOpenAI
module.exports.OpenAI = MockOpenAI