// Simple tests that focus on basic functionality
describe('Simple Functionality Tests', () => {
  test('should import all modules without errors', () => {
    expect(() => require('../lib/analyzer')).not.toThrow()
    expect(() => require('../lib/ai-assessment')).not.toThrow()
    expect(() => require('../lib/report-generator')).not.toThrow()
  })

  test('should validate URL format correctly', () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Test invalid URLs
    expect(() => analyzeRepository('invalid-url')).rejects.toThrow('Invalid GitHub repository URL format')
    expect(() => analyzeRepository('https://not-github.com/user/repo')).rejects.toThrow('Invalid GitHub repository URL format')
    expect(() => analyzeRepository('https://github.com/')).rejects.toThrow('Invalid GitHub repository URL format')
    expect(() => analyzeRepository('')).rejects.toThrow('Invalid GitHub repository URL format')
  })

  test('should handle fallback assessment with missing data', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Test with completely missing data
    const emptyAnalysis = {}
    
    const result = await generateAIAssessment(emptyAnalysis)
    
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
  })

  test('should generate PDF with minimal data', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const minimalData = {
      readinessScore: 50,
      categories: {
        documentation: 10,
        instructionClarity: 10,
        workflowAutomation: 10,
        riskCompliance: 10,
        integrationStructure: 10
      },
      findings: ['Test finding'],
      recommendations: ['Test recommendation'],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: false,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: false,
        hasTests: false,
        errorHandling: false
      }
    }
    
    const pdfBuffer = await generatePDFReport(minimalData)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
  })

  test('should handle environment variables', () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined()
    expect(process.env.GITHUB_TOKEN).toBeDefined()
  })

  test('should have proper function signatures', () => {
    const { analyzeRepository } = require('../lib/analyzer')
    const { generateAIAssessment } = require('../lib/ai-assessment')
    const { generatePDFReport } = require('../lib/report-generator')
    
    expect(typeof analyzeRepository).toBe('function')
    expect(typeof generateAIAssessment).toBe('function')
    expect(typeof generatePDFReport).toBe('function')
  })
})