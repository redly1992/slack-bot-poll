#!/usr/bin/env node

/**
 * List all available Gemini models
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey.includes('your_')) {
  console.log('❌ Please set GEMINI_API_KEY in .env file');
  process.exit(1);
}

console.log('\n📋 Your Available Gemini Models\n');
console.log(`API Key: ${apiKey.substring(0, 20)}...\n`);

const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
  console.log('═══════════════════════════════════════\n');
  console.log('📋 Step 1: Testing Standard Model Names\n');
  
  const standardModels = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  for (const modelName of standardModels) {
    try {
      console.log(`Testing: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "test successful"');
      const text = result.response.text();
      console.log(`✅ ${modelName} WORKS! Response: ${text.substring(0, 50)}...\n`);
      return modelName; // Return the working model
    } catch (error) {
      console.log(`❌ ${modelName} - ${error.message.substring(0, 80)}...\n`);
    }
  }

  console.log('═══════════════════════════════════════\n');
  console.log('📋 Step 2: Testing with "models/" Prefix\n');
  
  const prefixedModels = [
    'models/gemini-pro',
    'models/gemini-1.5-pro',
    'models/gemini-1.5-flash',
  ];

  for (const modelName of prefixedModels) {
    try {
      console.log(`Testing: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say "test successful"');
      const text = result.response.text();
      console.log(`✅ ${modelName} WORKS! Response: ${text.substring(0, 50)}...\n`);
      return modelName; // Return the working model
    } catch (error) {
      console.log(`❌ ${modelName} - ${error.message.substring(0, 80)}...\n`);
    }
  }

  console.log('═══════════════════════════════════════\n');
  console.log('📋 Step 3: Trying to List Available Models\n');
  
  try {
    // Try to use the API to list models
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.models && data.models.length > 0) {
      console.log('✅ Found available models:\n');
      data.models.forEach(model => {
        console.log(`  - ${model.name}`);
        if (model.name.includes('generateContent')) {
          console.log(`    ✅ Supports generateContent`);
        }
      });
      
      // Try the first model that supports generateContent
      const firstModel = data.models.find(m => 
        m.supportedGenerationMethods && 
        m.supportedGenerationMethods.includes('generateContent')
      );
      
      if (firstModel) {
        const modelName = firstModel.name.replace('models/', '');
        console.log(`\n🎯 Trying first available model: ${modelName}\n`);
        
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent('Say "test successful"');
          const text = result.response.text();
          console.log(`✅ ${modelName} WORKS! Response: ${text}\n`);
          return modelName;
        } catch (error) {
          console.log(`❌ ${modelName} - ${error.message}\n`);
        }
      }
    } else {
      console.log('❌ No models found or error:', data);
    }
  } catch (error) {
    console.log(`❌ Error listing models: ${error.message}\n`);
  }

  return null;
}

async function main() {
  try {
    const workingModel = await testModels();
    
    console.log('\n═══════════════════════════════════════\n');
    
    if (workingModel) {
      console.log('🎉 SUCCESS!\n');
      console.log(`Working model found: ${workingModel}\n`);
      console.log('Update your .env file:\n');
      console.log(`GEMINI_MODEL=${workingModel}\n`);
    } else {
      console.log('❌ No working models found.\n');
      console.log('Possible solutions:\n');
      console.log('1. Visit https://console.cloud.google.com/apis/library');
      console.log('   Search for "Generative Language API" and ENABLE it\n');
      console.log('2. Create a new API key at https://aistudio.google.com/app/apikey\n');
      console.log('3. Make sure you\'re using a personal Google account,');
      console.log('   not a family shared account\n');
      console.log('4. Check regional availability: https://ai.google.dev/available_regions\n');
      console.log('5. Try using OpenAI instead (see AI_SETUP.md)\n');
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
