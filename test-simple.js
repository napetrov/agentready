#!/usr/bin/env node

/**
 * Simple test to validate the API endpoint works
 * Run with: node test-simple.js
 */

const https = require('https')

async function testAPI() {
  console.log('🧪 Testing API Endpoint\n')
  
  const testData = {
    repoUrl: 'https://github.com/vercel/next.js'
  }
  
  const postData = JSON.stringify(testData)
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/analyze',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }
  
  console.log('📡 Testing local API endpoint...')
  console.log('URL:', `http://${options.hostname}:${options.port}${options.path}`)
  console.log('Data:', testData)
  
  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`)
    console.log(`Headers:`, res.headers)
    
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data)
        console.log('\n✅ API Response:')
        console.log(JSON.stringify(result, null, 2))
      } catch (error) {
        console.log('\n❌ Failed to parse response:')
        console.log('Raw response:', data)
      }
    })
  })
  
  req.on('error', (error) => {
    console.log('\n❌ Request failed:', error.message)
    console.log('Make sure the development server is running: npm run dev')
  })
  
  req.write(postData)
  req.end()
}

// Run the test
testAPI().catch(console.error)