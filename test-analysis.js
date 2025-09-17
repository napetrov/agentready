// Simple test script to verify the analyzer works
const { analyzeRepository } = require('./lib/analyzer.ts')

async function testAnalysis() {
  try {
    console.log('Testing repository analysis...')
    
    // Test with a public repository
    const testRepo = 'https://github.com/vercel/next.js'
    
    console.log(`Analyzing: ${testRepo}`)
    const result = await analyzeRepository(testRepo)
    
    console.log('\n=== Analysis Results ===')
    console.log('Has README:', result.hasReadme)
    console.log('Has CONTRIBUTING:', result.hasContributing)
    console.log('Has AGENTS:', result.hasAgents)
    console.log('Has LICENSE:', result.hasLicense)
    console.log('Has Workflows:', result.hasWorkflows)
    console.log('Has Tests:', result.hasTests)
    console.log('Error Handling:', result.errorHandling)
    console.log('Languages:', result.languages)
    console.log('File Count:', result.fileCount)
    console.log('Workflow Files:', result.workflowFiles.length)
    console.log('Test Files:', result.testFiles.length)
    
    console.log('\n✅ Analysis completed successfully!')
  } catch (error) {
    console.error('❌ Analysis failed:', error.message)
  }
}

testAnalysis()