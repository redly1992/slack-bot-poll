'use strict';
/**
 * Shared AI client factory.
 *
 * Reads AI_PROVIDER from the environment and returns a configured
 * { client, model } object ready for chat-completion calls.
 *
 * Supported providers (set AI_PROVIDER in .env):
 *   openrouter  — https://openrouter.ai  (default; easy model switching)
 *   deepseek    — https://api.deepseek.com
 *   openai      — https://api.openai.com
 *
 * OpenRouter model strings: "deepseek/deepseek-chat", "anthropic/claude-3.5-sonnet",
 *   "openai/gpt-4o", "google/gemini-2.0-flash-exp:free", etc.
 *   Full list: https://openrouter.ai/models
 */

const OpenAI = require('openai');

function createAIClient() {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      throw new Error('OPENROUTER_API_KEY not configured in .env');
    }
    return {
      client: new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/trading-bot',
          'X-Title': 'Trading Bot',
        },
      }),
      model:    process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
      provider: 'openrouter',
    };
  }

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      throw new Error('DEEPSEEK_API_KEY not configured in .env');
    }
    return {
      client: new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      }),
      model:    process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      provider: 'deepseek',
    };
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) {
      throw new Error('OPENAI_API_KEY not configured in .env');
    }
    return {
      client: new OpenAI({ apiKey }),
      model:    process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provider: 'openai',
    };
  }

  throw new Error(
    `Unknown AI_PROVIDER="${provider}". Supported: openrouter, deepseek, openai`
  );
}

/**
 * Returns `{ provider, apiKey, model }` suitable for `new AIAnalyzer(config)`.
 * Reads AI_PROVIDER from the environment.
 */
function resolveAIConfig() {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) throw new Error('OPENROUTER_API_KEY not configured in .env');
    return { provider, apiKey, model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat' };
  }
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) throw new Error('DEEPSEEK_API_KEY not configured in .env');
    return { provider, apiKey, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' };
  }
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) throw new Error('OPENAI_API_KEY not configured in .env');
    return { provider, apiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' };
  }
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.startsWith('your_')) throw new Error('GEMINI_API_KEY not configured in .env');
    return { provider, apiKey, model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' };
  }

  throw new Error(`Unknown AI_PROVIDER="${provider}". Supported: openrouter, deepseek, openai, gemini`);
}

module.exports = { createAIClient, resolveAIConfig };
