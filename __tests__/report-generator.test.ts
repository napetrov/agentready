// Report generator tests
describe('Report Generator', () => {
  test('should generate PDF with valid assessment data', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const mockAssessment = {
      readinessScore: 85,
      categories: {
        documentation: 18,
        instructionClarity: 16,
        workflowAutomation: 17,
        riskCompliance: 15,
        integrationStructure: 19
      },
      findings: [
        'Well-documented project with comprehensive README',
        'Good CI/CD setup with multiple workflows',
        'Comprehensive test coverage detected'
      ],
      recommendations: [
        'Add AGENTS.md for AI agent interaction guidelines',
        'Consider adding more detailed API documentation',
        'Implement automated security scanning'
      ],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['TypeScript', 'JavaScript'],
        errorHandling: true
      }
    }
    
    const pdfBuffer = await generatePDFReport(mockAssessment)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
  })

  test('should handle minimal assessment data', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const minimalAssessment = {
      readinessScore: 0,
      categories: {
        documentation: 0,
        instructionClarity: 0,
        workflowAutomation: 0,
        riskCompliance: 0,
        integrationStructure: 0
      },
      findings: [],
      recommendations: [],
      staticAnalysis: {
        hasReadme: false,
        hasContributing: false,
        hasAgents: false,
        hasLicense: false,
        hasWorkflows: false,
        hasTests: false,
        languages: [],
        errorHandling: false
      }
    }
    
    const pdfBuffer = await generatePDFReport(minimalAssessment)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
  })

  test('should handle malformed assessment data', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const malformedAssessment = {
      readinessScore: null,
      categories: null,
      findings: undefined,
      recommendations: null,
      staticAnalysis: {}
    }
    
    // Should not throw and should generate a basic PDF
    const pdfBuffer = await generatePDFReport(malformedAssessment)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
  })

  test('should handle very long findings and recommendations', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const longAssessment = {
      readinessScore: 50,
      categories: {
        documentation: 10,
        instructionClarity: 10,
        workflowAutomation: 10,
        riskCompliance: 10,
        integrationStructure: 10
      },
      findings: Array(100).fill('This is a very long finding that should be handled properly by the PDF generator and should not cause any issues with the layout or formatting of the generated PDF document'),
      recommendations: Array(100).fill('This is a very long recommendation that should be handled properly by the PDF generator and should not cause any issues with the layout or formatting of the generated PDF document'),
      staticAnalysis: {
        hasReadme: true,
        hasContributing: false,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: false,
        hasTests: false,
        languages: ['JavaScript'],
        errorHandling: false
      }
    }
    
    const pdfBuffer = await generatePDFReport(longAssessment)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
  })

  test('should handle special characters in text', async () => {
    const { generatePDFReport } = require('../lib/report-generator')
    
    const specialCharAssessment = {
      readinessScore: 75,
      categories: {
        documentation: 15,
        instructionClarity: 15,
        workflowAutomation: 15,
        riskCompliance: 15,
        integrationStructure: 15
      },
      findings: [
        'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        'Unicode: 你好世界 🌍 émojis 🚀',
        'HTML entities: &lt; &gt; &amp; &quot; &#39;'
      ],
      recommendations: [
        'Fix encoding issues with special characters',
        'Handle unicode properly in documentation'
      ],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['TypeScript', 'JavaScript'],
        errorHandling: true
      }
    }
    
    const pdfBuffer = await generatePDFReport(specialCharAssessment)
    
    expect(pdfBuffer).toBeDefined()
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
  })
})