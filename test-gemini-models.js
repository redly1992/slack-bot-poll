#!/usr/bin/env node

/**
 * Test Gemini API and list available models
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey.includes('your_')) {
  console.log('❌ Please set GEMINI_API_KEY in .env file');
  process.exit(1);
}

console.log('\n🔍 Testing Gemini API...\n');
console.log(`API Key: ${apiKey.substring(0, 20)}...`);

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // Try different model names
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-2.0-flash-exp',
      'models/gemini-pro',
      'models/gemini-1.5-pro',
      'models/gemini-1.5-flash'
    ];

    console.log('Testing available models:\n');
    
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Test');
        console.log(`✅ ${modelName} - WORKS!`);
      } catch (error) {
        if (error.message.includes('404')) {
          console.log(`❌ ${modelName} - Not found`);
        } else if (error.message.includes('429')) {
          console.log(`⚠️  ${modelName} - Rate limit (but model exists!)`);
        } else {
          console.log(`❌ ${modelName} - Error: ${error.message.substring(0, 50)}...`);
        }
      }
    }

    console.log('\n✅ Test complete!');
    console.log('\nUse the model name that WORKS in your .env file:');
    console.log('GEMINI_MODEL=model_name_here\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listModels();
