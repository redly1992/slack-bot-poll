# GitHub Actions Setup - Price Prediction

## 📋 Overview

Your repository now has **2 GitHub Actions workflows**:

1. **`price-prediction.yml`** - Runs price predictions every 30 minutes (NEW)
2. **`trading-bot.yml`** - Full trading bot with notifications (updated)

## 🔧 Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### Go to: Repository → Settings → Secrets and variables → Actions

### Required for Price Predictions:
```
DEEPSEEK_API_KEY = your_deepseek_api_key_here
```

### Required for Trading Bot (optional):
```
TELEGRAM_BOT_TOKEN = your_telegram_bot_token
TELEGRAM_CHAT_ID = your_telegram_chat_id
```

## 🚀 Workflow 1: Price Prediction (Recommended)

**File**: `.github/workflows/price-prediction.yml`

**Schedule**: Every 30 minutes (24/7)

**What it does**:
- Analyzes BTC and ETH markets
- Uses DeepSeek AI for predictions
- Provides BUY/SELL/HOLD signals
- Shows entry, stop loss, take profit levels
- Follows `instructions/strategy.md`

### Manual Trigger

Go to: **Actions** → **Price Prediction (DeepSeek)** → **Run workflow**

**Options**:
- Default: Tracks BTC and ETH
- Custom: Specify pairs like `BTC ETH SOL BNB`

### Configuration

The workflow uses these settings:

```yaml
AI_PROVIDER: deepseek
DEEPSEEK_MODEL: deepseek-chat
EXCHANGE: binance
INSTRUCTION_FILE: instructions/strategy.md
```

## 📊 Workflow 2: Trading Bot (Optional)

**File**: `.github/workflows/trading-bot.yml`

**What it does**:
- Runs full trading analysis
- Sends Telegram notifications
- Can run predictions or bot separately

### Manual Trigger Options

Go to: **Actions** → **Trading Bot Notification** → **Run workflow**

**Job options**:
- `predict` - Run price predictions only
- `bot` - Run full trading bot with notifications
- `both` - Run both jobs

## 🔐 Setting Up GitHub Secrets

### Step 1: Get DeepSeek API Key

1. Visit [https://platform.deepseek.com](https://platform.deepseek.com)
2. Sign up / Log in
3. Create API key
4. Copy the key (starts with `sk-`)

### Step 2: Add to GitHub

1. Go to your repository on GitHub
2. Click **Settings**
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add:
   - Name: `DEEPSEEK_API_KEY`
   - Secret: `sk-your-key-here`
6. Click **Add secret**

### Step 3: Optional - Telegram Secrets (for bot notifications)

If you want Telegram notifications, also add:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

See `TELEGRAM_SETUP.md` for details.

## ⚙️ Workflow Schedules

### Price Prediction (Every 30 minutes)
```yaml
cron: '*/30 * * * *'
```

**Runs**: 48 times per day  
**Cost**: ~$0.02-0.05 per day with DeepSeek

### Custom Schedules

You can modify the cron schedule in the workflow file:

```yaml
# Every 15 minutes
- cron: '*/15 * * * *'

# Every hour
- cron: '0 * * * *'

# Every 4 hours
- cron: '0 */4 * * *'

# Only during market hours (9 AM - 4 PM UTC)
- cron: '0 9-16 * * *'
```

## 📈 Monitoring Predictions

### View Workflow Runs

1. Go to **Actions** tab
2. Click on workflow name
3. View latest runs
4. Check logs for predictions

### Successful Run Output

You'll see in the logs:

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

## 🔄 Workflow Files Structure

```
.github/workflows/
├── price-prediction.yml     # Runs predictions every 30 min
└── trading-bot.yml          # Full bot with manual options
```

## 🎯 Recommended Setup

For automatic price predictions:

1. ✅ Add `DEEPSEEK_API_KEY` secret
2. ✅ Enable `price-prediction.yml` workflow
3. ✅ Let it run automatically every 30 minutes
4. ✅ Check logs in Actions tab
5. ✅ Adjust cron schedule if needed

For manual control:

1. ✅ Use workflow_dispatch (manual trigger)
2. ✅ Run on-demand from Actions tab
3. ✅ Choose job type (predict/bot/both)
4. ✅ Specify custom pairs if needed

## 📊 Example: Manual Prediction Run

1. Go to **Actions** tab
2. Click **Price Prediction (DeepSeek)**
3. Click **Run workflow**
4. Enter pairs: `BTC ETH SOL BNB ADA`
5. Click **Run workflow** button
6. Wait ~1-2 minutes
7. View results in workflow logs

## 💡 Tips

### Cost Optimization

- Default (30 min): ~$0.02-0.05/day
- Hourly runs: ~$0.01-0.02/day
- Every 4 hours: ~$0.003-0.006/day

### Performance

- Each prediction takes ~30-60 seconds
- Analyzing 2 pairs (BTC, ETH): ~1 minute
- Analyzing 5 pairs: ~2-3 minutes

### Best Practices

1. **Start with default**: BTC and ETH every 30 minutes
2. **Monitor accuracy**: Track signals vs actual price moves
3. **Adjust schedule**: Based on your trading style
4. **Use manual runs**: For specific pairs you're watching
5. **Check logs regularly**: Ensure predictions are working

## 🚨 Troubleshooting

### "DEEPSEEK_API_KEY not found"

**Solution**: Add the secret in repository settings

### "API rate limit exceeded"

**Solution**: Reduce cron frequency (e.g., every hour instead of 30 min)

### Workflow not running

**Solution**: 
1. Check workflow is enabled (Actions → Workflows → Enable)
2. Verify cron syntax is correct
3. Ensure secrets are set

### Predictions failing

**Solution**:
1. Check DeepSeek API key is valid
2. View workflow logs for error details
3. Verify exchange (binance) is working
4. Check if pairs exist on exchange

## 🔧 Advanced: Multiple Prediction Jobs

You can create different workflows for different strategies:

```yaml
# Scalping - every 15 minutes
.github/workflows/predict-scalping.yml

# Swing trading - every 4 hours
.github/workflows/predict-swing.yml

# Long-term - once per day
.github/workflows/predict-longterm.yml
```

Each can use different:
- Pairs (BTC/ETH vs altcoins)
- Schedules (15 min vs 4 hours)
- Instruction files (scalping.md vs swing.md)

## 📚 Next Steps

1. ✅ Add `DEEPSEEK_API_KEY` to GitHub secrets
2. ✅ Commit and push workflow files
3. ✅ Enable workflows in Actions tab
4. ✅ Run manual test
5. ✅ Monitor first automatic run
6. ✅ Adjust schedule based on needs

## 🎉 You're All Set!

Your GitHub Actions will now:
- ✅ Run predictions automatically every 30 minutes
- ✅ Use DeepSeek AI for analysis
- ✅ Track BTC and ETH
- ✅ Follow strategy.md guidelines
- ✅ Provide actionable trading signals

**View predictions**: Actions tab → Price Prediction (DeepSeek) → Latest run

---

**Need help?** Check the workflow logs for detailed output and any errors.
