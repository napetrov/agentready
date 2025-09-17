#!/bin/bash

# Test script for deployed version
# Usage: ./dev/test-scripts/test-deployed.sh [your-vercel-url]

VERCEL_URL=${1:-"your-app.vercel.app"}
TEST_REPO="https://github.com/vercel/next.js"

echo "🧪 Testing Deployed API"
echo "URL: https://$VERCEL_URL"
echo "Repository: $TEST_REPO"
echo ""

# Test 1: Basic API call
echo "📡 Testing /api/analyze endpoint..."
curl -X POST "https://$VERCEL_URL/api/analyze" \
  -H "Content-Type: application/json" \
  -d "{\"repoUrl\": \"$TEST_REPO\"}" \
  -w "\n\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n" \
  -s

echo ""
echo "✅ Test completed!"
echo ""
echo "If you see a 200 status with JSON data, the API is working correctly."
echo "If you see a 500 status, check the Vercel function logs for errors."