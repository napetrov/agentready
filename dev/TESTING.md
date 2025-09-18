# Testing Guide

> **⚠️ DEPRECATED**: This file has been consolidated into the main [README.md](./README.md#testing). Please refer to the main documentation for the most up-to-date information.

# Testing Guide

## ✅ Issues Fixed

### 1. GitHub Repository Download Issues
- **Problem**: 404 errors when trying to download repositories
- **Root Cause**: Some repositories use 'master' instead of 'main' branch
- **Solution**: ✅ Implemented fallback branch detection (main → master)
- **Status**: Fixed

### 2. Error Handling Improvements
- **Problem**: Generic error messages made debugging difficult
- **Solution**: ✅ Preserved original error messages in catch blocks
- **Status**: Fixed

### 3. TypeScript Compilation
- **Problem**: JSZip import compatibility issues
- **Solution**: ✅ Added `allowSyntheticDefaultImports` to tsconfig.json
- **Status**: Fixed

## 🧪 Test Suite

### Basic Tests (Passing ✅)
```bash
npm test -- __tests__/basic.test.ts
```

Tests core functionality:
- Module imports work correctly
- URL validation works
- Error handling structure is proper

### Manual Testing

#### 1. Local Development Server
```bash
# Start development server
npm run dev

# Test API endpoint
node test-simple.js
```

#### 2. Deployed Version
```bash
# Test deployed API
./test-deployed.sh your-app.vercel.app

# Or with curl directly
curl -X POST "https://your-app.vercel.app/api/analyze" \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/vercel/next.js"}'
```

#### 3. Frontend Testing
1. Visit your Vercel deployment URL
2. Enter a GitHub repository URL (e.g., `https://github.com/vercel/next.js`)
3. Click "Analyze Repository"
4. Verify results display correctly

## 🔍 Test Repositories

### Recommended Test Repositories
- `https://github.com/vercel/next.js` - Well-documented, has all features
- `https://github.com/facebook/react` - Large, complex repository
- `https://github.com/microsoft/vscode` - Enterprise-level repository

### Test Cases
1. **Well-documented repository** - Should score high
2. **Minimal repository** - Should score low with recommendations
3. **Non-existent repository** - Should show appropriate error
4. **Invalid URL format** - Should show validation error

## 🐛 Known Issues & Solutions

### 1. Repository Not Found (404)
- **Cause**: Repository doesn't exist or is private
- **Solution**: ✅ Implemented fallback branch detection
- **Test**: Try with `https://github.com/nonexistent/repo`

### 2. API Timeout
- **Cause**: Large repositories take time to download
- **Solution**: 60-second timeout configured in Vercel
- **Test**: Try with very large repositories

### 3. OpenAI API Errors
- **Cause**: Invalid API key or rate limits
- **Solution**: ✅ Fallback to static analysis only
- **Test**: Set invalid API key in environment

## 📊 Expected Results

### High-Scoring Repository (80+)
- Has README.md, CONTRIBUTING.md, LICENSE
- Has CI/CD workflows
- Has comprehensive tests
- Good error handling
- Clear documentation

### Low-Scoring Repository (40-)
- Missing documentation
- No CI/CD setup
- No tests
- Poor error handling
- Unclear structure

## 🚀 Deployment Validation

### Pre-Deployment Checklist
- [ ] All tests pass locally
- [ ] Build completes without errors
- [ ] Environment variables configured
- [ ] API endpoints respond correctly

### Post-Deployment Checklist
- [ ] Frontend loads correctly
- [ ] API accepts valid requests
- [ ] Error handling works
- [ ] PDF generation works
- [ ] Real repository analysis works

## 🔧 Debugging

### Check Vercel Function Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to Functions tab
4. Click on function execution
5. View logs for errors

### Common Error Messages
- `Repository not found` - Repository doesn't exist or is private
- `Invalid GitHub repository URL format` - URL format is incorrect
- `Failed to analyze repository` - Generic error, check logs
- `AuthenticationError` - OpenAI API key issue

### Environment Variables
Make sure these are set in Vercel:
- `OPENAI_API_KEY` - Your OpenAI API key
- `GITHUB_TOKEN` - Optional, for private repositories

## 📈 Performance Monitoring

### Metrics to Watch
- Function execution time
- Memory usage
- Error rates
- OpenAI API usage

### Optimization Tips
- Large repositories may timeout
- Consider implementing caching
- Monitor API rate limits
- Set up error alerts

## ✅ Success Criteria

The application is working correctly when:
1. ✅ Frontend loads and displays correctly
2. ✅ API accepts GitHub URLs and returns analysis
3. ✅ Error handling works for invalid inputs
4. ✅ PDF reports generate successfully
5. ✅ Real repository analysis produces meaningful results
6. ✅ Deployment is stable and accessible

## 🎯 Next Steps

1. **Monitor Performance** - Watch Vercel function metrics
2. **User Feedback** - Collect feedback on analysis quality
3. **Feature Enhancements** - Add more analysis categories
4. **Optimization** - Improve performance for large repositories
5. **Error Tracking** - Set up proper error monitoring