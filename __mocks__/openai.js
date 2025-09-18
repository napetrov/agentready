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
    mockResponse = {
      stepByStepQuality: 4,
      commandClarity: 4,
      environmentSetup: 3,
      errorHandling: 4,
      dependencySpecification: 3,
      findings: ['Instructions are clear and well-structured'],
      recommendations: ['Consider adding more detailed examples'],
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
  } else if (allMessages.includes('risk compliance')) {
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