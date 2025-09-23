/**
 * Deployment debugging script
 * This script helps identify potential deployment issues
 */

const fetch = require('node-fetch');

async function testDeploymentDebug() {
  console.log('🔍 Deployment Debug Test');
  console.log('========================');
  
  // Test 1: Check if the deployment is accessible
  console.log('\n📡 Test 1: Checking deployment accessibility...');
  
  const deploymentUrl = process.env.DEPLOYMENT_URL || 'https://your-deployment.vercel.app';
  
  try {
    const homeResponse = await fetch(deploymentUrl);
    if (!homeResponse.ok) {
      throw new Error(`Deployment not accessible: ${homeResponse.status}`);
    }
    console.log('✅ Deployment is accessible');
  } catch (error) {
    console.log('❌ Deployment not accessible:', error.message);
    console.log('💡 Please set DEPLOYMENT_URL environment variable or update the URL in this script');
    return false;
  }
  
  // Test 2: Test API endpoint
  console.log('\n🔍 Test 2: Testing API endpoint...');
  
  const testCases = [
    {
      name: 'Small Repository',
      data: { inputUrl: 'https://github.com/napetrov/claymore', inputType: 'repository' },
      expectedSuccess: true
    },
    {
      name: 'Website',
      data: { inputUrl: 'https://example.com', inputType: 'website' },
      expectedSuccess: true
    },
    {
      name: 'Invalid URL',
      data: { inputUrl: 'not-a-url', inputType: 'repository' },
      expectedSuccess: false
    },
    {
      name: 'Missing Fields',
      data: { inputUrl: 'https://github.com/test/repo' },
      expectedSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n  Testing ${testCase.name}...`);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${deploymentUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.data)
      });
      
      const duration = Date.now() - startTime;
      const responseText = await response.text();
      
      console.log(`    Status: ${response.status} ${response.statusText}`);
      console.log(`    Duration: ${duration}ms`);
      console.log(`    Response size: ${responseText.length} chars`);
      
      if (testCase.expectedSuccess) {
        if (response.ok) {
          try {
            const data = JSON.parse(responseText);
            console.log(`    ✅ Success: Readiness Score ${data.readinessScore}/100`);
          } catch (parseError) {
            console.log(`    ❌ Invalid JSON response: ${parseError.message}`);
            console.log(`    Response preview: ${responseText.substring(0, 200)}...`);
          }
        } else {
          console.log(`    ❌ Expected success but got error: ${responseText}`);
        }
      } else {
        if (!response.ok) {
          console.log(`    ✅ Expected error: ${responseText}`);
        } else {
          console.log(`    ⚠️ Expected error but got success`);
        }
      }
      
    } catch (error) {
      console.log(`    ❌ Request failed: ${error.message}`);
    }
  }
  
  // Test 3: Test frontend accessibility
  console.log('\n🌐 Test 3: Testing frontend accessibility...');
  
  try {
    const homeResponse = await fetch(deploymentUrl);
    const html = await homeResponse.text();
    
    // Check for common deployment issues
    const issues = [];
    
    if (html.includes('Application error')) {
      issues.push('Application error detected in HTML');
    }
    
    if (html.includes('client-side exception')) {
      issues.push('Client-side exception detected in HTML');
    }
    
    if (html.includes('500 Internal Server Error')) {
      issues.push('500 Internal Server Error detected');
    }
    
    if (html.includes('502 Bad Gateway')) {
      issues.push('502 Bad Gateway detected');
    }
    
    if (html.includes('503 Service Unavailable')) {
      issues.push('503 Service Unavailable detected');
    }
    
    if (html.includes('504 Gateway Timeout')) {
      issues.push('504 Gateway Timeout detected');
    }
    
    if (issues.length > 0) {
      console.log('    ❌ Issues detected:');
      issues.forEach(issue => console.log(`      - ${issue}`));
    } else {
      console.log('    ✅ No obvious issues detected in HTML');
    }
    
    // Check for JavaScript errors
    if (html.includes('script') && !html.includes('error')) {
      console.log('    ✅ JavaScript appears to be loading correctly');
    }
    
  } catch (error) {
    console.log(`    ❌ Frontend test failed: ${error.message}`);
  }
  
  // Test 4: Environment-specific checks
  console.log('\n🔧 Test 4: Environment-specific checks...');
  
  const envChecks = [
    { name: 'NODE_ENV', value: process.env.NODE_ENV, expected: 'production' },
    { name: 'VERCEL', value: process.env.VERCEL, expected: '1' },
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY ? 'Set' : 'Not set', expected: 'Set or Not set' }
  ];
  
  envChecks.forEach(check => {
    console.log(`    ${check.name}: ${check.value}`);
  });
  
  console.log('\n📊 Deployment Debug Summary:');
  console.log('============================');
  console.log('✅ Run this script with your deployment URL to identify issues');
  console.log('💡 Common deployment issues:');
  console.log('  - Serverless function timeout (increase maxDuration in vercel.json)');
  console.log('  - Memory limits (optimize response size)');
  console.log('  - Environment variables missing');
  console.log('  - Build optimization issues');
  console.log('  - CORS issues');
  console.log('  - Network connectivity issues');
  
  return true;
}

// Run the test
testDeploymentDebug().then(success => {
  if (success) {
    console.log('\n🎉 Deployment debug test completed!');
  } else {
    console.log('\n❌ Deployment debug test failed.');
  }
  process.exit(success ? 0 : 1);
});