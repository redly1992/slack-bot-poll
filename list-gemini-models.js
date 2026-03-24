#!/usr/bin/env node

/**
 * List all available Gemini models for your API key
 */

require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey || apiKey.includes('your_')) {
  console.log('❌ Please set GEMINI_API_KEY in .env file');
  process.exit(1);
}

console.log('\n📋 Your Available Gemini Models\n');
console.log(`API Key: ${apiKey.substring(0, 20)}...\n`);

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.log('❌ Error:', data.error.message);
      return;
    }
    
    if (!data.models || data.models.length === 0) {
      console.log('❌ No models found');
      return;
    }

    console.log('═══════════════════════════════════════\n');
    console.log(`✅ Found ${data.models.length} models\n`);
    
    // Filter models that support generateContent
    const textModels = data.models.filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    console.log('🤖 TEXT GENERATION MODELS (Good for trading bot):\n');
    
    const recommended = [
      'gemini-2.5-flash',
      'gemini-2.5-pro', 
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-pro-latest'
    ];
    
    textModels.forEach(model => {
      const name = model.name.replace('models/', '');
      const isRecommended = recommended.some(r => name.includes(r));
      const marker = isRecommended ? '⭐' : '  ';
      
      console.log(`${marker} ${name}`);
      
      if (model.displayName) {
        console.log(`   ${model.displayName}`);
      }
      
      if (model.description) {
        const shortDesc = model.description.substring(0, 100);
        console.log(`   ${shortDesc}...`);
      }
      
      console.log('');
    });
    
    console.log('═══════════════════════════════════════\n');
    console.log('🎯 RECOMMENDED FOR TRADING BOT:\n');
    console.log('1. gemini-2.5-flash (current) - Newest, fast, great quality');
    console.log('2. gemini-2.5-pro - Best quality, slower');
    console.log('3. gemini-2.0-flash - Stable, reliable');
    console.log('4. gemini-flash-latest - Auto-updates to newest Flash\n');
    
    console.log('To change model, edit .env:\n');
    console.log('GEMINI_MODEL=gemini-2.5-pro\n');
    
  } catch (error) {
    console.error('❌ Error fetching models:', error.message);
  }
}

listModels();
