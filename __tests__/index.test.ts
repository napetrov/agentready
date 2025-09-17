// Simple tests that focus on basic functionality
describe('Simple Functionality Tests', () => {
  // Helper function to validate PDF buffer
  function expectPdf(buf: Buffer) {
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  }
  test('should import all modules without errors', async () => {
    await expect(import('../lib/analyzer')).resolves.toBeDefined()
    await expect(import('../lib/ai-assessment')).resolves.toBeDefined()
    await expect(import('../lib/report-generator')).resolves.toBeDefined()
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
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    
    // Test with completely missing data
    const emptyAnalysis = {}
    
    let result
    try {
      result = await generateAIAssessment(emptyAnalysis)
    } finally {
      if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
    }
    
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
        integrationStructure: 10,
        fileSizeOptimization: 10
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
        errorHandling: false,
        fileCount: 10
      }
    }
    
    const pdfBuffer = await generatePDFReport(minimalData)
    
    expectPdf(pdfBuffer)
  })

  test('should handle environment variables', () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined()
    expect(process.env.GITHUB_TOKEN).toBeDefined()
  })

  test('should have proper function signatures', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    const { generateAIAssessment } = require('../lib/ai-assessment')
    const { generatePDFReport } = require('../lib/report-generator')
    
    expect(typeof analyzeRepository).toBe('function')
    expect(typeof generateAIAssessment).toBe('function')
    expect(typeof generatePDFReport).toBe('function')
    
    // Promise-like checks (no network)
    const p1 = analyzeRepository('') // will reject but is Promise-like
    expect(typeof p1?.then).toBe('function')
    const p2 = generatePDFReport({} as any) // type-erased at runtime
    expect(typeof p2?.then).toBe('function')
    
    // Verify the Promise rejects as expected
    await expect(p1).rejects.toThrow('Invalid GitHub repository URL format')
  })

  test('should handle fallback assessment with valid data', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    
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
    
    let result
    try {
      result = await generateAIAssessment(validAnalysis)
    } finally {
      if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
    }
    
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
        integrationStructure: 19,
        fileSizeOptimization: 18
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
    
    expectPdf(pdfBuffer)
  })

  test('should handle edge cases in fallback assessment', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    const originalKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    
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
    
    let result
    try {
      result = await generateAIAssessment(edgeCaseAnalysis)
    } finally {
      if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey
    }
    
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    expect(result.categories).toBeDefined()
    expect(Object.keys(result.categories)).toHaveLength(6)
  })
})