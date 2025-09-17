// Simple tests that focus on basic functionality
describe('Simple Functionality Tests', () => {
  test('should import all modules without errors', () => {
    expect(() => require('../lib/analyzer')).not.toThrow()
    expect(() => require('../lib/ai-assessment')).not.toThrow()
    expect(() => require('../lib/report-generator')).not.toThrow()
  })

  test('should validate URL format correctly', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Test invalid URLs
    await expect(analyzeRepository('invalid-url')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://not-github.com/user/repo')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('https://github.com/')).rejects.toThrow('Invalid GitHub repository URL format')
    await expect(analyzeRepository('')).rejects.toThrow('Invalid GitHub repository URL format')
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

  test('should handle fallback assessment with valid data', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    const validAnalysis = {
      hasReadme: true,
      hasContributing: true,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['TypeScript', 'JavaScript'],
      errorHandling: true,
      fileCount: 50,
      workflowFiles: ['ci.yml', 'deploy.yml'],
      testFiles: ['test.js', 'spec.ts'],
      readmeContent: 'Test README content',
      contributingContent: 'Test CONTRIBUTING content',
      agentsContent: 'Test AGENTS content'
    }
    
    const result = await generateAIAssessment(validAnalysis)
    
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
    expect(Array.isArray(result.findings)).toBe(true)
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  test('should generate PDF with comprehensive data', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const comprehensiveData = {
      readinessScore: 95,
      categories: {
        documentation: 20,
        instructionClarity: 19,
        workflowAutomation: 18,
        riskCompliance: 19,
        integrationStructure: 19
      },
      findings: [
        'Excellent documentation with comprehensive README',
        'Well-structured CI/CD pipeline',
        'Comprehensive test coverage',
        'Good error handling patterns'
      ],
      recommendations: [
        'Consider adding AGENTS.md for AI interaction guidelines',
        'Add more detailed API documentation',
        'Implement automated security scanning'
      ],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['TypeScript', 'JavaScript', 'CSS'],
        errorHandling: true,
        fileCount: 100,
        workflowFiles: ['ci.yml', 'deploy.yml', 'test.yml'],
        testFiles: ['test.js', 'spec.ts', 'e2e.test.js']
      }
    }
    
    const pdfBuffer = await generatePDFReport(comprehensiveData)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
  })

  test('should handle edge cases in fallback assessment', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Test with extreme values
    const edgeCaseAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: true,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: ['Python', 'Go', 'Rust', 'C++', 'Java'],
      errorHandling: false,
      fileCount: 1000,
      workflowFiles: [],
      testFiles: [],
      readmeContent: 'A'.repeat(5000), // Very long content
      contributingContent: '',
      agentsContent: 'Short content'
    }
    
    const result = await generateAIAssessment(edgeCaseAnalysis)
    
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories)).toHaveLength(5)
  })
})