#!/usr/bin/env node

/**
 * Test script to validate repository analysis functionality
 * Run with: node test-repo-analysis.js
 */

const { analyzeRepository } = require('./lib/analyzer.ts')
const { generateAIAssessment } = require('./lib/ai-assessment.ts')

async function testRepositoryAnalysis() {
  console.log('🧪 Testing Repository Analysis Tool\n')
  
  // Test repositories (using well-known, stable repos)
  const testRepos = [
    'https://github.com/vercel/next.js',
    'https://github.com/facebook/react',
    'https://github.com/microsoft/vscode'
  ]

  for (const repoUrl of testRepos) {
    console.log(`\n📁 Testing: ${repoUrl}`)
    console.log('─'.repeat(60))
    
    try {
      // Test static analysis
      console.log('⏳ Running static analysis...')
      const startTime = Date.now()
      
      const staticAnalysis = await analyzeRepository(repoUrl)
      const analysisTime = Date.now() - startTime
      
      console.log(`✅ Static analysis completed in ${analysisTime}ms`)
      console.log('📊 Results:')
      console.log(`   • README: ${staticAnalysis.hasReadme ? '✅' : '❌'}`)
      console.log(`   • CONTRIBUTING: ${staticAnalysis.hasContributing ? '✅' : '❌'}`)
      console.log(`   • AGENTS: ${staticAnalysis.hasAgents ? '✅' : '❌'}`)
      console.log(`   • LICENSE: ${staticAnalysis.hasLicense ? '✅' : '❌'}`)
      console.log(`   • Workflows: ${staticAnalysis.hasWorkflows ? '✅' : '❌'}`)
      console.log(`   • Tests: ${staticAnalysis.hasTests ? '✅' : '❌'}`)
      console.log(`   • Error Handling: ${staticAnalysis.errorHandling ? '✅' : '❌'}`)
      console.log(`   • Languages: ${staticAnalysis.languages.join(', ')}`)
      console.log(`   • File Count: ${staticAnalysis.fileCount}`)
      console.log(`   • Workflow Files: ${staticAnalysis.workflowFiles.length}`)
      console.log(`   • Test Files: ${staticAnalysis.testFiles.length}`)

      // Test AI assessment (if API key is available)
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key') {
        console.log('\n🤖 Running AI assessment...')
        const aiStartTime = Date.now()
        
        try {
          const aiAssessment = await generateAIAssessment(staticAnalysis)
          const aiTime = Date.now() - aiStartTime
          
          console.log(`✅ AI assessment completed in ${aiTime}ms`)
          console.log('🎯 AI Results:')
          console.log(`   • Overall Score: ${aiAssessment.readinessScore}/100`)
          console.log(`   • Documentation: ${aiAssessment.categories.documentation}/20`)
          console.log(`   • Instruction Clarity: ${aiAssessment.categories.instructionClarity}/20`)
          console.log(`   • Workflow Automation: ${aiAssessment.categories.workflowAutomation}/20`)
          console.log(`   • Risk & Compliance: ${aiAssessment.categories.riskCompliance}/20`)
          console.log(`   • Integration Structure: ${aiAssessment.categories.integrationStructure}/20`)
          console.log(`   • Key Findings: ${aiAssessment.findings.length}`)
          console.log(`   • Recommendations: ${aiAssessment.recommendations.length}`)
        } catch (aiError) {
          console.log(`⚠️  AI assessment failed: ${aiError.message}`)
          console.log('   (This is expected if no valid OpenAI API key is provided)')
        }
      } else {
        console.log('\n⚠️  Skipping AI assessment - no valid OpenAI API key')
      }

    } catch (error) {
      console.log(`❌ Analysis failed: ${error.message}`)
    }
  }

  console.log('\n🎉 Test completed!')
  console.log('\nTo run with AI assessment, set OPENAI_API_KEY environment variable:')
  console.log('OPENAI_API_KEY=your_key_here node test-repo-analysis.js')
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run the test
testRepositoryAnalysis().catch(console.error)