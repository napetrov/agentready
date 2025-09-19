# Changelog

All notable changes to the AI Agent Readiness Assessment Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- [`.cursorrules`](.cursorrules) with Cursor-recommended instructions for Vercel/Next.js/TypeScript/Node workflows
- [`AGENTS.md`](AGENTS.md) documenting agent operating procedure and links to [`dev/ARCHITECTURE.md`](dev/ARCHITECTURE.md) and [`dev/DEVELOPMENT.md`](dev/DEVELOPMENT.md)
- AI Analysis Status tracking with comprehensive status indicators
- Enhanced error handling and debugging information display
- Conditional debug information that only shows when issues are detected
- Combined AI Analysis Status and Debug Information sections for better UX
- Comprehensive test coverage with 62 passing tests
- OpenAI API mocking system for reliable testing
- TypeScript error fixes and improved type safety

### Changed
- Improved contributor/agent guidance by centralizing rules and linking architecture/development docs
- Improved UI layout by combining separate status and debug sections
- Enhanced error messages with more detailed debugging information
- Updated test configuration to use proper API key validation
- Streamlined frontend display logic for better user experience

### Fixed
- Documentation gaps for agent onboarding and change management
- TypeScript compilation errors related to missing `aiAnalysisStatus` property
- OpenAI API mocking issues that were causing test failures
- CI pipeline failures due to improper test configuration
- Debug information display logic to only show when needed
- Test expectations to match updated error message formats

### Technical Improvements
- Added `__mocks__/openai.js` for consistent API mocking across all tests
- Updated Jest configuration for better test reliability
- Enhanced error handling in both frontend and backend
- Improved type safety with proper interface definitions
- Better separation of concerns between UI components

## [0.1.0] - 2024-01-XX

### Added
- Initial release of AI Agent Readiness Assessment Tool
- Static analysis engine for repository evaluation
- AI-powered assessment using OpenAI GPT models
- PDF report generation with comprehensive results
- Web interface for repository analysis
- Support for GitHub repository analysis
- File size analysis and agent compatibility scoring
- Context consumption analysis for instruction files
- Comprehensive test suite with Jest
- Vercel deployment configuration

### Features
- Repository URL input and validation
- Real-time analysis progress indication
- Score visualization with progress bars
- Category breakdown display
- Key findings and recommendations
- PDF download functionality
- Responsive design with Tailwind CSS
- Error handling and fallback mechanisms
- Debug information display
- API endpoints for analysis and report generation

### Technical Stack
- Next.js 14 with App Router
- TypeScript with strict typing
- Tailwind CSS for styling
- OpenAI API integration
- JSZip for file processing
- jsPDF for report generation
- Jest for testing
- Vercel for deployment