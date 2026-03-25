# DeepSeek AI Integration Guide

## Overview

This trading bot now supports **DeepSeek AI** for advanced market analysis and price predictions. DeepSeek provides cost-effective, powerful AI analysis for cryptocurrency trading.

## Setup Instructions

### 1. Get DeepSeek API Key

1. Visit [https://platform.deepseek.com](https://platform.deepseek.com)
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key

### 2. Configure Environment

Edit your `.env` file and set:

```env
# AI Configuration
AI_ENABLED=true
AI_PROVIDER=deepseek

# DeepSeek API Key
DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
```

### 3. Supported AI Providers

The bot now supports three AI providers:

| Provider | Model | Cost | Speed | Best For |
|----------|-------|------|-------|----------|
| **DeepSeek** | deepseek-chat | 💰 Very Low | ⚡ Fast | General trading analysis |
| **DeepSeek** | deepseek-reasoner | 💰 Low | 🐢 Slower | Complex reasoning |
| **Gemini** | gemini-1.5-flash | 🆓 Free | ⚡⚡ Very Fast | Quick analysis |
| **OpenAI** | gpt-4o-mini | 💰💰 Medium | ⚡ Fast | High quality |

## Usage

### Price Prediction Tool

Run price predictions for BTC and ETH:

```bash
npm run predict
```

Or specify custom pairs:

```bash
npm run predict BTC ETH SOL
# or
node predict-price.js BTC/USDT ETH/USDT SOL/USDT
```

### Output Format

The prediction tool provides:

- **Trading Pair**: Cryptocurrency pair name
- **Signal**: BUY / SELL / HOLD
- **Entry Price**: Current entry point
- **Stop Loss**: ATR-based stop loss with risk %
- **Take Profit Levels**: TP1, TP2, TP3 with percentages
- **Confidence Score**: 0-100%
- **Risk Level**: LOW / MEDIUM / HIGH
- **AI Reasoning**: Detailed analysis points
- **Market Analysis**: Summary of market conditions

### Example Output

```
══════════════════════════════════════════════════════════════
📋 TRADING RECOMMENDATION
══════════════════════════════════════════════════════════════

📌 Trading Pair:  BTC/USDT
🎯 Signal:        🟢 BUY
💰 Entry Price:   $67,234.50
🛑 Stop Loss:     $66,890.20 (0.51% risk)
🎯 Take Profit 1: $67,750.80 (+0.77%)
🎯 Take Profit 2: $68,440.50 (+1.79%)
🎯 Take Profit 3: $69,302.10 (+3.08%)

📊 AI Analysis:
   Confidence: 78%
   Risk Level: MEDIUM

💡 Reasoning:
   1. Higher timeframe trend is BULLISH (1D + 4H aligned)
   2. RSI at 45.2 shows oversold condition with room to rise
   3. EMA crossover imminent - Fast EMA approaching Slow EMA
   4. Stochastic %K at 32 indicates potential bounce
   5. Price near lower Bollinger Band - mean reversion setup

📝 Market Analysis:
   Strong bullish trend on higher timeframes with current pullback
   providing good entry opportunity. Technical indicators showing
   oversold conditions with reversal signals forming.
```

## Switching AI Providers

### Switch to DeepSeek (Default)
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
```

### Switch to Gemini
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
```

### Switch to OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

## Strategy.md Integration

The prediction tool follows all guidelines from `instructions/strategy.md`:

- ✅ Higher timeframe trend analysis (1D + 4H)
- ✅ Multi-indicator confirmation (RSI, EMA, MACD, Bollinger, Stochastic)
- ✅ ATR-based stop loss calculation (1.5x ATR)
- ✅ Multiple take profit targets (1:1.5, 1:2.5, 1:4 RR)
- ✅ Risk management principles
- ✅ Trend-aligned signals only
- ✅ AI-enhanced decision making

## Tracked Pairs

Currently tracking:
- **BTC/USDT** - Bitcoin
- **ETH/USDT** - Ethereum

You can add more pairs by passing them as arguments:

```bash
npm run predict BTC ETH BNB SOL ADA
```

## DeepSeek Models

### deepseek-chat (Default)
- Fast general-purpose model
- Best for real-time trading analysis
- Low cost per request

### deepseek-reasoner
- Advanced reasoning capabilities
- Better for complex market scenarios
- Slightly higher cost

To use deepseek-reasoner:
```env
DEEPSEEK_MODEL=deepseek-reasoner
```

## Troubleshooting

### "DEEPSEEK_API_KEY not configured"
Make sure your `.env` file has the actual API key, not the placeholder.

### "Unknown AI provider"
Check that `AI_PROVIDER` is set to one of: `deepseek`, `gemini`, or `openai`

### Rate Limiting
The tool automatically waits 1 second between pair predictions to avoid rate limits.

## Cost Comparison

DeepSeek pricing is very competitive:

| Provider | Cost per 1M tokens | Example cost for 100 predictions |
|----------|-------------------|----------------------------------|
| DeepSeek | $0.14 - $0.28 | $0.05 - $0.10 |
| Gemini | Free (with limits) | $0.00 |
| OpenAI GPT-4o-mini | $0.15 - $0.60 | $0.10 - $0.30 |

## Next Steps

1. ✅ Configure your DeepSeek API key
2. ✅ Run `npm run predict` to test
3. ✅ Review the trading recommendations
4. ✅ Monitor accuracy and adjust strategy
5. ✅ Consider setting up automated alerts

## Support

For issues or questions:
1. Check your API key is valid
2. Verify `.env` configuration
3. Review strategy.md for trading rules
4. Check console output for error messages
