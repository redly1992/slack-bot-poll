#!/usr/bin/env node

/**
 * Test Gemini 3.1 Pro Preview
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const modelName = 'gemini-3.1-pro-preview';

console.log('\n🧪 Testing Gemini 3.1 Pro Preview\n');
console.log(`API Key: ${apiKey.substring(0, 20)}...`);
console.log(`Model: ${modelName}\n`);

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    console.log('Test 1: Simple response...');
    const result1 = await model.generateContent('Say only "Gemini 3.1 Pro is working"');
    const text1 = result1.response.text();
    console.log(`✅ Response: "${text1}"\n`);
    
    console.log('Test 2: Trading analysis...');
    const result2 = await model.generateContent('In one sentence, explain what makes a good BUY signal in cryptocurrency trading.');
    const text2 = result2.response.text();
    console.log(`✅ Analysis: "${text2}"\n`);
    
    console.log('═══════════════════════════════════════\n');
    console.log('🎉 Gemini 3.1 Pro Preview is WORKING!\n');
    console.log('This is the most advanced experimental model.');
    console.log('It has the best reasoning capabilities.\n');
    
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
    
    if (error.message.includes('not found') || error.message.includes('404')) {
      console.log('Model not available. Trying alternatives...\n');
      
      // Try with models/ prefix
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'models/gemini-3.1-pro-preview' });
        const result = await model.generateContent('Say "OK"');
        const text = result.response.text();
        console.log(`✅ Working with prefix: models/gemini-3.1-pro-preview`);
        console.log(`✅ Response: "${text}"\n`);
        console.log('Update your .env:\n');
        console.log('GEMINI_MODEL=models/gemini-3.1-pro-preview\n');
      } catch (err2) {
        console.log(`❌ Also failed: ${err2.message}\n`);
      }
    }
  }
}

test();
