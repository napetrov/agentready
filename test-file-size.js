// Simple test for file size analysis
const { FileSizeAnalyzer } = require('./lib/file-size-analyzer.ts');

// Mock file data
const mockFiles = [
  { path: 'README.md', content: 'This is a README file with some content', size: 1024 },
  { path: 'AGENTS.md', content: 'Instructions for AI agents', size: 512 },
  { path: 'large-file.js', content: 'x'.repeat(3 * 1024 * 1024), size: 3 * 1024 * 1024 }, // 3MB
  { path: 'small-file.js', content: 'console.log("hello");', size: 100 },
  { path: 'binary-file.exe', content: Buffer.alloc(1024 * 1024), size: 1024 * 1024 }, // 1MB binary
];

async function testFileSizeAnalysis() {
  try {
    console.log('Testing file size analysis...');
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockFiles);
    
    console.log('File Size Analysis Results:');
    console.log('- Total files:', result.totalFiles);
    console.log('- Files by size:', result.filesBySize);
    console.log('- Large files:', result.largeFiles.length);
    console.log('- Critical files:', result.criticalFiles.length);
    console.log('- Agent compatibility:', result.agentCompatibility);
    console.log('- Recommendations:', result.recommendations);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFileSizeAnalysis();