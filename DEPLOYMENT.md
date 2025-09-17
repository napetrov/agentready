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

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging.

## Security

- Never commit API keys to version control
- Use environment variables for all secrets
- Implement rate limiting for public endpoints
- Validate all input URLs
- Sanitize file contents before processing