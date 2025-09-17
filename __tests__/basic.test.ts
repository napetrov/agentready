// Basic tests to validate core functionality
describe('Basic Functionality Tests', () => {
  test('should have required dependencies', () => {
    // Test that we can import the main modules
    expect(() => require('../lib/analyzer')).not.toThrow()
    expect(() => require('../lib/ai-assessment')).not.toThrow()
    expect(() => require('../lib/report-generator')).not.toThrow()
  })

  test('should validate URL format', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Test invalid URLs
    await expect(analyzeRepository('invalid-url')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://not-github.com/user/repo')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://github.com/')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://github.com')).rejects.toThrow('Invalid GitHub repository URL format')
  })

  test('should handle valid URL formats', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Mock axios to prevent actual network calls
    const mockAxios = require('axios')
    mockAxios.get = jest.fn().mockRejectedValue(new Error('Network error'))
    
    // These should not throw URL validation errors (but may throw network errors)
    await expect(analyzeRepository('https://github.com/user/repo')).rejects.toThrow('Network error')
    await expect(analyzeRepository('https://github.com/user/repo/')).rejects.toThrow('Network error')
  })

  test('should have proper error handling structure', async () => {
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
    const result = await generateAIAssessment(minimalAnalysis)
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeDefined()
    expect(result.categories).toBeDefined()
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  test('should handle malformed static analysis data', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Test with undefined/null values
    const malformedAnalysis = {
      hasReadme: undefined,
      hasContributing: null,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: undefined,
      errorHandling: false,
      fileCount: 0,
      workflowFiles: null,
      testFiles: []
    }

    // Should handle gracefully
    const result = await generateAIAssessment(malformedAnalysis)
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
  })

  test('should validate environment variables', () => {
    // Test that environment variables are properly set for testing
    expect(process.env.OPENAI_API_KEY).toBeDefined()
    expect(process.env.GITHUB_TOKEN).toBeDefined()
  })

  test('should have proper TypeScript types', () => {
    // Test that interfaces are properly defined
    const { analyzeRepository } = require('../lib/analyzer')
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    expect(typeof analyzeRepository).toBe('function')
    expect(typeof generateAIAssessment).toBe('function')
  })
})