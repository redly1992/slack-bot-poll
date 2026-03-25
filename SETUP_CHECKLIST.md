# 🎯 SETUP CHECKLIST - Price Prediction with DeepSeek

Follow these steps to start predicting crypto prices:

## ☐ Step 1: Get DeepSeek API Key (2 minutes)

1. Go to [https://platform.deepseek.com](https://platform.deepseek.com)
2. Sign up / Log in
3. Click "API Keys" in sidebar
4. Click "Create API Key"
5. Copy your API key (starts with `sk-`)

**Cost**: Very low - around $0.05 per 100 predictions!

---

## ☐ Step 2: Configure .env File (1 minute)

Open `.env` file and update:

```env
# Set these three lines:
AI_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-paste-your-key-here
```

**Where to find .env?**
- Location: `C:\Topicus\trading-bot\.env`
- If missing, copy from `.env.example`

---

## ☐ Step 3: Verify Configuration (30 seconds)

Run this command:

```bash
npm run check-config
```

**Expected output:**
```
✓ AI Provider: deepseek
✓ API Key: sk-12345... (configured)
✓ Exchange: binance
✅ Configuration looks good!
```

**If you see an error:** Check your API key in `.env`

---

## ☐ Step 4: Run Your First Prediction (1 minute)

```bash
npm run predict
```

**What you'll get:**

```
📊 BTC/USDT PRICE PREDICTION
════════════════════════════════════════════════════════════

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
```

---

## ☐ Step 5: Track More Pairs (Optional)

### Default: BTC + ETH
```bash
npm run predict
```

### Custom Pairs
```bash
npm run predict BTC ETH SOL BNB ADA
```

### Single Pair
```bash
node predict-price.js SOL/USDT
```

---

## 🎯 Quick Reference

| Command | What It Does |
|---------|-------------|
| `npm run check-config` | Verify your setup |
| `npm run predict` | Predict BTC & ETH |
| `npm run predict BTC ETH SOL` | Predict custom pairs |
| `node predict-price.js SOL/USDT` | Predict single pair |

---

## 📊 Understanding the Output

### Signals
- 🟢 **BUY**: Enter long position
- 🔴 **SELL**: Enter short position  
- ⚪ **HOLD**: Wait for better setup

### Risk Management
- **Entry**: Price to enter trade
- **Stop Loss**: Exit if wrong (1.5× ATR)
- **TP1**: First target (1:1.5 RR) - close 50%
- **TP2**: Second target (1:2.5 RR) - close 30%
- **TP3**: Third target (1:4 RR) - close 20%

### Confidence Score
- 80-100%: High confidence
- 60-79%: Medium confidence
- Below 60%: Low confidence (be cautious)

---

## ⚠️ Important Notes

### Before Trading
- ✅ Paper trade first (track predictions)
- ✅ Start with small positions
- ✅ Never risk more than 1-2% per trade
- ✅ Always verify signals manually
- ✅ Use proper risk management

### Strategy Rules
The tool follows `instructions/strategy.md`:
- Only BUY in bullish trends (1D + 4H)
- Only SELL in bearish trends
- HOLD when trend is unclear
- Multi-indicator confirmation required
- ATR-based dynamic stops

---

## 🔧 Troubleshooting

### "API key not configured"
**Solution:** Edit `.env` and paste your actual DeepSeek API key

### "Provider unknown"  
**Solution:** Make sure `AI_PROVIDER=deepseek` in `.env`

### "Pair not found"
**Solution:** Use format `BTC/USDT` or just `BTC`

### Script won't run
**Solution:** Run `npm install` first

---

## 📚 Documentation

| File | What's Inside |
|------|---------------|
| `PREDICT_QUICKSTART.md` | Quick start guide |
| `DEEPSEEK_SETUP.md` | Detailed DeepSeek guide |
| `UPDATES_SUMMARY.md` | What was changed |
| `instructions/strategy.md` | Trading strategy rules |
| `README.md` | Main documentation |

---

## ✅ Completion Checklist

Mark each as you complete:

- [ ] Got DeepSeek API key
- [ ] Updated `.env` file with API key
- [ ] Ran `npm run check-config` successfully
- [ ] Ran `npm run predict` and got results
- [ ] Understand BUY/SELL/HOLD signals
- [ ] Understand risk management levels
- [ ] Read `strategy.md` trading rules
- [ ] Ready to paper trade!

---

## 🚀 You're Ready!

Once all boxes are checked, you can:

1. **Run predictions regularly** (every 15-30 min)
2. **Paper trade first** (track accuracy)
3. **Start small** when going live
4. **Scale up** as you gain confidence

**Run predictions:**
```bash
npm run predict
```

Good luck trading! 📈🎯

---

**Need Help?**
- DeepSeek docs: `DEEPSEEK_SETUP.md`
- Quick guide: `PREDICT_QUICKSTART.md`
- Trading strategy: `instructions/strategy.md`
