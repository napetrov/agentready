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
- Comprehensive test coverage with 93 passing tests
- OpenAI API mocking system for reliable testing
- TypeScript error fixes and improved type safety
- **CRITICAL**: Coherent assessment system ensuring consistent metrics across all analysis blocks
- **NEW**: Business-type-aware assessment system with 15 industry configurations
- **NEW**: AI-relevant assessment criteria focusing on agent usability
- **NEW**: 5 agentic flows with business-specific importance weights
- **NEW**: Enhanced SSRF protection with comprehensive IP range filtering
- **NEW**: DNS-level security validation for website analysis
- **NEW**: Word-boundary regex for improved business type detection accuracy
- **NEW**: Extensionless file detection (Dockerfile, Makefile, etc.)
- **NEW**: Debug flag gating for production logging control
- Website-specific scoring algorithms that align with agentic flow analysis
- Unified key findings generation based on actual analysis context (website vs repository)

### Changed
- Improved contributor/agent guidance by centralizing rules and linking architecture/development docs
- **UPDATED**: `dev/DEVELOPMENT.md` with comprehensive progress log documenting business-type-aware assessment system implementation
- **IMPROVED**: Overall score scaling from 0-20 to 0-100 for better user understanding
- **ENHANCED**: AI value handling to properly treat zero scores as valid data points
- **REFINED**: Meta description validation to trim whitespace before truthy checks
- **EXPANDED**: AI readiness insights to include all 5 agentic flows (taskManagement and personalization)
- **OPTIMIZED**: API response payload by limiting findings/recommendations to top 10 items
- **HARDENED**: Security validation with comprehensive SSRF protection and DNS-level checks
- **CRITICAL FIX**: Overall readiness score now correctly uses business-type-aware scoring instead of legacy unified metrics
- Improved UI layout by combining separate status and debug sections
- Enhanced error messages with more detailed debugging information
- Updated test configuration to use proper API key validation
- Streamlined frontend display logic for better user experience

### Fixed
- **CRITICAL**: Fixed overall readiness score discrepancy where business-type-aware scores (80-100) were being overridden by legacy unified metrics (8) causing incorrect "Needs improvement" ratings
- **TYPESCRIPT**: Fixed type signature for `createUnifiedMetric` to properly handle `undefined` AI values
- Documentation gaps for agent onboarding and change management
- TypeScript compilation errors related to missing `aiAnalysisStatus` property
- **CRITICAL**: Fixed major inconsistency where website analysis showed repository-focused key findings
- Fixed misalignment between detailed flow analysis scores and overall assessment scores
- Fixed key findings showing "README.md", "AGENTS.md", "CI/CD workflows" for website analysis instead of website-specific issues
- Fixed scoring inconsistencies between static analysis and AI analysis for websites
- Fixed agentic flow analysis not being properly integrated with overall scoring system
- **MAJOR**: Redesigned website analysis system to be business-type-aware (food_service, hospitality, travel, healthcare, etc.)
- **MAJOR**: Removed irrelevant checks (mobile optimization, accessibility, SEO, page load speed) that don't help AI agents
- **MAJOR**: Implemented 5 agentic flows with business-type-specific weights and requirements
- **MAJOR**: Created comprehensive business type detection with 15 different business categories
- **MAJOR**: Replaced generic website analysis with AI-relevant checks only (structured data, contact info, content accessibility)
- **MAJOR**: Implemented weighted scoring system based on business type priorities
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