import { analyzeRepository } from '../lib/analyzer'

// Mock JSZip
jest.mock('jszip', () => {
  const mockZipInstance = {
    files: {
      'test-repo-main/README.md': {
        async: jest.fn().mockResolvedValue('# Test README\nThis is a test repository.'),
        dir: false
      },
      'test-repo-main/CONTRIBUTING.md': {
        async: jest.fn().mockResolvedValue('# Contributing\nPlease follow these guidelines.'),
        dir: false
      },
      'test-repo-main/AGENTS.md': {
        async: jest.fn().mockResolvedValue('# AI Agents\nInstructions for AI agents.'),
        dir: false
      },
      'test-repo-main/LICENSE': {
        async: jest.fn().mockResolvedValue('MIT License'),
        dir: false
      },
      'test-repo-main/.github/workflows/ci.yml': {
        async: jest.fn().mockResolvedValue('name: CI\non: [push]'),
        dir: false
      },
      'test-repo-main/src/index.js': {
        async: jest.fn().mockResolvedValue('console.log("Hello World");'),
        dir: false
      },
      'test-repo-main/test/index.test.js': {
        async: jest.fn().mockResolvedValue('describe("test", () => { it("works", () => {}); });'),
        dir: false
      },
      'test-repo-main/package.json': {
        async: jest.fn().mockResolvedValue('{"name": "test", "version": "1.0.0"}'),
        dir: false
      }
    }
  }

  return {
    loadAsync: jest.fn().mockResolvedValue(mockZipInstance)
  }
})

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: Buffer.from('mock zip data')
  })
}))

describe('analyzeRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset to default mock
    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValue({
      files: {
        'test-repo-main/README.md': {
          async: jest.fn().mockResolvedValue('# Test README\nThis is a test repository.'),
          dir: false
        },
        'test-repo-main/CONTRIBUTING.md': {
          async: jest.fn().mockResolvedValue('# Contributing\nPlease follow these guidelines.'),
          dir: false
        },
        'test-repo-main/AGENTS.md': {
          async: jest.fn().mockResolvedValue('# AI Agents\nInstructions for AI agents.'),
          dir: false
        },
        'test-repo-main/LICENSE': {
          async: jest.fn().mockResolvedValue('MIT License'),
          dir: false
        },
        'test-repo-main/.github/workflows/ci.yml': {
          async: jest.fn().mockResolvedValue('name: CI\non: [push]'),
          dir: false
        },
        'test-repo-main/src/index.js': {
          async: jest.fn().mockResolvedValue('console.log("Hello World");'),
          dir: false
        },
        'test-repo-main/test/index.test.js': {
          async: jest.fn().mockResolvedValue('describe("test", () => { it("works", () => {}); });'),
          dir: false
        },
        'test-repo-main/package.json': {
          async: jest.fn().mockResolvedValue('{"name": "test", "version": "1.0.0"}'),
          dir: false
        }
      }
    })
  })

  test('should analyze a valid repository successfully', async () => {
    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result).toBeDefined()
    expect(result.hasReadme).toBe(true)
    expect(result.hasContributing).toBe(true)
    expect(result.hasAgents).toBe(true)
    expect(result.hasLicense).toBe(true)
    expect(result.hasWorkflows).toBe(true)
    expect(result.hasTests).toBe(true)
    expect(result.fileCount).toBe(8)
    expect(result.languages).toContain('JavaScript')
    expect(result.workflowFiles).toContain('test-repo-main/.github/workflows/ci.yml')
    expect(result.testFiles).toContain('test-repo-main/test/index.test.js')
    expect(result.readmeContent).toContain('Test README')
    expect(result.contributingContent).toContain('Contributing')
    expect(result.agentsContent).toContain('AI Agents')
  })

  test('should handle repository with no documentation', async () => {
    // Mock empty repository
    const JSZip = require('jszip')
    JSZip.loadAsync.mockImplementation(() => Promise.resolve({
      files: {
        'test-repo-main/src/index.js': {
          async: jest.fn().mockResolvedValue('console.log("Hello");'),
          dir: false
        }
      }
    }))

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result.hasReadme).toBe(false)
    expect(result.hasContributing).toBe(false)
    expect(result.hasAgents).toBe(false)
    expect(result.hasLicense).toBe(false)
    expect(result.hasWorkflows).toBe(false)
    expect(result.hasTests).toBe(true)
    expect(result.fileCount).toBe(1)
  })

  test('should detect programming languages correctly', async () => {
    // Mock repository with multiple languages
    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValueOnce({
      files: {
        'test-repo-main/src/index.js': {
          async: jest.fn().mockResolvedValue('console.log("JS");'),
          dir: false
        },
        'test-repo-main/src/app.ts': {
          async: jest.fn().mockResolvedValue('console.log("TS");'),
          dir: false
        },
        'test-repo-main/src/style.css': {
          async: jest.fn().mockResolvedValue('body { color: red; }'),
          dir: false
        },
        'test-repo-main/README.md': {
          async: jest.fn().mockResolvedValue('# Test'),
          dir: false
        }
      }
    })

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result.languages).toContain('JavaScript')
    expect(result.languages).toContain('TypeScript')
    expect(result.languages).toContain('CSS')
    expect(result.languages).toContain('Markdown')
  })

  test('should detect error handling patterns', async () => {
    // Mock repository with error handling
    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValueOnce({
      files: {
        'test-repo-main/src/index.js': {
          async: jest.fn().mockResolvedValue(`
            try {
              console.log("test");
            } catch (error) {
              console.error("Error:", error);
            }
          `),
          dir: false
        },
        'test-repo-main/README.md': {
          async: jest.fn().mockResolvedValue('# Test'),
          dir: false
        }
      }
    })

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result.errorHandling).toBe(true)
  })

  test('should handle binary files correctly', async () => {
    // Mock repository with binary files
    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValueOnce({
      files: {
        'test-repo-main/image.png': {
          async: jest.fn().mockRejectedValue(new Error('Cannot read binary as text')),
          dir: false
        },
        'test-repo-main/README.md': {
          async: jest.fn().mockResolvedValue('# Test'),
          dir: false
        }
      }
    })

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result.fileCount).toBe(2)
    expect(result.errorHandling).toBe(false) // Binary file skipped
  })

  test('should handle large files in file size analysis', async () => {
    // Mock repository with large files
    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValueOnce({
      files: {
        'test-repo-main/README.md': {
          async: jest.fn().mockResolvedValue('# Test'),
          dir: false
        },
        'test-repo-main/large-file.js': {
          async: jest.fn().mockResolvedValue('x'.repeat(3 * 1024 * 1024)), // 3MB
          dir: false
        }
      }
    })

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result.fileSizeAnalysis).toBeDefined()
    expect(result.fileSizeAnalysis?.largeFiles.length).toBeGreaterThan(0)
    expect(result.fileSizeAnalysis?.agentCompatibility).toBeDefined()
  })

  test('should handle master branch fallback', async () => {
    const axios = require('axios')
    axios.get
      .mockRejectedValueOnce({ response: { status: 404 } }) // main branch fails
      .mockResolvedValueOnce({ data: Buffer.from('mock zip data') }) // master branch succeeds

    const JSZip = require('jszip')
    JSZip.loadAsync.mockResolvedValueOnce({
      files: {
        'test-repo-master/README.md': {
          async: jest.fn().mockResolvedValue('# Test'),
          dir: false
        }
      }
    })

    const result = await analyzeRepository('https://github.com/user/repo')
    
    expect(result).toBeDefined()
    expect(axios.get).toHaveBeenCalledTimes(2) // Tried main, then master
  })

  test('should handle network errors', async () => {
    const axios = require('axios')
    axios.get.mockRejectedValue(new Error('Network error'))

    await expect(analyzeRepository('https://github.com/user/repo'))
      .rejects.toThrow('Failed to download repository: Network error')
  })

  test('should handle invalid URLs', async () => {
    await expect(analyzeRepository('invalid-url'))
      .rejects.toThrow('Invalid GitHub repository URL format')
    
    await expect(analyzeRepository('https://not-github.com/user/repo'))
      .rejects.toThrow('Invalid GitHub repository URL format')
    
    await expect(analyzeRepository('https://github.com/'))
      .rejects.toThrow('Invalid GitHub repository URL format')
  })

})