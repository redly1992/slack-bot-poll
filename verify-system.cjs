#!/usr/bin/env node

/**
 * Complete System Verification
 * Tests all components of the trading bot
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function runVerification() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   TRADING BOT - SYSTEM CHECK         ║');
  console.log('╚════════════════════════════════════════╝\n');

  const checks = [];

  // Check 1: Environment Variables
  console.log('1️⃣  Checking Environment Variables...\n');

  const requiredEnvVars = {
    'TELEGRAM_BOT_TOKEN': process.env.TELEGRAM_BOT_TOKEN,
    'TELEGRAM_CHAT_ID': process.env.TELEGRAM_CHAT_ID,
    'AI_PROVIDER': process.env.AI_PROVIDER,
    'GEMINI_API_KEY': process.env.GEMINI_API_KEY,
    'GEMINI_MODEL': process.env.GEMINI_MODEL,
  };

  let envCheckPassed = true;
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value || value.includes('your_')) {
      console.log(`   ❌ ${key}: Not set`);
      envCheckPassed = false;
    } else {
      const displayValue = key.includes('KEY') || key.includes('TOKEN') 
        ? value.substring(0, 20) + '...' 
        : value;
      console.log(`   ✅ ${key}: ${displayValue}`);
    }
  }

  checks.push({ name: 'Environment Variables', passed: envCheckPassed });
  console.log('');

  // Check 2: Gemini API
  console.log('2️⃣  Testing Gemini API...\n');

  let geminiCheckPassed = false;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });
    
    const result = await model.generateContent('Say only "OK"');
    const text = result.response.text();
    
    console.log(`   ✅ Gemini API: Working`);
    console.log(`   ✅ Model: ${process.env.GEMINI_MODEL}`);
    console.log(`   ✅ Response: "${text.trim()}"`);
    geminiCheckPassed = true;
  } catch (error) {
    console.log(`   ❌ Gemini API: ${error.message}`);
  }

  checks.push({ name: 'Gemini API', passed: geminiCheckPassed });
  console.log('');

  // Check 3: Telegram Bot
  console.log('3️⃣  Testing Telegram Bot...\n');

  let telegramCheckPassed = false;
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    
    const me = await bot.getMe();
    console.log(`   ✅ Bot Username: @${me.username}`);
    console.log(`   ✅ Bot Name: ${me.first_name}`);
    console.log(`   ✅ Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);
    
    telegramCheckPassed = true;
  } catch (error) {
    console.log(`   ❌ Telegram Bot: ${error.message}`);
  }

  checks.push({ name: 'Telegram Bot', passed: telegramCheckPassed });
  console.log('');

  // Check 4: Exchange API (CCXT)
  console.log('4️⃣  Testing Exchange API (Binance)...\n');

  let exchangeCheckPassed = false;
  try {
    const ccxt = require('ccxt');
    const exchange = new ccxt.binance();
    
    const ticker = await exchange.fetchTicker('BTC/USDT');
    console.log(`   ✅ Exchange: Binance`);
    console.log(`   ✅ BTC/USDT Price: $${ticker.last.toLocaleString()}`);
    console.log(`   ✅ 24h Volume: ${(ticker.baseVolume || 0).toLocaleString()} BTC`);
    
    exchangeCheckPassed = true;
  } catch (error) {
    console.log(`   ❌ Exchange API: ${error.message}`);
  }

  checks.push({ name: 'Exchange API', passed: exchangeCheckPassed });
  console.log('');

  // Check 5: Technical Indicators
  console.log('5️⃣  Testing Technical Indicators...\n');

  let indicatorsCheckPassed = false;
  try {
    const { RSI } = require('technicalindicators');
    
    // Test RSI calculation - need enough data points
    const testData = Array.from({length: 20}, (_, i) => 44 + (i * 0.5));
    const rsi = RSI.calculate({ values: testData, period: 14 });
    
    if (rsi && rsi.length > 0 && rsi[rsi.length - 1]) {
      console.log(`   ✅ RSI calculation: Working`);
      console.log(`   ✅ Sample RSI value: ${rsi[rsi.length - 1].toFixed(2)}`);
      indicatorsCheckPassed = true;
    } else {
      console.log(`   ⚠️  RSI calculation returned empty result`);
    }
  } catch (error) {
    console.log(`   ❌ Technical Indicators: ${error.message}`);
  }

  checks.push({ name: 'Technical Indicators', passed: indicatorsCheckPassed });
  console.log('');

  // Final Summary
  console.log('═══════════════════════════════════════════\n');
  console.log('📊 FINAL REPORT\n');

  const allPassed = checks.every(c => c.passed);
  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  checks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });

  console.log('');
  console.log(`Results: ${passedCount}/${totalCount} checks passed\n`);

  if (allPassed) {
    console.log('🎉 ALL SYSTEMS OPERATIONAL!\n');
    console.log('Your trading bot is ready to use:\n');
    console.log('   • Run test: npm run test');
    console.log('   • Run live: npm start');
    console.log('   • Deploy: Push to GitHub Actions\n');
  } else {
    console.log('⚠️  SOME CHECKS FAILED\n');
    console.log('Please fix the issues above before running the bot.\n');
    console.log('See documentation:');
    console.log('   • README.md - Main guide');
    console.log('   • GEMINI_QUICK_REF.md - Gemini setup');
    console.log('   • TELEGRAM_SETUP.md - Telegram setup\n');
  }

  console.log('═══════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

// Run the verification
runVerification().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
