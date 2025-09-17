#!/usr/bin/env node

/**
 * Simple test to validate the API endpoint works
 * Run with: node dev/test-scripts/test-simple.js
 */

const http = require('http')

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
  
  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`)
    console.log(`Headers:`, res.headers)
    
    // Set encoding to handle string data properly
    res.setEncoding('utf8')
    
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const result = JSON.parse(data)
          console.log('\n✅ API Response:')
          console.log(JSON.stringify(result, null, 2))
        } catch (error) {
          console.log('\n❌ Failed to parse response:')
          console.log('Parse error:', error.message)
          console.log('Raw response:', data)
        }
      } else {
        console.log('\n❌ API returned error status:', res.statusCode)
        console.log('Response body:', data)
      }
    })
  })
  
  // Set timeout and handle timeout
  req.setTimeout(10000, () => {
    console.log('\n❌ Request timed out after 10 seconds')
    req.destroy()
  })
  
  req.on('timeout', () => {
    console.log('\n❌ Request timed out')
    req.destroy()
  })
  
  req.on('error', (error) => {
    console.log('\n❌ Request failed:', error.message)
    if (error.stack) {
      console.log('Error stack:', error.stack)
    }
    console.log('Make sure the development server is running: npm run dev')
  })
  
  req.write(postData)
  req.end()
}

// Run the test
testAPI().catch(console.error)