// Test AI communication directly with the same setup as the app
require('dotenv').config({ path: '.env.local' });

const OpenAI = require('openai');

async function testAIDirect() {
  console.log('🔧 Testing AI Communication Directly...');
  console.log('API Key length:', process.env.OPENAI_API_KEY?.length || 0);
  console.log('API Key starts with:', process.env.OPENAI_API_KEY?.substring(0, 10) || 'undefined');
  
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
    console.log('❌ No valid API key found');
    return;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000
  });

  const testPrompt = `Instruction Clarity Analysis

Repository Documentation:
- Has README: true
- Has AGENTS.md: true
- Has CONTRIBUTING: true
- Primary Languages: C++, Markdown, Python

Documentation Content:

README Content: # oneAPI Data Analytics Library MySQL* Samples

MySQL* samples for the oneAPI Data Analytics Library (oneDAL) are designed to show how to use this library with a MySQL database in a C++ application.

AGENTS Content: # Examples - AI Agents Context

> **Purpose**: Context for AI agents working with oneDAL example patterns demonstrating dual C++ interface usage.

Please analyze the instruction clarity and provide a JSON response with the following structure:
{
  "stepByStepQuality": <number 0-20>,
  "commandClarity": <number 0-20>,
  "environmentSetup": <number 0-20>,
  "errorHandling": <number 0-20>,
  "dependencySpecification": <number 0-20>,
  "findings": [<array of strings>],
  "recommendations": [<array of strings>],
  "confidence": <number 0-100>
}`;

  try {
    console.log('📤 Sending request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are an expert in software documentation analysis. Analyze the provided repository documentation and return a JSON response with the exact structure requested.'
        },
        {
          role: 'user',
          content: testPrompt
        }
      ],
    });

    console.log('📥 Response received:');
    console.log('Response structure:', {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length || 0,
      hasContent: !!response.choices?.[0]?.message?.content,
      contentLength: response.choices?.[0]?.message?.content?.length || 0
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('📄 Raw AI Response:');
    console.log('='.repeat(80));
    console.log(content);
    console.log('='.repeat(80));

    try {
      const parsed = JSON.parse(content);
      console.log('✅ Successfully parsed JSON:');
      console.log('Keys:', Object.keys(parsed));
      console.log('Full parsed object:', JSON.stringify(parsed, null, 2));
      
      // Check for required fields
      const requiredFields = ['stepByStepQuality', 'commandClarity', 'environmentSetup', 'errorHandling', 'dependencySpecification'];
      const missingFields = requiredFields.filter(field => !(field in parsed));
      const invalidFields = requiredFields.filter(field => 
        field in parsed && (typeof parsed[field] !== 'number' || isNaN(parsed[field]))
      );
      
      console.log('🔍 Field validation:');
      console.log('Missing fields:', missingFields);
      console.log('Invalid fields:', invalidFields);
      console.log('All required fields present:', missingFields.length === 0 && invalidFields.length === 0);
      
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError.message);
      console.log('Raw content that failed to parse:');
      console.log('='.repeat(80));
      console.log(content);
      console.log('='.repeat(80));
    }

  } catch (error) {
    console.error('❌ OpenAI API Error:', error.message);
    if (error.status) {
      console.error('Status:', error.status);
    }
    if (error.code) {
      console.error('Code:', error.code);
    }
    console.error('Full error:', error);
  }
}

testAIDirect().catch(console.error);