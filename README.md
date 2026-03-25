# Trading Bot Notifier 🤖📊

A JavaScript-based trading bot that monitors cryptocurrency pairs, calculates technical indicators, **uses AI-powered analysis**, and sends Telegram notifications when trading signals are detected. Designed to run on GitHub Actions with configurable timeframes.

## Features

✅ **🤖 AI-Powered Analysis (NEW!)** - DeepSeek, Gemini, or OpenAI models analyze market data with natural language reasoning  
✅ **📊 Price Prediction Tool (NEW!)** - Get LONG/SHORT signals with entry, stop loss, and take profit levels  
✅ **📱 Telegram Prediction Alerts (NEW!)** - Automatic notifications sent to Telegram when predictions run  
✅ **⚡ GitHub Actions Integration (NEW!)** - Automated predictions every 30 minutes
✅ **Multi-pair monitoring** - Track multiple trading pairs simultaneously  
✅ **Technical indicators** - RSI, EMA, MACD, Bollinger Bands, Stochastic, ATR  
✅ **Higher timeframe analysis** - Trend confirmation with 1D and 4H charts  
✅ **Markdown configuration** - Define strategies in human-readable markdown files  
✅ **Telegram notifications** - Real-time alerts with detailed signal information  
✅ **Instagram DM (optional)** - Bonus notification channel  
✅ **GitHub Actions deployment** - Automated scheduled execution  
✅ **Configurable timeframes** - 1m, 5m, 15m, 30m, 1h, 4h, 1d  
✅ **Dry-run mode** - Test strategies without sending notifications

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd trading-bot
npm install
```

### 2. Create Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow instructions to create your bot
3. Save the **Bot Token** you receive
4. Get your **Chat ID**:
   - Search for [@userinfobot](https://t.me/userinfobot) on Telegram
   - Send `/start` to get your Chat ID

### 3. Configure Environment

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
EXCHANGE=binance
INSTRUCTION_FILE=instructions/default.md
DRY_RUN=false
```

### 4. Configure AI (Optional but Recommended)

Add your AI provider API key to `.env`:

```env
# DeepSeek (Recommended - Cost-effective)
AI_ENABLED=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Or use Gemini (Free tier available)
# AI_PROVIDER=gemini
# GEMINI_API_KEY=your_gemini_key_here

# Or use OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=your_openai_key_here
```

**Get DeepSeek API Key**: Visit [https://platform.deepseek.com](https://platform.deepseek.com)

### 5. Run Price Predictions

Get instant trading signals for BTC and ETH:

```bash
npm run predict
```

Or specify custom pairs:

```bash
npm run predict BTC ETH SOL BNB
```

**Output includes**:
- 📌 Trading pair name
- 🎯 Signal: BUY / SELL / HOLD
- 💰 Entry price
- 🛑 Stop loss level (ATR-based)
- 🎯 Take profit targets (TP1, TP2, TP3)
- 📊 AI confidence score and reasoning
- 📈 Higher timeframe trend analysis

See [`PREDICT_QUICKSTART.md`](PREDICT_QUICKSTART.md) for details.

### 6. Run Bot Locally

Test in dry-run mode (no notifications sent):

```bash
DRY_RUN=true npm start
```

Run live:

```bash
npm start
```

## GitHub Actions Deployment

### Automated Price Predictions

The bot can run automatically on GitHub Actions every 30 minutes:

**Setup Steps:**

1. **Add DeepSeek API Key to GitHub Secrets**
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Click: New repository secret
   - Name: `DEEPSEEK_API_KEY`
   - Value: Your DeepSeek API key
   - Click: Add secret

2. **Enable Workflows**
   - Go to: Actions tab
   - Enable workflows if disabled
   - Workflows will run automatically every 30 minutes

3. **Manual Trigger (Optional)**
   - Go to: Actions → Price Prediction (DeepSeek) → Run workflow
   - Specify custom pairs or use defaults (BTC, ETH)

**Workflows Available:**
- `price-prediction.yml` - Runs predictions every 30 minutes
- `trading-bot.yml` - Full bot with Telegram notifications

See [`.github/ACTIONS_SETUP.md`](.github/ACTIONS_SETUP.md) for detailed setup.

## Configuration

### Instruction File Format

The bot reads trading strategies from markdown files with YAML frontmatter. See [`instructions/default.md`](instructions/default.md) for a complete example.

```yaml
---
pairs:
  - BTC/USDT
  - ETH/USDT

timeframe: 15m
candleLimit: 100

indicators:
  rsi:
    enabled: true
    period: 14
    overbought: 70
    oversold: 30
  
  ema:
    enabled: true
    fastPeriod: 9
    slowPeriod: 21

signals:
  buy:
    - condition: "rsi < oversold"
      description: "RSI is oversold"
    - condition: "ema.fast > ema.slow"
      description: "Bullish EMA crossover"
  
  sell:
    - condition: "rsi > overbought"
      description: "RSI is overbought"
---
```

### Supported Timeframes

- `1m` - 1 minute
- `5m` - 5 minutes
- `15m` - 15 minutes (default)
- `30m` - 30 minutes
- `1h` - 1 hour
- `4h` - 4 hours
- `1d` - 1 day

### Available Indicators

| Indicator | Variables | Description |
|-----------|-----------|-------------|
| **RSI** | `rsi` | Relative Strength Index (0-100) |
| **EMA** | `ema.fast`, `ema.slow` | Exponential Moving Averages |
| **MACD** | `macd.macd`, `macd.signal`, `macd.histogram` | Moving Average Convergence Divergence |
| **Bollinger Bands** | `bollinger.upper`, `bollinger.middle`, `bollinger.lower` | Volatility bands |
| **Price** | `price` | Current closing price |

### Signal Conditions

Signal conditions are evaluated using JavaScript expressions:

```yaml
signals:
  buy:
    - condition: "rsi < 30"                    # RSI oversold
    - condition: "price < bollinger.lower"     # Price below lower band
    - condition: "ema.fast > ema.slow"         # Bullish crossover
    - condition: "macd.histogram > 0"          # Positive MACD
```

All conditions in a signal group must be true (AND logic) for the signal to trigger.

## GitHub Actions Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Add Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|-------------|-------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |

### 3. Configure Schedule

Edit [`.github/workflows/trading-bot.yml`](.github/workflows/trading-bot.yml) to match your timeframe:

```yaml
on:
  schedule:
    # Run every 15 minutes
    - cron: '*/15 * * * *'
```

**Cron Examples:**
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`
- Every 4 hours: `0 */4 * * *`
- Daily at 9 AM UTC: `0 9 * * *`

### 4. Enable Actions

1. Go to your repository **Actions** tab
2. Enable GitHub Actions if prompted
3. The workflow will run on schedule automatically
4. You can also trigger manually via "Run workflow" button

## Project Structure

```
trading-bot/
├── .github/
│   └── workflows/
│       └── trading-bot.yml       # GitHub Actions workflow
├── instructions/
│   └── default.md                # Trading strategy configuration
├── src/
│   ├── index.js                  # Main bot entry point
│   ├── instructionParser.js      # Parse markdown instructions
│   ├── marketData.js             # Fetch market data (ccxt)
│   ├── indicatorCalculator.js    # Calculate technical indicators
│   ├── signalEvaluator.js        # Evaluate signal conditions
│   └── telegramNotifier.js       # Send Telegram notifications
├── .env.example                  # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Example Strategies

### RSI Oversold/Overbought

```yaml
signals:
  buy:
    - condition: "rsi < 30"
      description: "RSI oversold"
  sell:
    - condition: "rsi > 70"
      description: "RSI overbought"
```

### Bollinger Band Breakout

```yaml
signals:
  buy:
    - condition: "price < bollinger.lower"
      description: "Price below lower band"
  sell:
    - condition: "price > bollinger.upper"
      description: "Price above upper band"
```

### EMA Crossover

```yaml
signals:
  buy:
    - condition: "ema.fast > ema.slow"
      description: "Bullish EMA crossover"
  sell:
    - condition: "ema.fast < ema.slow"
      description: "Bearish EMA crossover"
```

### Combined Strategy

```yaml
signals:
  buy:
    - condition: "rsi < 30"
    - condition: "price < bollinger.lower"
    - condition: "macd.histogram > 0"
  sell:
    - condition: "rsi > 70"
    - condition: "price > bollinger.upper"
```

## Troubleshooting

### No notifications received

1. Check if signals were detected in logs: `npm start`
2. Verify Telegram credentials in `.env`
3. Check cooldown period in instruction file
4. Test bot connection: The bot sends a test message on first run

### "Not enough data" errors

Increase `candleLimit` in instruction file to provide more historical data for indicators.

### GitHub Actions not running

1. Verify workflow file is in `.github/workflows/`
2. Check Actions tab for errors
3. Ensure secrets are properly set
4. Verify cron syntax is correct

### Rate limiting

If analyzing many pairs:
- Add delays between pair analysis
- Use longer timeframes
- Reduce polling frequency

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | Yes | - | Your Telegram chat ID |
| `EXCHANGE` | No | `binance` | Exchange to use (via ccxt) |
| `INSTRUCTION_FILE` | No | `instructions/default.md` | Path to instruction file |
| `DRY_RUN` | No | `false` | Test mode (no notifications) |
| `LOG_LEVEL` | No | `info` | Logging level |

## Advanced Usage

### Multiple Instruction Files

Create different strategy files for different market conditions:

```bash
instructions/
├── default.md          # General strategy
├── scalping.md         # Short-term scalping
├── swing.md            # Swing trading
└── conservative.md     # Conservative signals
```

Run with different file:

```bash
INSTRUCTION_FILE=instructions/scalping.md npm start
```

### Custom Indicators

Extend `src/indicatorCalculator.js` to add more indicators from the [technicalindicators](https://www.npmjs.com/package/technicalindicators) library.

### Multiple Exchanges

The bot uses [ccxt](https://github.com/ccxt/ccxt) which supports 100+ exchanges. Change the `EXCHANGE` environment variable to use different exchanges.

## Disclaimer

⚠️ **Important Notice:**

This bot is for **educational and notification purposes only**. It does not execute trades automatically.

- Not financial advice
- Do your own research (DYOR)
- Past performance doesn't guarantee future results
- Cryptocurrency trading carries significant risk
- Never invest more than you can afford to lose

## License

MIT

## Support

For issues and feature requests, please open a GitHub issue.
