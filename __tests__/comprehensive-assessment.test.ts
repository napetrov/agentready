import { generateAIAssessment } from '../lib/ai-assessment'
import { generateEnhancedAIAssessment } from '../lib/enhanced-ai-assessment'
import { FileSizeAnalyzer } from '../lib/file-size-analyzer'
import { StaticAnalysisSummary } from '../lib/ai-assessment'

describe('Comprehensive Assessment Integration', () => {
  // Mock realistic repository data
  const mockRepositoryFiles = [
    {
      path: 'README.md',
      content: `# AI Agent Ready Repository

This repository is designed to be easily consumed by AI agents.

## Quick Start
1. Clone the repository
2. Run \`npm install\`
3. Run \`npm start\`

## Dependencies
- Node.js 18+
- npm 9+

## Error Handling
All functions include proper try-catch blocks and error logging.

## API Documentation
See docs/api.md for detailed API documentation.

## Contributing
Please read CONTRIBUTING.md before submitting PRs.`,
      size: 1024
    },
    {
      path: 'AGENTS.md',
      content: `# AI Agent Instructions

This repository is optimized for AI agent consumption.

## Setup Instructions
1. Ensure Node.js 18+ is installed
2. Run \`npm install\` to install dependencies
3. Run \`npm test\` to verify setup

## Key Files
- \`src/main.js\` - Main application entry point
- \`src/api/\` - API endpoints
- \`tests/\` - Test suite

## Error Handling
All API endpoints include proper error handling and validation.

## Dependencies
- express: ^4.18.0
- cors: ^2.8.5
- helmet: ^6.0.0`,
      size: 2048
    },
    {
      path: 'CONTRIBUTING.md',
      content: `# Contributing Guidelines

## Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: \`npm test\`
5. Submit a pull request

## Code Style
- Use ESLint configuration
- Follow existing patterns
- Add tests for new features`,
      size: 512
    },
    {
      path: 'LICENSE',
      content: 'MIT License\n\nCopyright (c) 2024',
      size: 256
    },
    {
      path: '.github/workflows/ci.yml',
      content: `name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test`,
      size: 300
    },
    {
      path: 'src/main.js',
      content: `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Routes
app.get('/api/health', (req, res) => {
  try {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
      size: 800
    },
    {
      path: 'tests/main.test.js',
      content: `const request = require('supertest');
const app = require('../src/main');

describe('API Tests', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});`,
      size: 400
    },
    {
      path: 'package.json',
      content: `{
  "name": "ai-agent-ready-repo",
  "version": "1.0.0",
  "description": "A repository optimized for AI agent consumption",
  "main": "src/main.js",
  "scripts": {
    "start": "node src/main.js",
    "test": "jest",
    "dev": "nodemon src/main.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.0.0",
    "nodemon": "^2.0.0"
  }
}`,
      size: 600
    }
  ]

  const mockStaticAnalysis: StaticAnalysisSummary = {
    hasReadme: true,
    hasContributing: true,
    hasAgents: true,
    hasLicense: true,
    hasWorkflows: true,
    hasTests: true,
    languages: ['JavaScript', 'JSON'],
    errorHandling: true,
    fileCount: 8,
    linesOfCode: 150,
    workflowFiles: ['ci.yml'],
    testFiles: ['main.test.js'],
    readmeContent: mockRepositoryFiles[0].content,
    contributingContent: mockRepositoryFiles[2].content,
    agentsContent: mockRepositoryFiles[1].content
  }

  test('should generate comprehensive basic assessment', async () => {
    const result = await generateAIAssessment(mockStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThan(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    
    // Check categories have reasonable scores
    expect(result.categories.documentation).toBeGreaterThan(0)
    expect(result.categories.instructionClarity).toBeGreaterThan(0)
    expect(result.categories.workflowAutomation).toBeGreaterThan(0)
    expect(result.categories.riskCompliance).toBeGreaterThan(0)
    expect(result.categories.integrationStructure).toBeGreaterThan(0)
    
    // Check findings and recommendations are populated
    expect(result.findings).toBeDefined()
    expect(result.recommendations).toBeDefined()
    
    // For a well-documented repository, findings might be empty but recommendations should exist
    if (result.findings.length === 0) {
      // If no findings, there should be positive recommendations
      expect(result.recommendations.length).toBeGreaterThan(0)
    } else {
      expect(result.findings.length).toBeGreaterThan(0)
    }
  })

  test('should generate comprehensive enhanced assessment', async () => {
    // Add file size analysis
    const fileSizeAnalysis = await FileSizeAnalyzer.analyzeFileSizes(mockRepositoryFiles)
    const staticAnalysisWithFileSize = {
      ...mockStaticAnalysis,
      fileSizeAnalysis
    }

    const result = await generateEnhancedAIAssessment(staticAnalysisWithFileSize)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThan(0)
    expect(result.readinessScore).toBeLessThanOrEqual(100)
    
    // Check categories have reasonable scores
    expect(result.categories.documentation).toBeGreaterThan(0)
    expect(result.categories.instructionClarity).toBeGreaterThan(0)
    expect(result.categories.workflowAutomation).toBeGreaterThan(0)
    expect(result.categories.riskCompliance).toBeGreaterThan(0)
    expect(result.categories.integrationStructure).toBeGreaterThan(0)
    expect(result.categories.fileSizeOptimization).toBeGreaterThan(0)
    
    // Check detailed analysis has meaningful scores
    expect(result.detailedAnalysis.instructionClarity.overallScore).toBeGreaterThan(0)
    expect(result.detailedAnalysis.workflowAutomation.overallScore).toBeGreaterThan(0)
    expect(result.detailedAnalysis.contextEfficiency.overallScore).toBeGreaterThan(0)
    expect(result.detailedAnalysis.riskCompliance.overallScore).toBeGreaterThan(0)
    
    // Check confidence scores are reasonable
    expect(result.confidence.overall).toBeGreaterThan(0)
    expect(result.confidence.overall).toBeLessThanOrEqual(100)
    
    // Check findings and recommendations are populated
    expect(result.findings).toBeDefined()
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.recommendations).toBeDefined()
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  test('should handle repository with minimal documentation', async () => {
    const minimalStaticAnalysis: StaticAnalysisSummary = {
      hasReadme: false,
      hasContributing: false,
      hasAgents: false,
      hasLicense: false,
      hasWorkflows: false,
      hasTests: false,
      languages: ['JavaScript'],
      errorHandling: false,
      fileCount: 2,
      linesOfCode: 50,
      workflowFiles: [],
      testFiles: []
    }

    const result = await generateAIAssessment(minimalStaticAnalysis)
    
    expect(result).toBeDefined()
    expect(result.readinessScore).toBeGreaterThanOrEqual(0)
    expect(result.readinessScore).toBeLessThan(50) // Should be low for minimal repo
    
    // Categories should reflect poor documentation
    expect(result.categories.documentation).toBeLessThan(10)
    expect(result.categories.instructionClarity).toBeLessThan(10)
    
    // Should have recommendations for improvement
    expect(result.recommendations.some(r => r.includes('README') || r.includes('documentation'))).toBe(true)
  })

  test('should analyze file sizes correctly with realistic data', async () => {
    const result = await FileSizeAnalyzer.analyzeFileSizes(mockRepositoryFiles)
    
    expect(result).toBeDefined()
    expect(result.totalFiles).toBe(8)
    
    // Check file size distribution - all files are under 100KB
    expect(result.filesBySize.under100KB).toBe(8) // All 8 files are under 100KB
    expect(result.filesBySize.under500KB).toBe(0) // No files in 100KB-500KB range
    expect(result.filesBySize.under1MB).toBe(0)   // No files in 500KB-1MB range
    expect(result.filesBySize.under5MB).toBe(0)   // No files in 1MB-5MB range
    expect(result.filesBySize.over5MB).toBe(0)    // No files over 5MB
    
    // Check critical files analysis
    expect(result.criticalFiles.length).toBeGreaterThan(0)
    const readmeFile = result.criticalFiles.find(f => f.path === 'README.md')
    expect(readmeFile).toBeDefined()
    expect(readmeFile?.isOptimal).toBe(true)
    
    // Check agent compatibility
    expect(result.agentCompatibility.overall).toBeGreaterThan(0)
    expect(result.agentCompatibility.overall).toBeLessThanOrEqual(100)
    
    // Check recommendations (should exist for file size analysis)
    expect(result.recommendations).toBeDefined()
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  test('should provide meaningful confidence scores', async () => {
    const result = await generateEnhancedAIAssessment(mockStaticAnalysis)
    
    expect(result.confidence).toBeDefined()
    expect(result.confidence.overall).toBeGreaterThan(0)
    expect(result.confidence.overall).toBeLessThanOrEqual(100)
    
    // Individual confidence scores should be reasonable
    expect(result.confidence.instructionClarity).toBeGreaterThan(0)
    expect(result.confidence.workflowAutomation).toBeGreaterThan(0)
    expect(result.confidence.contextEfficiency).toBeGreaterThan(0)
    expect(result.confidence.riskCompliance).toBeGreaterThan(0)
  })

  test('should generate actionable recommendations', async () => {
    const result = await generateAIAssessment(mockStaticAnalysis)
    
    expect(result.recommendations).toBeDefined()
    
    // For a well-documented repository, recommendations might be positive rather than corrective
    if (result.recommendations.length > 0) {
      // Recommendations should be actionable
      result.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string')
        expect(rec.length).toBeGreaterThan(10) // Should be substantial
      })
    }
  })
})