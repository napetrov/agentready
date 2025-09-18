# CI/CD Setup Guide

> **⚠️ DEPRECATED**: This file has been consolidated into the main [README.md](./README.md#development-workflow). Please refer to the main documentation for the most up-to-date information.

# CI/CD Setup Guide

## 🚀 GitHub Actions CI Pipeline

The project includes a comprehensive CI pipeline that runs on every push and pull request to ensure code quality and reliability.

### Pipeline Overview

```yaml
Trigger: Push to main/develop branches, Pull Requests
Matrix: Node.js 18.x, 20.x
Jobs: Test, Build, Security, Integration
```

### CI Jobs

#### 1. Test Suite
- **Node.js Versions**: 18.x, 20.x
- **Steps**:
  - Checkout code
  - Setup Node.js with caching
  - Install dependencies (`npm ci`)
  - Run linting (`npm run lint`)
  - Run type checking (`npx tsc --noEmit`)
  - Run basic tests (`npm test -- __tests__/simple.test.ts`)
  - Run test coverage (`npm run test:coverage`)
  - Upload coverage reports to Codecov

#### 2. Build Check
- **Dependencies**: Runs after test suite passes
- **Steps**:
  - Checkout code
  - Setup Node.js 20.x
  - Install dependencies
  - Build application (`npm run build`)
  - Verify build output structure

#### 3. Security Audit
- **Steps**:
  - Checkout code
  - Setup Node.js 20.x
  - Install dependencies
  - Run security audit (`npm audit`)
  - Check for high-severity vulnerabilities
  - Fail on high-severity issues

#### 4. Integration Test
- **Trigger**: Only on pushes to main branch
- **Dependencies**: Runs after test and build
- **Steps**:
  - Checkout code
  - Setup Node.js 20.x
  - Install dependencies
  - Build application
  - Start application in background
  - Test API endpoints with real requests
  - Cleanup processes

### Test Coverage

- **Target Coverage**: 60% minimum
- **Coverage Reports**: HTML, LCOV, Text
- **Upload**: Automatic upload to Codecov
- **Thresholds**:
  - Branches: 60%
  - Functions: 60%
  - Lines: 60%
  - Statements: 60%

### Environment Variables

The CI pipeline uses the following environment variables:

```yaml
OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY || 'test-key' }}
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN || 'test-token' }}
```

### Pre-commit Hooks

Local development includes pre-commit hooks via Husky:

```bash
# .husky/pre-commit
npm run lint
npx tsc --noEmit
npm test -- --passWithNoTests
```

### Test Strategy

#### Current Tests
- **Basic Functionality**: Module imports, URL validation, error handling
- **Fallback Assessment**: AI assessment fallback with missing data
- **PDF Generation**: Report generation with minimal data
- **Environment Variables**: Configuration validation

#### Test Categories
1. **Unit Tests**: Individual function testing
2. **Integration Tests**: API endpoint testing (main branch only)
3. **Error Handling**: Graceful failure testing
4. **Type Safety**: TypeScript compilation testing

### CI Status Badges

Add these badges to your README:

```markdown
![CI](https://github.com/yourusername/ai-agent-readiness-assessment/workflows/CI%20Pipeline/badge.svg)
![Coverage](https://codecov.io/gh/yourusername/ai-agent-readiness-assessment/branch/main/graph/badge.svg)
```

### Local Development

#### Run CI Locally
```bash
# Run all CI checks
npm run ci

# Run individual checks
npm run lint
npm run type-check
npm test
npm run test:coverage
```

#### Pre-commit Setup
```bash
# Install husky
npm install

# Setup pre-commit hooks
npm run prepare
```

### Troubleshooting

#### Common Issues

1. **Test Failures**
   - Check environment variables
   - Verify all dependencies are installed
   - Run tests locally first

2. **Build Failures**
   - Check TypeScript compilation errors
   - Verify all imports are correct
   - Check for missing dependencies

3. **Security Audit Failures**
   - Review vulnerability reports
   - Update dependencies if needed
   - Use `npm audit fix` for automatic fixes

4. **Coverage Failures**
   - Add more tests to increase coverage
   - Check coverage thresholds
   - Review uncovered code paths

### Future Enhancements

#### Planned Improvements
- [ ] Add E2E tests with Playwright
- [ ] Performance testing
- [ ] Load testing for API endpoints
- [ ] Database testing (when added)
- [ ] Cross-browser testing

#### Advanced CI Features
- [ ] Parallel test execution
- [ ] Test result caching
- [ ] Artifact storage
- [ ] Deployment automation
- [ ] Notification integration

### Monitoring

#### CI Metrics
- Build success rate
- Test execution time
- Coverage trends
- Security vulnerability count
- Deployment frequency

#### Alerts
- Failed builds
- Security vulnerabilities
- Coverage drops
- Performance regressions

### Best Practices

1. **Keep Tests Fast**: Aim for < 5 minutes total CI time
2. **Reliable Tests**: Avoid flaky tests that fail randomly
3. **Clear Failures**: Make test failures easy to debug
4. **Coverage Goals**: Maintain meaningful coverage metrics
5. **Security First**: Always address security vulnerabilities
6. **Documentation**: Keep CI setup documented and up-to-date

This CI setup ensures code quality, reliability, and security while providing fast feedback to developers.