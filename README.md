# AI Agent Readiness Assessment Tool

A comprehensive tool for assessing GitHub repositories' readiness for AI agent interaction and automation. This MVP combines static code analysis with AI-powered assessment to provide detailed readiness scores and actionable recommendations.

## 🚀 Live Demo

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/ai-agent-readiness-assessment)

## ✨ Features

- **🔍 Static Analysis**: Automatically detects documentation, CI/CD workflows, tests, and error handling
- **🤖 AI Assessment**: Uses OpenAI GPT-5-nano to evaluate repository readiness across 5 key categories
- **📊 Comprehensive Scoring**: 0-100 overall score with detailed category breakdowns
- **📄 Report Generation**: Generates both JSON and PDF reports
- **🎨 Modern UI**: Clean, responsive interface with real-time progress indication

## 🎯 Assessment Categories

The tool evaluates repositories across 5 categories (0-20 points each):

1. **📚 Documentation Completeness**: README, CONTRIBUTING, AGENTS docs, code comments
2. **📖 Instruction Clarity**: Clear setup instructions, API documentation, usage examples
3. **🔄 Workflow Automation**: CI/CD, automated testing, deployment scripts
4. **🛡️ Risk & Compliance**: Error handling, security considerations, license compliance
5. **🏗️ Integration & Structure**: Code organization, modularity, API design

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- OpenAI API key

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/ai-agent-readiness-assessment.git
   cd ai-agent-readiness-assessment
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your OpenAI API key
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

## 📖 Usage

1. Enter a GitHub repository URL (e.g., `https://github.com/vercel/next.js`)
2. Click "Analyze Repository" to start the assessment
3. View the comprehensive analysis including:
   - Overall readiness score (0-100)
   - Category breakdown with visual progress bars
   - Static analysis results grid
   - Key findings and actionable recommendations
4. Download a professional PDF report

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **AI**: OpenAI GPT-5-nano
- **Analysis**: JSZip for repository processing
- **Reports**: jsPDF for PDF generation
- **Deployment**: Vercel (serverless)

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Manual testing
node dev/test-scripts/test-simple.js
./dev/test-scripts/test-deployed.sh your-app.vercel.app
```

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables (`OPENAI_API_KEY`)
4. Deploy

## 📚 Documentation

- **[Architecture](dev/ARCHITECTURE.md)** - System design and technical details
- **[Development](dev/DEVELOPMENT.md)** - Development process and roadmap
- **[Deployment](dev/DEPLOYMENT.md)** - Deployment instructions and troubleshooting
- **[Testing](dev/TESTING.md)** - Testing strategies and tools
- **[Features](dev/FEATURES.md)** - Complete feature list and capabilities

## 🔧 API Reference

### `POST /api/analyze`
Analyze a GitHub repository for AI agent readiness.

**Request:**
```json
{
  "repoUrl": "https://github.com/username/repository"
}
```

**Response:**
```json
{
  "readinessScore": 85,
  "categories": {
    "documentation": 18,
    "instructionClarity": 16,
    "workflowAutomation": 17,
    "riskCompliance": 15,
    "integrationStructure": 19
  },
  "findings": ["Finding 1", "Finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "staticAnalysis": { /* Static analysis results */ }
}
```

### `POST /api/report`
Generate a PDF report from assessment results.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ for the AI community