// API endpoint tests
describe('API Endpoints', () => {
  // Mock the Next.js request/response objects
  const createMockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body)
  })

  const createMockResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    return res
  }

  test('should handle analyze endpoint with valid data', async () => {
    const { POST } = require('../app/api/analyze/route')
    
    const mockRequest = createMockRequest({
      repoUrl: 'https://github.com/vercel/next.js'
    })
    
    const mockResponse = createMockResponse()
    
    // Mock the analyzer to prevent actual network calls
    jest.doMock('../lib/analyzer', () => ({
      analyzeRepository: jest.fn().mockResolvedValue({
        hasReadme: true,
        hasContributing: true,
        hasAgents: false,
        hasLicense: true,
        hasWorkflows: true,
        hasTests: true,
        languages: ['TypeScript', 'JavaScript'],
        errorHandling: true,
        fileCount: 100,
        workflowFiles: ['ci.yml'],
        testFiles: ['test.js']
      })
    }))
    
    jest.doMock('../lib/ai-assessment', () => ({
      generateAIAssessment: jest.fn().mockResolvedValue({
        readinessScore: 85,
        categories: {
          documentation: 18,
          instructionClarity: 16,
          workflowAutomation: 17,
          riskCompliance: 15,
          integrationStructure: 19
        },
        findings: ['Well documented'],
        recommendations: ['Add AGENTS.md']
      })
    }))
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        readinessScore: 85,
        categories: expect.any(Object),
        findings: expect.any(Array),
        recommendations: expect.any(Array),
        staticAnalysis: expect.any(Object)
      })
    )
  })

  test('should handle analyze endpoint with missing repoUrl', async () => {
    const { POST } = require('../app/api/analyze/route')
    
    const mockRequest = createMockRequest({})
    const mockResponse = createMockResponse()
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Repository URL is required'
    })
  })

  test('should handle analyze endpoint with invalid URL', async () => {
    const { POST } = require('../app/api/analyze/route')
    
    const mockRequest = createMockRequest({
      repoUrl: 'invalid-url'
    })
    const mockResponse = createMockResponse()
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Please provide a valid GitHub repository URL'
    })
  })

  test('should handle analyze endpoint with network error', async () => {
    const { POST } = require('../app/api/analyze/route')
    
    const mockRequest = createMockRequest({
      repoUrl: 'https://github.com/vercel/next.js'
    })
    const mockResponse = createMockResponse()
    
    // Mock analyzer to throw error
    jest.doMock('../lib/analyzer', () => ({
      analyzeRepository: jest.fn().mockRejectedValue(new Error('Network error'))
    }))
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Failed to analyze repository'
    })
  })

  test('should handle report endpoint with valid data', async () => {
    const { POST } = require('../app/api/report/route')
    
    const mockRequest = createMockRequest({
      result: {
        readinessScore: 85,
        categories: { documentation: 18 },
        findings: ['Test finding'],
        recommendations: ['Test recommendation']
      }
    })
    const mockResponse = createMockResponse()
    
    // Mock report generator
    jest.doMock('../lib/report-generator', () => ({
      generatePDFReport: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
    }))
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(200)
  })

  test('should handle report endpoint with missing result', async () => {
    const { POST } = require('../app/api/report/route')
    
    const mockRequest = createMockRequest({})
    const mockResponse = createMockResponse()
    
    await POST(mockRequest, mockResponse)
    
    expect(mockResponse.status).toHaveBeenCalledWith(400)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Assessment result is required'
    })
  })
})