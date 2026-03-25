# 🚀 Quick Start - Price Prediction with DeepSeek

## 1️⃣ Setup (One Time)

Edit `.env` file:
```env
AI_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-actual-key-here
DEEPSEEK_MODEL=deepseek-chat
```

## 2️⃣ Run Predictions

### Track BTC and ETH (Default)
```bash
npm run predict
```

### Track Custom Pairs
```bash
npm run predict BTC ETH SOL BNB
```

### Or use full syntax
```bash
node predict-price.js BTC/USDT ETH/USDT SOL/USDT
```

## 3️⃣ Output Template

```
📌 Trading Pair:  BTC/USDT
🎯 Signal:        🟢 BUY / 🔴 SELL / ⚪ HOLD
💰 Entry Price:   $XX,XXX.XX
🛑 Stop Loss:     $XX,XXX.XX (X.XX% risk)
🎯 Take Profit 1: $XX,XXX.XX (+X.XX%)
🎯 Take Profit 2: $XX,XXX.XX (+X.XX%)
🎯 Take Profit 3: $XX,XXX.XX (+X.XX%)

📊 AI Analysis:
   Confidence: XX%
   Risk Level: LOW/MEDIUM/HIGH

💡 Reasoning:
   1. [Reason 1]
   2. [Reason 2]
   3. [Reason 3]
```

## 4️⃣ Understanding Signals

| Signal | Meaning | Action |
|--------|---------|--------|
| 🟢 **BUY** | Bullish setup confirmed | Enter long position |
| 🔴 **SELL** | Bearish setup confirmed | Enter short position |
| ⚪ **HOLD** | No clear signal | Wait for better setup |

## 5️⃣ Risk Management

- **Entry**: Current market price
- **Stop Loss**: 1.5× ATR below entry (BUY) or above entry (SELL)
- **TP1**: 1:1.5 Risk-Reward ratio (50% position)
- **TP2**: 1:2.5 Risk-Reward ratio (30% position)
- **TP3**: 1:4 Risk-Reward ratio (20% position)

## 6️⃣ Strategy Rules

The tool follows `instructions/strategy.md`:

1. ✅ **Higher Timeframe Filter**: Only BUY in bullish trends, SELL in bearish
2. ✅ **Multi-Indicator Confirmation**: RSI, EMA, MACD, Bollinger, Stochastic
3. ✅ **ATR-Based Stops**: Dynamic stop loss based on volatility
4. ✅ **Multiple Targets**: Scaling out at different profit levels
5. ✅ **AI Enhancement**: DeepSeek AI validates technical signals

## 7️⃣ Switch AI Provider

### Use Gemini (Free)
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-key
```

### Use OpenAI
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
```

### Use DeepSeek (Recommended)
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-key
```

## 8️⃣ Tracked Pairs

**Current**: BTC/USDT, ETH/USDT

**Available**: Any pair on Binance
- Bitcoin: BTC/USDT
- Ethereum: ETH/USDT
- Solana: SOL/USDT
- BNB: BNB/USDT
- Cardano: ADA/USDT
- And many more...

## 9️⃣ Troubleshooting

| Issue | Solution |
|-------|----------|
| API key error | Check `.env` has real key (not placeholder) |
| Rate limit | Wait 1 minute between runs |
| Pair not found | Use format: `BTC/USDT` or just `BTC` |
| No signal | Market is neutral - HOLD is valid |

## 🔟 Example Run

```bash
$ npm run predict

🚀 CRYPTO TRADING PRICE PREDICTION
   Following Strategy.md Guidelines
████████████████████████████████████████████████████████████

📊 BTC/USDT PRICE PREDICTION
════════════════════════════════════════════════════════════

🔭 Higher Timeframe Trend:
   Daily: BULLISH | 4H: BULLISH
   Overall: BULLISH

📈 Current Market Data:
   Price: $67,234.50
   RSI(14): 45.23
   EMA(9/21): 67,100.34 / 66,890.12
   Stochastic: %K=32.45 %D=28.90
   ATR(14): 344.2300

🤖 Running AI Analysis...

═══════════════════════════════════════════════════════════
📋 TRADING RECOMMENDATION
═══════════════════════════════════════════════════════════

📌 Trading Pair:  BTC/USDT
🎯 Signal:        🟢 BUY
💰 Entry Price:   $67,234.50
🛑 Stop Loss:     $66,890.20 (0.51% risk)
🎯 Take Profit 1: $67,750.80 (+0.77%)
🎯 Take Profit 2: $68,440.50 (+1.79%)
🎯 Take Profit 3: $69,302.10 (+3.08%)

📊 Summary: High confidence BUY signal with good risk-reward
```

## 📚 More Documentation

- `DEEPSEEK_SETUP.md` - Full DeepSeek integration guide
- `instructions/strategy.md` - Complete trading strategy
- `README.md` - Bot documentation
- `.env.example` - Configuration template

## ⚡ Pro Tips

1. **Run regularly**: Check predictions every 15-30 minutes
2. **Confirm manually**: Always verify signals with your own analysis
3. **Risk management**: Never risk more than 1-2% per trade
4. **Paper trade first**: Test predictions before using real money
5. **Track accuracy**: Keep a log of predictions vs actual results

---

Need help? Check `DEEPSEEK_SETUP.md` for detailed documentation.
