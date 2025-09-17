# AI Agent Readiness Assessment Tool

An MVP tool for assessing GitHub repositories' readiness for AI agent interaction and automation.

## Features

- **Static Analysis**: Automatically detects documentation, CI/CD workflows, tests, and error handling
- **AI Assessment**: Uses OpenAI GPT-4 to evaluate repository readiness across 5 key categories
- **Report Generation**: Generates both JSON and PDF reports
- **Web Interface**: Clean, responsive UI for easy repository analysis

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local and add your OpenAI API key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Navigate to `http://localhost:3000`

## Usage

1. Enter a GitHub repository URL (e.g., `https://github.com/username/repository`)
2. Click "Analyze Repository"
3. View the assessment results including:
   - Overall readiness score (0-100)
   - Category breakdown (Documentation, Instructions, Workflows, etc.)
   - Static analysis results
   - Key findings and recommendations
4. Download a PDF report

## Assessment Categories

The tool evaluates repositories across 5 categories (0-20 points each):

1. **Documentation Completeness**: README, CONTRIBUTING, AGENTS docs, code comments
2. **Instruction Clarity**: Clear setup instructions, API documentation, usage examples
3. **Workflow Automation Potential**: CI/CD, automated testing, deployment scripts
4. **Risk & Compliance**: Error handling, security considerations, license compliance
5. **Integration & Structure**: Code organization, modularity, API design

## API Endpoints

- `POST /api/analyze` - Analyze a GitHub repository
- `POST /api/report` - Generate PDF report

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4
- **Analysis**: JSZip for repository processing
- **Reports**: jsPDF for PDF generation

## Development

### Project Structure

```
/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── lib/                   # Core libraries
│   ├── analyzer.ts        # Static analysis
│   ├── ai-assessment.ts   # AI assessment logic
│   └── report-generator.ts # PDF generation
└── public/                # Static assets
```

### Adding New Analysis Features

1. Extend the `StaticAnalysisResult` interface in `lib/analyzer.ts`
2. Add detection logic in the `analyzeRepository` function
3. Update the AI prompt in `lib/ai-assessment.ts` to include new data
4. Update the UI in `app/page.tsx` to display new findings

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details