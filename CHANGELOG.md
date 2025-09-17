# Changelog

All notable changes to the AI Agent Readiness Assessment Tool will be documented in this file.

## [1.1.0] - 2025-09-17

### Fixed
- **OpenAI API Temperature Issue**: Fixed GPT-5-nano compatibility by removing unsupported temperature parameter
- **GitHub Repository Download**: Added fallback branch detection (main → master) to handle repositories without main branch
- **Error Handling**: Improved error messages and preserved original error details for better debugging
- **TypeScript Compilation**: Fixed JSZip import compatibility issues with `allowSyntheticDefaultImports`

### Added
- **Comprehensive Documentation**: Created detailed architecture and development guides
- **Testing Infrastructure**: Added Jest test suite with basic functionality tests
- **Manual Testing Tools**: Created scripts for local and deployed testing
- **Development Documentation**: Organized documentation in `dev/` folder with:
  - `ARCHITECTURE.md` - System design and technical details
  - `DEVELOPMENT.md` - Development process and roadmap
  - `DEPLOYMENT.md` - Deployment guide and troubleshooting
  - `TESTING.md` - Testing strategies and tools

### Improved
- **Error Messages**: More descriptive error messages for better debugging
- **Code Organization**: Better structured codebase with clear separation of concerns
- **Documentation**: Comprehensive README with usage examples and API reference
- **Deployment**: Streamlined Vercel deployment configuration

### Technical Details
- **Model**: Updated to use GPT-5-nano (removed temperature parameter)
- **Branch Detection**: Automatic fallback from 'main' to 'master' branch
- **Error Handling**: Preserved original error messages in catch blocks
- **TypeScript**: Added `allowSyntheticDefaultImports` for JSZip compatibility

## [1.0.0] - 2025-09-17

### Initial Release
- **Core Features**: Repository analysis, AI assessment, PDF report generation
- **Static Analysis**: Documentation detection, workflow analysis, test detection
- **AI Assessment**: 5-category scoring system with GPT-5-nano integration
- **Frontend**: Modern React UI with Tailwind CSS
- **Backend**: Next.js API routes with TypeScript
- **Deployment**: Vercel serverless deployment
- **Testing**: Basic test suite and manual testing tools

### Features
- GitHub repository URL input and validation
- Static analysis of documentation, workflows, tests, and error handling
- AI-powered assessment across 5 categories (0-20 points each)
- Overall readiness score (0-100)
- Key findings and actionable recommendations
- PDF report generation and download
- Responsive web interface
- Real-time progress indication
- Comprehensive error handling

### Technology Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **AI**: OpenAI GPT-5-nano
- **Analysis**: JSZip for repository processing
- **Reports**: jsPDF for PDF generation
- **Deployment**: Vercel (serverless)
- **Testing**: Jest

---

## Development Notes

### Known Issues
- Large repositories may timeout (60-second Vercel limit)
- OpenAI API rate limits may affect high-volume usage
- Memory usage could be optimized for very large repositories

### Future Enhancements
- Caching layer for repeated analyses
- Multiple AI model support
- Batch processing capabilities
- User authentication and history
- Advanced analytics and reporting
- Performance optimizations

### Breaking Changes
None in this release.

### Migration Guide
No migration required for this release.