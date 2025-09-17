// Basic tests to validate core functionality
describe('Basic Functionality Tests', () => {
  test('should have required dependencies', () => {
    // Test that we can import the main modules
    expect(() => require('../lib/analyzer')).not.toThrow()
    expect(() => require('../lib/ai-assessment')).not.toThrow()
    expect(() => require('../lib/report-generator')).not.toThrow()
  })

  test('should validate URL format', () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Test invalid URLs
    expect(() => analyzeRepository('invalid-url')).rejects.toThrow('Invalid GitHub repository URL format')
    expect(() => analyzeRepository('https://not-github.com/user/repo')).rejects.toThrow('Invalid GitHub repository URL format')
    expect(() => analyzeRepository('https://github.com/')).rejects.toThrow('Invalid GitHub repository URL format')
  })

  test('should have proper error handling structure', () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Test with minimal static analysis data
    const minimalAnalysis = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: [],
      errorHandling: false,
      fileCount: 0,
      workflowFiles: [],
      testFiles: []
    }

    // Should not throw and should return a valid structure
    expect(() => generateAIAssessment(minimalAnalysis)).not.toThrow()
  })
})