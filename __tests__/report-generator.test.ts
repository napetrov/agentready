import { generatePDFReport } from '../lib/report-generator'

// Mock TextEncoder for jsPDF
global.TextEncoder = global.TextEncoder || class TextEncoder {
  encode(input: string) {
    return Buffer.from(input, 'utf8')
  }
}

global.TextDecoder = global.TextDecoder || class TextDecoder {
  decode(input: Buffer) {
    return Buffer.from(input).toString('utf8')
  }
}

describe('generatePDFReport', () => {
  test('should generate PDF with minimal data', async () => {
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
        fileCount: 10,
        linesOfCode: 500,
        repositorySizeMB: 1.2
      }
    }

    const pdfBuffer = await generatePDFReport(minimalData)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should generate PDF with repository URL', async () => {
    const data = {
      readinessScore: 75,
      categories: {
        documentation: 15,
        instructionClarity: 15,
        workflowAutomation: 15,
        riskCompliance: 15,
        integrationStructure: 15,
        fileSizeOptimization: 15
      },
      findings: ['Good documentation'],
      recommendations: ['Add more tests'],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        errorHandling: true,
        fileCount: 50,
        linesOfCode: 2000,
        repositorySizeMB: 3.5,
        languages: ['TypeScript', 'JavaScript']
      }
    }

    const pdfBuffer = await generatePDFReport(data, 'https://github.com/user/repo')

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should generate PDF with file size analysis', async () => {
    const data = {
      readinessScore: 80,
      categories: {
        documentation: 16,
        instructionClarity: 16,
        workflowAutomation: 16,
        riskCompliance: 16,
        integrationStructure: 16,
        fileSizeOptimization: 16
      },
      findings: ['Good file size optimization'],
      recommendations: ['Continue current practices'],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: true,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        errorHandling: true,
        fileCount: 100,
        linesOfCode: 5000,
        repositorySizeMB: 8.2,
        languages: ['TypeScript', 'JavaScript', 'CSS'],
        fileSizeAnalysis: {
          totalFiles: 100,
          filesBySize: {
            under100KB: 80,
            under500KB: 90,
            under1MB: 95,
            under5MB: 100,
            over5MB: 0
          },
          largeFiles: [
            {
              path: 'large-file.js',
              size: 3 * 1024 * 1024,
              sizeFormatted: '3.00 MB',
              type: 'code',
              agentImpact: {
                cursor: 'blocked',
                githubCopilot: 'blocked',
                claudeWeb: 'limited',
                claudeApi: 'supported'
              },
              recommendation: 'Consider splitting this file'
            }
          ],
          criticalFiles: [
            {
              path: 'README.md',
              size: 500 * 1024,
              sizeFormatted: '500.00 KB',
              type: 'readme',
              isOptimal: true,
              agentImpact: {
                cursor: 'optimal',
                githubCopilot: 'optimal',
                claudeWeb: 'optimal'
              },
              recommendation: 'File size is optimal'
            }
          ],
          contextConsumption: {
            instructionFiles: {
              agentsMd: { size: 200 * 1024, lines: 50, estimatedTokens: 500 },
              readme: { size: 500 * 1024, lines: 100, estimatedTokens: 1000 },
              contributing: { size: 300 * 1024, lines: 75, estimatedTokens: 750 }
            },
            totalContextFiles: 20,
            averageContextFileSize: 250 * 1024,
            contextEfficiency: 'good',
            recommendations: ['Keep current file sizes']
          },
          agentCompatibility: {
            cursor: 85,
            githubCopilot: 80,
            claudeWeb: 90,
            claudeApi: 95,
            overall: 87
          },
          recommendations: ['Overall good file size optimization']
        }
      }
    }

    const pdfBuffer = await generatePDFReport(data)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should handle missing file size analysis', async () => {
    const data = {
      readinessScore: 60,
      categories: {
        documentation: 12,
        instructionClarity: 12,
        workflowAutomation: 12,
        riskCompliance: 12,
        integrationStructure: 12,
        fileSizeOptimization: 12
      },
      findings: ['Missing file size analysis'],
      recommendations: ['Add file size analysis'],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: false,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: false,
        hasTests: false,
        errorHandling: false,
        fileCount: 25,
        linesOfCode: 800,
        repositorySizeMB: 1.8
      }
    }

    const pdfBuffer = await generatePDFReport(data)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should handle empty findings and recommendations', async () => {
    const data = {
      readinessScore: 100,
      categories: {
        documentation: 20,
        instructionClarity: 20,
        workflowAutomation: 20,
        riskCompliance: 20,
        integrationStructure: 20,
        fileSizeOptimization: 20
      },
      findings: [],
      recommendations: [],
      staticAnalysis: {
        hasReadme: true,
        hasContributing: true,
        hasAgents: true,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        errorHandling: true,
        fileCount: 100,
        linesOfCode: 3000,
        repositorySizeMB: 5.5
      }
    }

    const pdfBuffer = await generatePDFReport(data)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should handle undefined static analysis', async () => {
    const data = {
      readinessScore: 30,
      categories: {
        documentation: 6,
        instructionClarity: 6,
        workflowAutomation: 6,
        riskCompliance: 6,
        integrationStructure: 6,
        fileSizeOptimization: 6
      },
      findings: ['Poor documentation'],
      recommendations: ['Improve documentation']
    }

    const pdfBuffer = await generatePDFReport(data)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })

  test('should handle large number of findings and recommendations', async () => {
    const data = {
      readinessScore: 40,
      categories: {
        documentation: 8,
        instructionClarity: 8,
        workflowAutomation: 8,
        riskCompliance: 8,
        integrationStructure: 8,
        fileSizeOptimization: 8
      },
      findings: Array.from({ length: 20 }, (_, i) => `Finding ${i + 1}`),
      recommendations: Array.from({ length: 20 }, (_, i) => `Recommendation ${i + 1}`),
      staticAnalysis: {
        hasReadme: false,
        hasContributing: false,
        hasAgents: false,
        hasLicense: false,
        hasWorkflows: false,
        hasTests: false,
        errorHandling: false,
        fileCount: 5,
        linesOfCode: 200,
        repositorySizeMB: 0.3
      }
    }

    const pdfBuffer = await generatePDFReport(data)

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF')
  })
})