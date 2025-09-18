import { FileSizeAnalyzer, AGENT_LIMITS, OPTIMAL_SIZES } from '../lib/file-size-analyzer'

describe('FileSizeAnalyzer', () => {
  const mockFiles = [
    {
      path: 'README.md',
      content: 'This is a README file with some content',
      size: 1024
    },
    {
      path: 'AGENTS.md',
      content: 'Instructions for AI agents\nStep 1: Do this\nStep 2: Do that',
      size: 512
    },
    {
      path: 'large-file.js',
      content: 'x'.repeat(3 * 1024 * 1024),
      size: 3 * 1024 * 1024 // 3MB
    },
    {
      path: 'small-file.js',
      content: 'console.log("hello");',
      size: 100
    },
    {
      path: 'binary-file.exe',
      content: Buffer.alloc(1024 * 1024).toString('binary'),
      size: 1024 * 1024 // 1MB binary
    },
    {
      path: 'data.json',
      content: JSON.stringify({ data: 'test' }),
      size: 50
    }
  ]

  test('should analyze file sizes correctly', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result).toBeDefined()
    expect(result.totalFiles).toBe(6)
    expect(result.filesBySize.under100KB).toBe(4)  // <100KB: README, AGENTS, small-file, data
    expect(result.filesBySize.under500KB).toBe(4)  // <=500KB: same as under100KB
    expect(result.filesBySize.under1MB).toBe(4)    // <1MB: same as under100KB (1MB binary is exactly 1MB)
    expect(result.filesBySize.under5MB).toBe(6)    // <=5MB: adds 1MB binary + 3MB file
    expect(result.filesBySize.over5MB).toBe(0)     // >5MB: none
  })

  test('should identify large files correctly', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result.largeFiles).toHaveLength(1)
    expect(result.largeFiles[0].path).toBe('large-file.js')
    expect(result.largeFiles[0].size).toBe(3 * 1024 * 1024)
    expect(result.largeFiles[0].type).toBe('code')
    expect(result.largeFiles[0].agentImpact.cursor).toBe('blocked')
    expect(result.largeFiles[0].agentImpact.githubCopilot).toBe('blocked')
  })

  test('should analyze critical files correctly', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result.criticalFiles).toHaveLength(2) // README and AGENTS
    expect(result.criticalFiles[0].path).toBe('README.md')
    expect(result.criticalFiles[0].isOptimal).toBe(true) // 1KB < 500KB optimal
    expect(result.criticalFiles[1].path).toBe('AGENTS.md')
    expect(result.criticalFiles[1].isOptimal).toBe(true) // 512B < 200KB optimal
  })

  test('should calculate agent compatibility scores', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result.agentCompatibility).toBeDefined()
    expect(result.agentCompatibility.cursor).toBeGreaterThanOrEqual(0)
    expect(result.agentCompatibility.cursor).toBeLessThanOrEqual(100)
    expect(result.agentCompatibility.githubCopilot).toBeGreaterThanOrEqual(0)
    expect(result.agentCompatibility.githubCopilot).toBeLessThanOrEqual(100)
    expect(result.agentCompatibility.claudeWeb).toBeGreaterThanOrEqual(0)
    expect(result.agentCompatibility.claudeWeb).toBeLessThanOrEqual(100)
    expect(result.agentCompatibility.claudeApi).toBeGreaterThanOrEqual(0)
    expect(result.agentCompatibility.claudeApi).toBeLessThanOrEqual(100)
  })

  test('should analyze context consumption', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result.contextConsumption).toBeDefined()
    expect(result.contextConsumption.totalContextFiles).toBeGreaterThan(0)
    expect(result.contextConsumption.averageContextFileSize).toBeGreaterThan(0)
    expect(['excellent', 'good', 'moderate', 'poor']).toContain(result.contextConsumption.contextEfficiency)
    
    // Check instruction files
    expect(result.contextConsumption.instructionFiles.agentsMd).toBeDefined()
    expect(result.contextConsumption.instructionFiles.agentsMd?.lines).toBe(3) // 3 lines in AGENTS.md
    expect(result.contextConsumption.instructionFiles.readme).toBeDefined()
    expect(result.contextConsumption.instructionFiles.readme?.lines).toBe(1) // 1 line in README
  })

  test('should generate recommendations', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles)
    
    expect(result.recommendations).toBeDefined()
    expect(Array.isArray(result.recommendations)).toBe(true)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  test('should handle empty file list', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes([])
    
    expect(result.totalFiles).toBe(0)
    expect(result.filesBySize.under100KB).toBe(0)
    expect(result.largeFiles).toHaveLength(0)
    expect(result.criticalFiles).toHaveLength(0)
    expect(result.agentCompatibility.overall).toBe(100) // Perfect score for no files
  })

  test('should detect file types correctly', async () => {
    const testFiles = [
      { path: 'test.js', content: 'console.log("test");', size: 100 },
      { path: 'test.exe', content: Buffer.alloc(100).toString('binary'), size: 100 },
      { path: 'data.json', content: '{"test": true}', size: 100 },
      { path: 'readme.md', content: '# Test', size: 100 }
    ]
    
    const result = await FileSizeAnalyzer.analyzeFileSizes(testFiles)
    
    expect(result.largeFiles).toHaveLength(0) // All under 2MB
    expect(result.criticalFiles).toHaveLength(1) // Only readme.md
    expect(result.criticalFiles[0].type).toBe('readme')
  })

  test('should handle very large files', async () => {
    const largeFiles = [
      { path: 'huge-file.txt', content: 'x'.repeat(100 * 1024 * 1024), size: 100 * 1024 * 1024 } // 100MB
    ]
    
    const result = await FileSizeAnalyzer.analyzeFileSizes(largeFiles)
    
    expect(result.largeFiles).toHaveLength(1)
    expect(result.largeFiles[0].agentImpact.cursor).toBe('blocked')
    expect(result.largeFiles[0].agentImpact.githubCopilot).toBe('blocked')
    expect(result.largeFiles[0].agentImpact.claudeWeb).toBe('blocked')
    expect(result.largeFiles[0].agentImpact.claudeApi).toBe('supported')
  })

  test('should handle suboptimal critical files', async () => {
    const largeReadme = {
      path: 'README.md',
      content: 'x'.repeat(600 * 1024), // 600KB - over optimal 500KB
      size: 600 * 1024
    }
    
    const result = await FileSizeAnalyzer.analyzeFileSizes([largeReadme])
    
    expect(result.criticalFiles).toHaveLength(1)
    expect(result.criticalFiles[0].isOptimal).toBe(false)
    expect(result.criticalFiles[0].agentImpact.cursor).toBe('acceptable')
  })
})

describe('FileSizeAnalyzer Constants', () => {
  test('should have correct agent limits', () => {
    expect(AGENT_LIMITS.cursor).toBe(2 * 1024 * 1024) // 2MB
    expect(AGENT_LIMITS.githubCopilot).toBe(1 * 1024 * 1024) // 1MB
    expect(AGENT_LIMITS.claudeWeb).toBe(30 * 1024 * 1024) // 30MB
    expect(AGENT_LIMITS.claudeApi).toBe(500 * 1024 * 1024) // 500MB
  })

  test('should have correct optimal sizes', () => {
    expect(OPTIMAL_SIZES.agentsMd).toBe(200 * 1024) // 200KB
    expect(OPTIMAL_SIZES.readme).toBe(500 * 1024) // 500KB
    expect(OPTIMAL_SIZES.contributing).toBe(300 * 1024) // 300KB
    expect(OPTIMAL_SIZES.license).toBe(50 * 1024) // 50KB
  })
})