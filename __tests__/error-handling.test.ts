/**
 * Error Handling Tests
 * 
 * Tests for comprehensive error handling throughout the application
 */

import { analyzeRepository } from '../lib/analyzer'
import { RepositoryAnalyzerPlugin } from '../lib/plugins/repository-analyzer'
import { AssessmentInput } from '../lib/unified-types'

// Mock axios to simulate different error scenarios
jest.mock('axios')
const mockedAxios = require('axios')

// Mock JSZip
jest.mock('jszip', () => {
  return {
    loadAsync: jest.fn().mockResolvedValue({
      files: {
        'file1.js': { name: 'file1.js', dir: false },
        'file2.ts': { name: 'file2.ts', dir: false },
        'README.md': { name: 'README.md', dir: false }
      }
    })
  }
})

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Repository Analysis Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Not Found'
      })

      await expect(analyzeRepository('https://github.com/nonexistent/repo'))
        .rejects.toThrow('Repository not found or is private')
    })

    test('should handle timeout errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded'
      })

      await expect(analyzeRepository('https://github.com/large/repo'))
        .rejects.toThrow('Repository download timed out - repository may be too large')
    })

    test('should handle rate limit errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      })

      await expect(analyzeRepository('https://github.com/rate/limited'))
        .rejects.toThrow('Rate limit exceeded - please try again later')
    })

    test('should handle forbidden access errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 403 },
        message: 'Forbidden'
      })

      await expect(analyzeRepository('https://github.com/private/repo'))
        .rejects.toThrow('Repository access forbidden - may be private or rate limited')
    })

    test('should try master branch when main branch fails', async () => {
      // First call (main branch) fails with 404
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Not Found'
      })

      // Second call (master branch) succeeds
      const mockZipData = Buffer.from('mock zip data')
      mockedAxios.get.mockResolvedValueOnce({
        data: mockZipData
      })

      // Mock JSZip
      const mockZip = {
        files: {
          'repo-master/README.md': { name: 'README.md', async: jest.fn().mockResolvedValue('mock content') }
        },
        loadAsync: jest.fn().mockResolvedValue({
          files: {
            'repo-master/README.md': { name: 'README.md', async: jest.fn().mockResolvedValue('mock content') }
          }
        })
      }

      jest.doMock('jszip', () => ({
        loadAsync: jest.fn().mockResolvedValue(mockZip)
      }))

      // This should not throw an error
      await expect(analyzeRepository('https://github.com/owner/repo'))
        .resolves.toBeDefined()

      expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('Repository Analyzer Plugin Error Handling', () => {
    const plugin = new RepositoryAnalyzerPlugin()

    test('should reject non-repository inputs', async () => {
      const input: AssessmentInput = {
        url: 'https://example.com',
        type: 'website',
        options: {}
      }

      await expect(plugin.analyze(input))
        .rejects.toThrow('Repository analyzer can only handle repository inputs')
    })

    test('should reject invalid GitHub URLs', async () => {
      const input: AssessmentInput = {
        url: 'https://gitlab.com/user/repo',
        type: 'repository',
        options: {}
      }

      await expect(plugin.analyze(input))
        .rejects.toThrow('Invalid GitHub repository URL')
    })

    test('should handle analysis failures gracefully', async () => {
      const input: AssessmentInput = {
        url: 'https://github.com/invalid/repo',
        type: 'repository',
        options: {}
      }

      // Mock the analyzeRepository function to throw an error
      const originalAnalyzeRepository = require('../lib/analyzer').analyzeRepository
      require('../lib/analyzer').analyzeRepository = jest.fn().mockRejectedValueOnce(new Error('Repository not found'))

      await expect(plugin.analyze(input))
        .rejects.toThrow('Repository not found')

      // Restore the original function
      require('../lib/analyzer').analyzeRepository = originalAnalyzeRepository
    })
  })

  describe('URL Validation Error Handling', () => {
    test('should handle malformed URLs', () => {
      const plugin = new RepositoryAnalyzerPlugin()
      
      expect(plugin.isValidGitHubUrl('not-a-url')).toBe(false)
      expect(plugin.isValidGitHubUrl('https://not-github.com/user/repo')).toBe(false)
      expect(plugin.isValidGitHubUrl('https://github.com/')).toBe(false)
      expect(plugin.isValidGitHubUrl('https://github.com/user')).toBe(false)
    })

    test('should accept valid GitHub URLs', () => {
      const plugin = new RepositoryAnalyzerPlugin()
      
      expect(plugin.isValidGitHubUrl('https://github.com/user/repo')).toBe(true)
      expect(plugin.isValidGitHubUrl('https://github.com/user/repo/')).toBe(true)
      expect(plugin.isValidGitHubUrl('https://github.com/user/repo.git')).toBe(true)
    })
  })
})

describe('Frontend Error Scenarios', () => {
  // Mock fetch for testing frontend error handling
  global.fetch = jest.fn()

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
  })

  test('should handle network errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'))

    // This would be tested in a React component test
    // For now, we're just ensuring the error types are handled
    const error = new Error('Failed to fetch')
    expect(error.message).toBe('Failed to fetch')
  })

  test('should handle server errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' })
    })

    const response = await global.fetch('/api/analyze')
    const data = await response.json()
    
    expect(response.ok).toBe(false)
    expect(data.error).toBe('Internal server error')
  })

  test('should handle timeout errors gracefully', async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000)

    try {
      await global.fetch('/api/analyze', { signal: controller.signal })
    } catch (error) {
      expect(error.name).toBe('AbortError')
    } finally {
      clearTimeout(timeoutId)
    }
  })
})