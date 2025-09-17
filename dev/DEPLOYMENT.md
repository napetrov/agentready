# Deployment Guide

## Vercel Deployment (Recommended)

### Prerequisites
- GitHub account
- Vercel account
- OpenAI API key

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/ai-agent-readiness-assessment.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Add environment variables:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `GITHUB_TOKEN`: (Optional) GitHub token for private repos
   - Click "Deploy"

3. **Configure Domain** (Optional)
   - In Vercel dashboard, go to Settings > Domains
   - Add your custom domain

## Environment Variables

### Required
- `OPENAI_API_KEY`: Your OpenAI API key for AI assessments

### Optional
- `GITHUB_TOKEN`: GitHub personal access token for private repositories

## Alternative Deployment Options

### Netlify
1. Connect GitHub repository
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in Netlify dashboard

### Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically

### Docker (Self-hosted)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Performance Considerations

- **Function Timeout**: Vercel functions have a 60-second timeout
- **Memory Usage**: Repository analysis can be memory-intensive
- **Rate Limits**: OpenAI API has rate limits
- **File Size**: Large repositories may cause timeouts

## Monitoring

- Use Vercel Analytics for performance monitoring
- Monitor OpenAI API usage and costs
- Set up error tracking (Sentry, LogRocket, etc.)

## ✅ Deployment Status

### Current Status: DEPLOYED ✅
- **Platform**: Vercel
- **Status**: Successfully deployed and running
- **URL**: [Your Vercel deployment URL]
- **Last Updated**: September 17, 2025

### Recent Fixes Applied

1. **GitHub Repository Download Issues** ✅
   - Added fallback branch detection (main → master)
   - Improved error handling for 404 responses
   - Better error messages for debugging

2. **TypeScript Compilation** ✅
   - Fixed JSZip import compatibility
   - Added `allowSyntheticDefaultImports` to tsconfig.json
   - Corrected import paths in API routes

3. **Vercel Configuration** ✅
   - Created required `public/` directory
   - Simplified `vercel.json` configuration
   - Removed deprecated Next.js options

4. **Testing Infrastructure** ✅
   - Added comprehensive test suite with Jest
   - Created unit tests for analyzer and AI assessment
   - Added integration tests for end-to-end validation
   - Created manual test script for validation

### Test Results

```bash
# Run tests
npm test

# Run manual validation
node test-repo-analysis.js

# Test with AI assessment
OPENAI_API_KEY=your_key node test-repo-analysis.js
```

### Known Issues & Solutions

1. **Repository Not Found (404)**
   - **Issue**: Some repositories don't have 'main' branch
   - **Solution**: ✅ Implemented fallback to 'master' branch
   - **Status**: Fixed

2. **API Routes Showing 0 B**
   - **Issue**: Misleading build output
   - **Solution**: ✅ This is normal for serverless functions
   - **Status**: Expected behavior

3. **TypeScript Compilation Errors**
   - **Issue**: JSZip import compatibility
   - **Solution**: ✅ Updated tsconfig.json
   - **Status**: Fixed

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Reduce repository size limit
   - Optimize analysis logic
   - Use streaming for large files

2. **Memory Issues**
   - Process files in chunks
   - Clean up temporary files
   - Increase function memory limit

3. **API Rate Limits**
   - Implement exponential backoff
   - Add request queuing
   - Monitor usage patterns

4. **Repository Access Issues**
   - Check if repository exists and is public
   - Verify branch name (main vs master)
   - Ensure URL format is correct

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging.

### Testing Your Deployment

1. **Basic Functionality Test**
   ```bash
   curl -X POST https://your-app.vercel.app/api/analyze \
     -H "Content-Type: application/json" \
     -d '{"repoUrl": "https://github.com/vercel/next.js"}'
   ```

2. **Frontend Test**
   - Visit your Vercel URL
   - Enter a GitHub repository URL
   - Click "Analyze Repository"
   - Verify results display correctly

3. **Error Handling Test**
   - Try with non-existent repository
   - Try with invalid URL format
   - Verify appropriate error messages

## Security

- Never commit API keys to version control
- Use environment variables for all secrets
- Implement rate limiting for public endpoints
- Validate all input URLs
- Sanitize file contents before processing

## Performance Monitoring

- Monitor Vercel function execution times
- Track OpenAI API usage and costs
- Monitor repository download success rates
- Set up alerts for high error rates