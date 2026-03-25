#!/usr/bin/env node

/**
 * Price Prediction Quick Test
 * Run this to quickly test your DeepSeek configuration
 */

require('dotenv').config();

console.log('\n🔍 Checking Configuration...\n');

// Check AI Provider
const aiProvider = process.env.AI_PROVIDER || 'not set';
console.log(`✓ AI Provider: ${aiProvider}`);

// Check API Key
let apiKey;
if (aiProvider === 'deepseek') {
  apiKey = process.env.DEEPSEEK_API_KEY;
} else if (aiProvider === 'gemini') {
  apiKey = process.env.GEMINI_API_KEY;
} else if (aiProvider === 'openai') {
  apiKey = process.env.OPENAI_API_KEY;
}

if (!apiKey || apiKey.includes('your_')) {
  console.log(`❌ ${aiProvider.toUpperCase()}_API_KEY not configured`);
  console.log(`\nPlease edit your .env file and set your ${aiProvider.toUpperCase()} API key.\n`);
  process.exit(1);
}

console.log(`✓ API Key: ${apiKey.substring(0, 8)}... (configured)`);

// Check Exchange
const exchange = process.env.EXCHANGE || 'binance';
console.log(`✓ Exchange: ${exchange}`);

console.log('\n✅ Configuration looks good!\n');
console.log('Run prediction:');
console.log('  npm run predict\n');
console.log('Or test a single pair:');
console.log('  node predict-price.js BTC/USDT\n');

process.exit(0);
