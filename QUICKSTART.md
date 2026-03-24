# 🚀 Quick Start Guide

Get your trading bot running in 5 minutes!

## Step 1: Clone and Install (1 min)

```bash
git clone <your-repo-url>
cd trading-bot
npm install
```

## Step 2: Create Telegram Bot (2 min)

1. Open Telegram, search for **@BotFather**
2. Send `/newbot` and follow instructions
3. Save your **Bot Token** (looks like: `123456:ABCxyz...`)
4. Search for **@userinfobot** and send `/start`
5. Save your **Chat ID** (a number like: `123456789`)

## Step 3: Configure (1 min)

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your credentials
# TELEGRAM_BOT_TOKEN=your_token_here
# TELEGRAM_CHAT_ID=your_chat_id_here
```

## Step 4: Test Locally (1 min)

```bash
# Test without sending notifications
npm run test

# Or with DRY_RUN environment variable
DRY_RUN=true npm start
```

You should see output like:
```
🤖 Trading Bot initialized (DRY RUN mode)
📊 Starting market analysis...
Analyzing 3 pairs on 15m timeframe
📈 Analyzing BTC/USDT...
  Current price: $70724.15
  RSI: 74.96
  ⚪ No signals detected
```

## Step 5: Deploy to GitHub Actions (Optional)

### Push to GitHub

```bash
git add .
git commit -m "Initial setup"
git push
```

### Add Secrets

Go to **Settings → Secrets and variables → Actions**:

1. Add `TELEGRAM_BOT_TOKEN` (your bot token)
2. Add `TELEGRAM_CHAT_ID` (your chat ID)

### Enable Workflow

Go to **Actions** tab and click **Run workflow**

## 🎯 What's Next?

### Customize Your Strategy

Edit `instructions/default.md` to:
- Add/remove trading pairs
- Change timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- Adjust indicator settings
- Modify buy/sell conditions

### Try Different Strategies

```bash
# Scalping (5-minute trades)
INSTRUCTION_FILE=instructions/scalping.md npm start

# Swing trading (4-hour trades)
INSTRUCTION_FILE=instructions/swing.md npm start

# Conservative (high-confidence signals only)
INSTRUCTION_FILE=instructions/conservative.md npm start
```

### Adjust Schedule

Edit `.github/workflows/trading-bot.yml`:

```yaml
schedule:
  # Every 5 minutes
  - cron: '*/5 * * * *'
  
  # Every hour
  # - cron: '0 * * * *'
  
  # Every 4 hours
  # - cron: '0 */4 * * *'
```

## 📚 Need Help?

- **Full Documentation**: See [README.md](README.md)
- **GitHub Secrets Setup**: See [SECRETS.md](SECRETS.md)
- **Troubleshooting**: Check README's troubleshooting section

## ⚠️ Important

This bot **does not execute trades** - it only sends notifications. Always do your own research before making trading decisions!

---

**Ready to go live?** Remove `DRY_RUN=true` from your environment and run:

```bash
npm start
```

You'll receive Telegram notifications when trading signals are detected! 🎉
