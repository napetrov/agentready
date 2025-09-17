// Error handling tests
describe('Error Handling', () => {
  test('should handle network timeouts gracefully', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    // Mock axios to simulate timeout
    const mockAxios = require('axios')
    mockAxios.get = jest.fn().mockRejectedValue({
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded'
    })
    
    await expect(analyzeRepository('https://github.com/user/repo')).rejects.toThrow('timeout')
  })

  test('should handle 404 errors with proper fallback', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    const mockAxios = require('axios')
    mockAxios.get = jest.fn()
      .mockRejectedValueOnce({ response: { status: 404 } }) // main branch fails
      .mockRejectedValueOnce({ response: { status: 404 } }) // master branch also fails
    
    await expect(analyzeRepository('https://github.com/nonexistent/repo')).rejects.toThrow(
      'Repository not found. Tried both \'main\' and \'master\' branches'
    )
  })

  test('should handle OpenAI API errors gracefully', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Mock OpenAI to throw error
    const mockOpenAI = require('openai')
    mockOpenAI.default = jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }
    }))
    
    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: []
    }
    
    // Should fallback to static analysis
    const result = await generateAIAssessment(staticAnalysis)
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThan(0)
  })

  test('should handle malformed JSON responses from OpenAI', async () => {
    const { generateAIAssessment } = require('../lib/ai-assessment')
    
    // Mock OpenAI to return invalid JSON
    const mockOpenAI = require('openai')
    mockOpenAI.default = jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'This is not valid JSON'
              }
            }]
          })
        }
      }
    }))
    
    const staticAnalysis = {
      hasReadme: true,
      hasContributing: false,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 10,
      workflowFiles: [],
      testFiles: []
    }
    
    // Should fallback to static analysis
    const result = await generateAIAssessment(staticAnalysis)
    expect(result).toBeDefined()
    expect(typeof result.readinessScore).toBe('number')
  })

  test('should handle empty repository responses', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    const mockAxios = require('axios')
    mockAxios.get = jest.fn().mockResolvedValue({
      data: Buffer.from('mock zip data'),
      status: 200
    })
    
    const mockJSZip = require('jszip')
    mockJSZip.mockImplementation(() => ({
      loadAsync: jest.fn().mockResolvedValue({
        files: {} // Empty repository
      })
    }))
    
    const result = await analyzeRepository('https://github.com/user/empty-repo')
    
    expect(result).toBeDefined()
    expect(result.hasReadme).toBe(false)
    expect(result.hasContributing).toBe(false)
    expect(result.fileCount).toBe(0)
  })

  test('should handle corrupted ZIP files', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    const mockAxios = require('axios')
    mockAxios.get = jest.fn().mockResolvedValue({
      data: Buffer.from('corrupted zip data'),
      status: 200
    })
    
    const mockJSZip = require('jszip')
    mockJSZip.mockImplementation(() => ({
      loadAsync: jest.fn().mockRejectedValue(new Error('Invalid ZIP file'))
    }))
    
    await expect(analyzeRepository('https://github.com/user/corrupted-repo')).rejects.toThrow('Invalid ZIP file')
  })

  test('should handle memory errors gracefully', async () => {
    const { analyzeRepository } = require('../lib/analyzer')
    
    const mockAxios = require('axios')
    mockAxios.get = jest.fn().mockResolvedValue({
      data: Buffer.from('mock zip data'),
      status: 200
    })
    
    const mockJSZip = require('jszip')
    mockJSZip.mockImplementation(() => ({
      loadAsync: jest.fn().mockResolvedValue({
        files: {
          'repo-main/huge-file.txt': {
            async: jest.fn().mockRejectedValue(new Error('Out of memory'))
          }
        }
      })
    }))
    
    // Should handle memory errors gracefully
    const result = await analyzeRepository('https://github.com/user/huge-repo')
    expect(result).toBeDefined()
  })
})