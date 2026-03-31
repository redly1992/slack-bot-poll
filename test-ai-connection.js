'use strict';
require('dotenv').config();

const { createAIClient } = require('./src/aiClient');

async function testConnection() {
  console.log('\n🔌 AI Connection Test');
  console.log('='.repeat(50));

  const provider = process.env.AI_PROVIDER || 'openrouter';
  console.log(`  Provider : ${provider}`);

  let client, model;
  try {
    ({ client, model } = createAIClient());
    console.log(`  Model    : ${model}`);
  } catch (err) {
    console.error(`\n❌ Config error: ${err.message}`);
    console.log('\n💡 Check your .env file:');
    console.log('   AI_PROVIDER=openrouter');
    console.log('   OPENROUTER_API_KEY=sk-or-v1-...');
    console.log('   OPENROUTER_MODEL=deepseek/deepseek-chat');
    process.exit(1);
  }

  console.log('\n⏳ Sending test message...');
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role:    'system',
          content: 'You are a test assistant. Reply with exactly one sentence.',
        },
        {
          role:    'user',
          content: 'Reply with: "AI connection successful." and nothing else.',
        },
      ],
      max_tokens:  32,
      temperature: 0,
    });

    const elapsed = Date.now() - start;
    const reply   = response.choices[0]?.message?.content?.trim() || '(empty)';

    console.log(`\n✅ Connection successful! (${elapsed}ms)`);
    console.log(`  Response : ${reply}`);

    // Show token usage if available
    const usage = response.usage;
    if (usage) {
      console.log(`  Tokens   : ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion`);
    }

    // Show model actually used (OpenRouter may report the routed model)
    const usedModel = response.model;
    if (usedModel && usedModel !== model) {
      console.log(`  Routed to: ${usedModel}`);
    }

  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`\n❌ Connection failed (${elapsed}ms): ${err.message}`);

    if (err.status === 401) {
      console.log('\n💡 Invalid API key — check OPENROUTER_API_KEY in .env');
    } else if (err.status === 404) {
      console.log(`\n💡 Model not found: "${model}"`);
      console.log('   See available models: https://openrouter.ai/models');
    } else if (err.status === 429) {
      console.log('\n💡 Rate limited or insufficient credits');
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('\n💡 No internet connection or API endpoint unreachable');
    }
    process.exit(1);
  }

  console.log('='.repeat(50));
}

testConnection();
