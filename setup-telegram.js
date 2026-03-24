#!/usr/bin/env node

/**
 * Telegram Bot Setup Helper
 * This script helps you get your Telegram credentials and test the connection
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

console.log('\n🤖 Telegram Bot Setup Helper\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Check if credentials are in .env
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token || token === 'your_telegram_bot_token_here') {
  console.log('❌ TELEGRAM_BOT_TOKEN not configured\n');
  console.log('📝 How to get your Bot Token:\n');
  console.log('1. Open Telegram and search for @BotFather');
  console.log('2. Send: /newbot');
  console.log('3. Follow the prompts to create your bot');
  console.log('4. Copy the token BotFather gives you\n');
  console.log('5. Edit .env file and set:');
  console.log('   TELEGRAM_BOT_TOKEN=your_token_here\n');
  process.exit(1);
}

if (!chatId || chatId === 'your_telegram_chat_id_here') {
  console.log('❌ TELEGRAM_CHAT_ID not configured\n');
  console.log('📝 How to get your Chat ID:\n');
  console.log('Method 1: Using @userinfobot');
  console.log('1. Search for @userinfobot in Telegram');
  console.log('2. Send: /start');
  console.log('3. It will reply with your User ID\n');
  console.log('Method 2: Using your bot');
  console.log('1. Send a message to your bot (any message)');
  console.log('2. Visit: https://api.telegram.org/bot' + token + '/getUpdates');
  console.log('3. Look for "chat":{"id":123456789}');
  console.log('4. That number is your Chat ID\n');
  console.log('5. Edit .env file and set:');
  console.log('   TELEGRAM_CHAT_ID=your_chat_id_here\n');
  process.exit(1);
}

// Test connection
console.log('✅ Credentials found! Testing connection...\n');

const bot = new TelegramBot(token, { polling: false });

async function testConnection() {
  try {
    // Get bot info
    const botInfo = await bot.getMe();
    console.log('✅ Bot connected successfully!');
    console.log(`   Bot name: @${botInfo.username}`);
    console.log(`   Bot ID: ${botInfo.id}\n`);

    // Send test message
    console.log('📤 Sending test message to Chat ID:', chatId, '\n');
    
    const message = `✅ *Telegram Bot Connected!*

🤖 Your trading bot is ready to send notifications.

Bot: @${botInfo.username}
Chat ID: ${chatId}
Time: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC

Everything is working correctly! 🎉`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    console.log('✅ Test message sent successfully!');
    console.log('   Check your Telegram app for the message.\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🎉 Setup complete! You can now run the trading bot:\n');
    console.log('   npm start           (live mode)');
    console.log('   npm run test        (dry-run mode)\n');
    
    process.exit(0);
  } catch (error) {
    console.log('❌ Connection failed!\n');
    console.log('Error:', error.message, '\n');
    
    if (error.message.includes('401')) {
      console.log('💡 This usually means your TELEGRAM_BOT_TOKEN is incorrect.');
      console.log('   Double-check the token from @BotFather.\n');
    } else if (error.message.includes('400') || error.message.includes('chat not found')) {
      console.log('💡 This usually means your TELEGRAM_CHAT_ID is incorrect.');
      console.log('   Make sure you:\n');
      console.log('   1. Sent at least one message to your bot');
      console.log('   2. Used the correct Chat ID (should be a number)\n');
    } else {
      console.log('💡 Check your internet connection and try again.\n');
    }
    
    process.exit(1);
  }
}

testConnection();
