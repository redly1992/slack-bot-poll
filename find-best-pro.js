#!/usr/bin/env node

/**
 * Find best available Gemini Pro model
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;

console.log('\n🔍 Finding Best Available Pro Model\n');

const proModels = [
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview', 
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-2.0-flash', // fallback
];

async function testModel(modelName) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent('Say only "OK"');
    const text = result.response.text();
    
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message.substring(0, 100) };
  }
}

async function findBest() {
  for (const modelName of proModels) {
    console.log(`Testing: ${modelName}...`);
    
    const result = await testModel(modelName);
    
    if (result.success) {
      console.log(`✅ ${modelName} - WORKS!`);
      console.log(`   Response: "${result.text}"\n`);
      
      console.log('═══════════════════════════════════════\n');
      console.log(`🎉 Best available model: ${modelName}\n`);
      console.log('Update your .env file:\n');
      console.log(`GEMINI_MODEL=${modelName}\n`);
      
      return modelName;
    } else {
      if (result.error.includes('429') || result.error.includes('quota')) {
        console.log(`❌ ${modelName} - Requires paid tier\n`);
      } else {
        console.log(`❌ ${modelName} - ${result.error}\n`);
      }
    }
  }
  
  console.log('No Pro models available in free tier.\n');
  return null;
}

findBest();
