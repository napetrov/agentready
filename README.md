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
- **⚡ Fast & Reliable**: Optimized for performance with robust error handling

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

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-agent-readiness-assessment.git
   cd ai-agent-readiness-assessment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your OpenAI API key
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to `http://localhost:3000`

## 📖 Usage

1. **Enter Repository URL**: Input a GitHub repository URL (e.g., `https://github.com/vercel/next.js`)
2. **Analyze**: Click "Analyze Repository" to start the assessment
3. **View Results**: See the comprehensive analysis including:
   - Overall readiness score (0-100)
   - Category breakdown with visual progress bars
   - Static analysis results grid
   - Key findings and actionable recommendations
4. **Download Report**: Generate and download a professional PDF report

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **AI**: OpenAI GPT-5-nano
- **Analysis**: JSZip for repository processing
- **Reports**: jsPDF for PDF generation
- **Deployment**: Vercel (serverless)

## 📁 Project Structure

```
/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── analyze/       # Repository analysis endpoint
│   │   └── report/        # PDF generation endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main UI component
├── lib/                   # Core libraries
│   ├── analyzer.ts        # Static analysis engine
│   ├── ai-assessment.ts   # AI assessment logic
│   └── report-generator.ts # PDF generation
├── dev/                   # Development documentation
│   ├── ARCHITECTURE.md    # System architecture
│   ├── DEVELOPMENT.md     # Development process
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── TESTING.md         # Testing guide
└── public/                # Static assets
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/basic.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Manual Testing
```bash
# Test local API
node test-simple.js

# Test deployed version
./test-deployed.sh your-app.vercel.app
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
   - Click "Deploy"

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 📚 Documentation

- **[Architecture Guide](dev/ARCHITECTURE.md)** - System design and technical details
- **[Development Guide](dev/DEVELOPMENT.md)** - Development process and roadmap
- **[Deployment Guide](dev/DEPLOYMENT.md)** - Deployment instructions and troubleshooting
- **[Testing Guide](dev/TESTING.md)** - Testing strategies and tools

## 🔧 API Reference

### Endpoints

#### `POST /api/analyze`
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
  "staticAnalysis": {
    "hasReadme": true,
    "hasContributing": true,
    "hasAgents": false,
    "hasLicense": true,
    "hasWorkflows": true,
    "hasTests": true,
    "languages": ["TypeScript", "JavaScript"],
    "errorHandling": true
  }
}
```

#### `POST /api/report`
Generate a PDF report from assessment results.

**Request:**
```json
{
  "result": { /* AssessmentResult object */ }
}
```

**Response:** PDF file download

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for the GPT-5-nano API
- Vercel for hosting and deployment
- Next.js team for the amazing framework
- All contributors and testers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-agent-readiness-assessment/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ai-agent-readiness-assessment/discussions)
- **Email**: support@example.com

---

Made with ❤️ for the AI community