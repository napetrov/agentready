import { analyzeRepository } from '../lib/analyzer'

// Mock axios to avoid actual network calls during testing
jest.mock('axios', () => ({
  get: jest.fn()
}))

// Mock JSZip
jest.mock('jszip', () => {
  return jest.fn().mockImplementation(() => ({
    loadAsync: jest.fn()
  }))
})

const mockedAxios = require('axios')
const mockedJSZip = require('jszip')

describe('Repository Analyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should analyze a repository with basic files', async () => {
    // Mock successful axios response
    const mockZipBuffer = Buffer.from('mock zip data')
    mockedAxios.get.mockResolvedValue({
      data: mockZipBuffer,
      status: 200
    })

    // Mock JSZip
    const mockZipInstance = {
      loadAsync: jest.fn().mockResolvedValue({
        files: {
          'test-repo-main/README.md': {
            async: jest.fn().mockResolvedValue('# Test Repository\nThis is a test README.')
          },
          'test-repo-main/CONTRIBUTING.md': {
            async: jest.fn().mockResolvedValue('# Contributing\nPlease read this.')
          },
          'test-repo-main/LICENSE': {
            async: jest.fn().mockResolvedValue('MIT License')
          },
          'test-repo-main/.github/workflows/ci.yml': {
            async: jest.fn().mockResolvedValue('name: CI\non: push')
          },
          'test-repo-main/src/test.js': {
            async: jest.fn().mockResolvedValue('describe("test", () => {})')
          },
          'test-repo-main/src/index.js': {
            async: jest.fn().mockResolvedValue('console.log("hello")')
          }
        }
      })
    }
    mockedJSZip.mockImplementation(() => mockZipInstance)

    const result = await analyzeRepository('https://github.com/testuser/testrepo')

    expect(result).toEqual({
      hasReadme: true,
      hasContributing: true,
      hasAgents: false,
      hasLicense: true,
      hasWorkflows: true,
      hasTests: true,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 6,
      readmeContent: '# Test Repository\nThis is a test README.',
      contributingContent: '# Contributing\nPlease read this.',
      agentsContent: undefined,
      workflowFiles: ['test-repo-main/.github/workflows/ci.yml'],
      testFiles: ['test-repo-main/src/test.js']
    })
  })

  test('should handle repository with no documentation', async () => {
    const mockZipBuffer = Buffer.from('mock zip data')
    mockedAxios.get.mockResolvedValue({
      data: mockZipBuffer,
      status: 200
    })

    const mockZip = {
      loadAsync: jest.fn().mockResolvedValue({
        files: {
          'test-repo-main/src/index.js': {
            async: jest.fn().mockResolvedValue('console.log("hello")')
          }
        }
      })
    }
    mockedJSZip.mockImplementation(() => mockZip)

    const result = await analyzeRepository('https://github.com/testuser/barebones')

    expect(result).toEqual({
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 1,
      readmeContent: undefined,
      contributingContent: undefined,
      agentsContent: undefined,
      workflowFiles: [],
      testFiles: []
    })
  })

  test('should try master branch when main branch fails', async () => {
    // First call fails with 404 (main branch)
    mockedAxios.get
      .mockRejectedValueOnce({
        response: { status: 404 }
      })
      // Second call succeeds (master branch)
      .mockResolvedValueOnce({
        data: Buffer.from('mock zip data'),
        status: 200
      })

    const mockZip = {
      loadAsync: jest.fn().mockResolvedValue({
        files: {
          'test-repo-master/README.md': {
            async: jest.fn().mockResolvedValue('# Test Repository')
          }
        }
      })
    }
    mockedJSZip.mockImplementation(() => mockZip)

    const result = await analyzeRepository('https://github.com/testuser/oldrepo')

    expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, 
      'https://github.com/testuser/oldrepo/archive/refs/heads/main.zip',
      expect.any(Object)
    )
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2,
      'https://github.com/testuser/oldrepo/archive/refs/heads/master.zip',
      expect.any(Object)
    )
    expect(result.hasReadme).toBe(true)
  })

  test('should throw error for invalid URL', async () => {
    await expect(analyzeRepository('invalid-url')).rejects.toThrow('Invalid GitHub repository URL format')
  })

  test('should throw error when both branches fail', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({
        response: { status: 404 }
      })
      .mockRejectedValueOnce({
        response: { status: 404 }
      })

    await expect(analyzeRepository('https://github.com/nonexistent/repo')).rejects.toThrow(
      'Repository not found. Tried both \'main\' and \'master\' branches'
    )
  })

  test('should detect error handling patterns', async () => {
    const mockZipBuffer = Buffer.from('mock zip data')
    mockedAxios.get.mockResolvedValue({
      data: mockZipBuffer,
      status: 200
    })

    const mockZip = {
      loadAsync: jest.fn().mockResolvedValue({
        files: {
          'test-repo-main/src/index.js': {
            async: jest.fn().mockResolvedValue(`
              try {
                console.log('hello')
              } catch (error) {
                console.error('Error:', error)
              }
            `)
          },
          'test-repo-main/src/utils.js': {
            async: jest.fn().mockResolvedValue(`
              function test() {
                assert(value > 0, 'Value must be positive')
                logger.error('Something went wrong')
              }
            `)
          }
        }
      })
    }
    mockedJSZip.mockImplementation(() => mockZip)

    const result = await analyzeRepository('https://github.com/testuser/errorhandling')

    expect(result.errorHandling).toBe(true)
  })
})