/**
 * API Error Handling Tests
 * 
 * Tests for error handling in the API routes
 */

import { NextRequest } from 'next/server'
import { POST } from '../app/api/analyze/route'

// Mock the UnifiedAssessmentEngine
jest.mock('../lib/unified-assessment-engine', () => ({
  UnifiedAssessmentEngine: jest.fn().mockImplementation(() => ({
    assess: jest.fn(),
    convertToLegacyFormat: jest.fn()
  }))
}))

// Mock the plugin registry
jest.mock('../lib/plugin-registry', () => ({
  registerDefaultPlugins: jest.fn()
}))

describe('API Error Handling', () => {
  let mockAssessmentEngine: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset the mock implementation
    const { UnifiedAssessmentEngine } = require('../lib/unified-assessment-engine')
    mockAssessmentEngine = {
      assess: jest.fn(),
      convertToLegacyFormat: jest.fn()
    }
    UnifiedAssessmentEngine.mockImplementation(() => mockAssessmentEngine)
  })

  describe('Input Validation Errors', () => {
    test('should return 400 for missing URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ inputType: 'repository' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('URL is required')
    })

    test('should return 400 for invalid inputType', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/user/repo',
          inputType: 'invalid'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid inputType. Must be either "repository" or "website"')
    })

    test('should return 400 for invalid URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'not-a-url',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please provide a valid URL')
    })

    test('should return 400 for invalid GitHub URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://gitlab.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please provide a valid GitHub repository URL')
    })
  })

  describe('Analysis Errors', () => {
    test('should return 408 for timeout errors', async () => {
      mockAssessmentEngine.assess.mockRejectedValueOnce(new Error('Analysis timeout'))

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(408)
      expect(data.error).toBe('Analysis timed out. The repository may be too large. Please try a smaller repository.')
    })

    test('should return 404 for repository not found errors', async () => {
      mockAssessmentEngine.assess.mockRejectedValueOnce(new Error('Repository not found or is private'))

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/nonexistent/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Failed to access the repository. It may be private or the URL may be incorrect.')
    })

    test('should return 413 for repository too large errors', async () => {
      mockAssessmentEngine.assess.mockRejectedValueOnce(new Error('Repository too large'))

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/large/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.error).toBe('Repository is too large to analyze. Please try a smaller repository.')
    })

    test('should return 429 for rate limit errors', async () => {
      mockAssessmentEngine.assess.mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toBe('Rate limit exceeded - please try again later')
    })

    test('should return 500 for generic errors', async () => {
      mockAssessmentEngine.assess.mockRejectedValueOnce(new Error('Unexpected error'))

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to analyze source')
    })
  })

  describe('Successful Analysis', () => {
    test('should return successful analysis result', async () => {
      const mockResult = {
        scores: {
          overall: { value: 85, maxValue: 100, percentage: 85, confidence: 0.8 },
          categories: {
            documentation: { value: 80, maxValue: 100, percentage: 80, confidence: 0.8 },
            instructionClarity: { value: 90, maxValue: 100, percentage: 90, confidence: 0.9 }
          },
          confidence: {
            overall: 0.8,
            staticAnalysis: 0.8,
            aiAssessment: 0.8
          }
        },
        analysis: {
          repository: {
            hasReadme: true,
            hasContributing: true,
            hasAgents: false,
            hasLicense: true,
            hasWorkflows: true,
            hasTests: false,
            languages: ['TypeScript', 'JavaScript'],
            errorHandling: true,
            fileCount: 150,
            linesOfCode: 5000,
            repositorySizeMB: 2.5
          }
        },
        findings: [
          { description: 'Good documentation', category: 'documentation', severity: 'info' }
        ],
        recommendations: [
          { description: 'Add more tests', category: 'testing', priority: 'medium' }
        ],
        metadata: {
          duration: 1000,
          timestamp: new Date(),
          version: '1.0.0'
        }
      }

      const mockLegacyResult = {
        readinessScore: 85,
        categories: {
          documentation: 80,
          instructionClarity: 90,
          workflowAutomation: 70,
          riskCompliance: 75,
          integrationStructure: 80,
          fileSizeOptimization: 85
        },
        findings: ['Good documentation'],
        recommendations: ['Add more tests'],
        staticAnalysis: {
          hasReadme: true,
          hasContributing: true,
          hasAgents: false,
          hasLicense: true,
          hasWorkflows: true,
          hasTests: false,
          languages: ['TypeScript', 'JavaScript'],
          errorHandling: true,
          fileCount: 150,
          linesOfCode: 5000,
          repositorySizeMB: 2.5
        },
        websiteAnalysis: null
      }

      mockAssessmentEngine.assess.mockResolvedValueOnce(mockResult)
      mockAssessmentEngine.convertToLegacyFormat.mockReturnValueOnce(mockLegacyResult)

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ 
          inputUrl: 'https://github.com/user/repo',
          inputType: 'repository'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.readinessScore).toBe(85)
      expect(data.staticAnalysis).toBeDefined()
      expect(data.websiteAnalysis).toBeNull()
    })
  })
})