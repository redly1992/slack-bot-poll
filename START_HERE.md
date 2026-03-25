# 🚀 START HERE - Complete Setup Guide

## 📋 What This Bot Does

Your trading bot now has **TWO main features**:

### 1. 💻 Local Price Predictions
Run on your computer to get instant trading signals for BTC, ETH, and any crypto pair.

### 2. ☁️ Automated GitHub Actions
Runs on GitHub's servers automatically every 30 minutes - completely hands-free!

---

## 🎯 Choose Your Path

### Path A: Local Predictions (5 minutes)
Run predictions on your computer whenever you want.

### Path B: Automated GitHub Actions (10 minutes)  
Set up once, get predictions automatically every 30 minutes forever.

### Path C: Both (Best!)
Use local for testing, GitHub Actions for automation.

---

## 🚀 Path A: Local Predictions

### Step 1: Get DeepSeek API Key (2 min)
1. Visit https://platform.deepseek.com
2. Sign up / Log in
3. Create API key
4. Copy the key (starts with `sk-`)

### Step 2: Configure .env (1 min)
Edit `.env` file:
```env
AI_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-paste-your-key-here
```

### Step 3: Test Configuration (30 sec)
```bash
npm run check-config
```

### Step 4: Run Predictions (1 min)
```bash
npm run predict
```

**Output:**
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
```

✅ **Done!** You can now run predictions anytime with `npm run predict`

**Detailed Guide:** `SETUP_CHECKLIST.md`

---

## ☁️ Path B: GitHub Actions (Automated)

### Step 1: Get DeepSeek API Key (2 min)
Same as Path A above.

### Step 2: Add to GitHub Secrets (3 min)
1. Go to your repository on GitHub
2. Click **Settings**
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Name: `DEEPSEEK_API_KEY`
6. Secret: `sk-your-key-here`
7. Click **Add secret**

### Step 3: Push Workflow Files (2 min)
```bash
git add .
git commit -m "Add DeepSeek price prediction with GitHub Actions"
git push
```

### Step 4: Enable & Test (2 min)
1. Go to **Actions** tab on GitHub
2. Enable workflows if disabled
3. Click **Price Prediction (DeepSeek)**
4. Click **Run workflow** → **Run workflow**
5. Wait 1-2 minutes
6. View results in logs

✅ **Done!** Predictions now run automatically every 30 minutes!

**Detailed Guide:** `.github/ACTIONS_SETUP.md`

---

## 📚 Documentation Index

### 🌟 Quick Start Guides
- **START_HERE.md** (this file) - Main entry point
- `SETUP_CHECKLIST.md` - Step-by-step local setup
- `PREDICT_QUICKSTART.md` - Quick reference guide

### 🤖 DeepSeek AI
- `DEEPSEEK_SETUP.md` - Complete DeepSeek guide
- `UPDATES_SUMMARY.md` - What was added/changed

### ☁️ GitHub Actions
- `.github/ACTIONS_SETUP.md` - Complete Actions guide
- `GITHUB_ACTIONS_COMPLETE.md` - Quick Actions reference

### 📖 General
- `README.md` - Main project documentation
- `QUICKSTART.md` - Original quick start
- `TELEGRAM_SETUP.md` - Telegram bot setup

---

## 🎯 Common Use Cases

### Use Case 1: Quick Check
"I want to check BTC and ETH right now"
```bash
npm run predict
```

### Use Case 2: Watch Specific Coins
"I'm watching SOL, BNB, and ADA"
```bash
npm run predict SOL BNB ADA
```

### Use Case 3: Automated Monitoring
"I want automatic predictions every 30 minutes"
- Set up GitHub Actions (Path B above)
- View results in Actions tab

### Use Case 4: Custom Schedule
"I want predictions every 15 minutes"
- Edit `.github/workflows/price-prediction.yml`
- Change cron to `*/15 * * * *`

---

## 🔧 Commands Quick Reference

```bash
# Check configuration
npm run check-config

# Predict BTC & ETH (default)
npm run predict

# Predict custom pairs
npm run predict BTC ETH SOL BNB ADA

# Predict single pair
node predict-price.js SOL/USDT

# Run full trading bot
npm start

# Test mode (no notifications)
npm test
```

---

## 📊 Understanding the Output

### Signals
- 🟢 **BUY** = Bullish setup confirmed → Enter long
- 🔴 **SELL** = Bearish setup confirmed → Enter short  
- ⚪ **HOLD** = No clear signal → Wait

### Risk Management
- **Entry**: Current price to enter trade
- **Stop Loss**: Exit if wrong (1.5× ATR below/above entry)
- **TP1, TP2, TP3**: Take profit levels (scale out)

### Confidence Score
- **80-100%**: High confidence → Strong signal
- **60-79%**: Medium confidence → Good signal
- **Below 60%**: Low confidence → Be cautious

### Risk Level
- **LOW**: Small price movements expected
- **MEDIUM**: Normal volatility
- **HIGH**: Large swings possible - reduce position size

---

## ⚙️ Configuration Options

### Change AI Provider

**DeepSeek (Default - Recommended):**
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key
```

**Gemini (Free tier):**
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
```

**OpenAI:**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_key
```

### Change Exchange

Default is Binance. To change:
```env
EXCHANGE=bybit
# or
EXCHANGE=coinbase
```

### Change Strategy File

```env
INSTRUCTION_FILE=instructions/strategy.md
# or
INSTRUCTION_FILE=instructions/scalping.md
```

---

## 🚨 Troubleshooting

### "API key not configured"
**Fix:** Edit `.env` and add your actual DeepSeek API key

### "Provider unknown"
**Fix:** Ensure `AI_PROVIDER=deepseek` (not `deepseek-chat`)

### "Pair not found"
**Fix:** Use format `BTC/USDT` or just `BTC`

### Script won't run
**Fix:** Run `npm install` first

### GitHub Actions not running
**Fix:** 
1. Check workflow is enabled
2. Verify secret is added
3. Ensure repo has Actions enabled

---

## 💰 Cost Estimates

### DeepSeek (Recommended)
- **Per prediction**: ~$0.001
- **Every 30 min**: ~$0.02-0.05/day
- **Every hour**: ~$0.01-0.02/day
- **Every 4 hours**: ~$0.003-0.006/day

### Gemini (Free)
- **Free tier**: 15 requests/minute
- **Cost**: $0.00 (with limits)

### OpenAI
- **Per prediction**: ~$0.003-0.005
- **Every 30 min**: ~$0.10-0.30/day

---

## ✅ Setup Checklist

### Local Setup
- [ ] Installed Node.js and dependencies
- [ ] Got DeepSeek API key
- [ ] Updated `.env` file
- [ ] Ran `npm run check-config` successfully
- [ ] Ran `npm run predict` successfully
- [ ] Understand BUY/SELL/HOLD signals
- [ ] Know how to read stop loss & take profit

### GitHub Actions Setup
- [ ] Added `DEEPSEEK_API_KEY` to GitHub secrets
- [ ] Pushed workflow files to repository
- [ ] Enabled workflows in Actions tab
- [ ] Ran manual test successfully
- [ ] Verified automatic run worked
- [ ] Know how to view logs

---

## 🎯 Next Steps

### After Setup
1. ✅ Run predictions regularly (every 15-30 min)
2. ✅ Paper trade first (track without real money)
3. ✅ Record predictions vs actual results
4. ✅ Build confidence before live trading
5. ✅ Start with small positions

### Advanced
1. Create custom strategies in `instructions/`
2. Add more trading pairs
3. Set up Telegram notifications
4. Create multiple workflows for different schedules
5. Integrate with trading platforms

---

## 📚 Learn More

### Trading Strategy
Read `instructions/strategy.md` to understand:
- Technical analysis approach
- Risk management rules
- Position sizing guidelines
- Entry/exit strategies

### Architecture
- `src/aiAnalyzer.js` - AI integration
- `src/indicatorCalculator.js` - Technical indicators
- `predict-price.js` - Main prediction tool

---

## 🆘 Getting Help

### Documentation
1. Check relevant .md file from list above
2. Read troubleshooting sections
3. Review workflow logs on GitHub

### Common Issues
Most issues are solved by:
1. Verifying API key is correct
2. Running `npm install`
3. Checking `.env` configuration
4. Reading error messages carefully

---

## 🎉 You're Ready!

You now have a complete crypto trading prediction system with:

✅ **DeepSeek AI** - Cost-effective analysis  
✅ **Price Predictions** - BUY/SELL/HOLD signals  
✅ **Risk Management** - Entry, SL, TP levels  
✅ **Local & Automated** - Run anytime or automatically  
✅ **Multiple Pairs** - BTC, ETH, and any crypto  
✅ **Strategy-based** - Follows proven trading rules  

**Start predicting:**
```bash
npm run predict
```

**Good luck trading!** 🚀📈

---

**Questions?** Read the documentation files listed above for detailed guides.
