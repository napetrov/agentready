import { analyzeRepository } from '../lib/analyzer'
import { generateAIAssessment } from '../lib/ai-assessment'

// Integration test with a real, well-known repository
describe('Integration Tests', () => {
  // Skip if no OpenAI API key is available
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  test.skip('should analyze a real repository end-to-end', async () => {
    // Use a well-known, stable repository for testing
    const testRepo = 'https://github.com/vercel/next.js'
    
    console.log('Testing with repository:', testRepo)
    
    // Test static analysis
    const staticAnalysis = await analyzeRepository(testRepo)
    
    expect(staticAnalysis).toBeDefined()
    expect(staticAnalysis.hasReadme).toBe(true) // Next.js definitely has a README
    expect(staticAnalysis.fileCount).toBeGreaterThan(0)
    expect(staticAnalysis.languages.length).toBeGreaterThan(0)
    
    console.log('Static analysis completed:', {
      hasReadme: staticAnalysis.hasReadme,
      hasContributing: staticAnalysis.hasContributing,
      hasWorkflows: staticAnalysis.hasWorkflows,
      hasTests: staticAnalysis.hasTests,
      languages: staticAnalysis.languages,
      fileCount: staticAnalysis.fileCount
    })

    // Test AI assessment (only if API key is available)
    if (hasOpenAIKey) {
      const aiAssessment = await generateAIAssessment(staticAnalysis)
      
      expect(aiAssessment).toBeDefined()
      expect(aiAssessment.readinessScore).toBeGreaterThan(0)
      expect(aiAssessment.readinessScore).toBeLessThanOrEqual(100)
      expect(aiAssessment.categories).toBeDefined()
      expect(aiAssessment.findings).toBeDefined()
      expect(aiAssessment.recommendations).toBeDefined()
      
      console.log('AI assessment completed:', {
        readinessScore: aiAssessment.readinessScore,
        categories: aiAssessment.categories
      })
    } else {
      console.log('Skipping AI assessment - no OpenAI API key')
    }
  }, 60000) // 60 second timeout for real network calls

  test('should handle non-existent repository gracefully', async () => {
    const nonExistentRepo = 'https://github.com/nonexistentuser/thisrepodoesnotexist'
    
    await expect(analyzeRepository(nonExistentRepo)).rejects.toThrow(
      'Repository not found'
    )
  })

  test('should handle invalid URL format', async () => {
    const invalidUrl = 'not-a-github-url'
    
    await expect(analyzeRepository(invalidUrl)).rejects.toThrow(
      'Invalid GitHub repository URL format'
    )
  })
})