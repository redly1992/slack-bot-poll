# 📱 Telegram Bot Connection Guide

Follow these steps to connect your Telegram bot and start receiving trading notifications.

## Step 1: Create Your Telegram Bot (2 minutes)

### 1.1 Open Telegram and find BotFather

1. Open your Telegram app (mobile or desktop)
2. Search for: **@BotFather** (it has a blue verified checkmark)
3. Click on it and press **START**

### 1.2 Create your bot

Send this command to BotFather:
```
/newbot
```

BotFather will ask you two questions:

**Question 1: "Alright, a new bot. How are we going to call it?"**
- Answer with your bot's display name (e.g., "My Trading Bot")
- This is just a friendly name, can be anything

**Question 2: "Now let's choose a username for your bot."**
- Answer with a username ending in "bot" (e.g., "mytradingbot123_bot")
- Must be unique across all of Telegram
- If taken, try adding numbers or underscores

### 1.3 Save your Bot Token

BotFather will reply with a message like:
```
Done! Congratulations on your new bot...
Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567
```

**Copy that entire token!** It looks like: `1234567890:ABCdefGHI...`

⚠️ **Keep this token secret!** Anyone with this token can control your bot.

## Step 2: Get Your Chat ID (1 minute)

You need your Chat ID so the bot knows where to send messages.

### Method 1: Using @userinfobot (Easiest)

1. Search for: **@userinfobot** in Telegram
2. Press **START** or send `/start`
3. The bot will reply with your User ID (e.g., `123456789`)
4. **That's your Chat ID!** Copy that number.

### Method 2: Using your bot

1. Find your bot in Telegram (search for the username you created)
2. Send it any message (e.g., "hello")
3. Open this URL in your browser (replace `YOUR_TOKEN` with your bot token):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
4. You'll see JSON data. Look for: `"chat":{"id":123456789}`
5. That number (123456789) is your Chat ID

## Step 3: Configure Your Bot

### 3.1 Create .env file

In the `trading-bot` folder, copy the example file:

```bash
cp .env.example .env
```

### 3.2 Edit .env file

Open `.env` in a text editor and add your credentials:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567
TELEGRAM_CHAT_ID=123456789

# Instagram Configuration (Optional - you can leave these as-is for now)
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
INSTAGRAM_ENABLED=false

# Exchange Configuration
EXCHANGE=binance

# Bot Configuration
INSTRUCTION_FILE=instructions/default.md
DRY_RUN=false
LOG_LEVEL=info
```

**Replace:**
- `TELEGRAM_BOT_TOKEN` with your actual bot token
- `TELEGRAM_CHAT_ID` with your actual chat ID (the number)

**Save the file!**

## Step 4: Test Your Connection

Run the setup helper script:

```bash
npm run setup-telegram
```

This will:
1. ✅ Check if your credentials are configured
2. ✅ Test the connection to Telegram
3. ✅ Send you a test message

**Check your Telegram app** - you should receive a message from your bot saying "Telegram Bot Connected!"

### If it works:
✅ Perfect! Your bot is connected and ready to go!

### If it doesn't work:

**Error: "401 Unauthorized"**
- Your bot token is incorrect
- Copy the token again from @BotFather
- Make sure there are no extra spaces in `.env`

**Error: "400 Bad Request" or "chat not found"**
- Your Chat ID is incorrect or not a number
- Make sure you sent a message to your bot first
- Try getting Chat ID again using Method 1 or 2 above

**Error: "ENOTFOUND" or "network"**
- Check your internet connection
- Try again in a few seconds

## Step 5: Run the Trading Bot

### Test Mode (No actual notifications)

```bash
npm run test
```

This runs in "dry-run" mode - it analyzes markets but doesn't send notifications.

### Live Mode (Real notifications)

```bash
npm start
```

This runs live and will send Telegram messages when trading signals are detected!

## What to Expect

When a trading signal is detected, you'll receive a message like:

```
🟢 BUY SIGNAL 🟢

Pair: BTC/USDT
Price: $70724.15
Time: 2026-03-23 12:30:45 UTC

Indicators:
• RSI: 28.45
• EMA Fast: 69500.23
• EMA Slow: 68900.15

Signal Reasons:
1. RSI is oversold
2. Price below lower Bollinger Band
3. Fast EMA crosses above slow EMA (bullish)

⚠️ This is not financial advice. DYOR.
```

## Customize Your Notifications

Edit `instructions/default.md` to:
- Change which trading pairs to monitor
- Adjust timeframes (5m, 15m, 1h, etc.)
- Modify indicator settings
- Change signal conditions

## Deploy to GitHub Actions

Once local testing works, deploy to GitHub Actions for automatic monitoring:

1. Push your code to GitHub
2. Add secrets in GitHub Settings:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. Enable the workflow in the Actions tab

See [README.md](README.md) for full deployment instructions.

## Troubleshooting

### Not receiving notifications?

1. **Check if signals were detected**: Look at the terminal output when running `npm start`
2. **Check cooldown period**: Default is 60 minutes between signals for the same pair
3. **Verify bot is running**: Make sure the script completes without errors
4. **Test with setup script**: Run `npm run setup-telegram` again to verify connection

### Bot stopped working?

- Token may have been revoked - check with @BotFather
- Chat ID changed (rare, but can happen)
- Run setup script again: `npm run setup-telegram`

### Want to use multiple bots?

You can create multiple bots with @BotFather and switch between them by changing `TELEGRAM_BOT_TOKEN` in `.env`

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run setup-telegram` | Test Telegram connection and send test message |
| `npm run test` | Run bot in dry-run mode (no notifications) |
| `npm start` | Run bot live (sends notifications) |

**Need more help?** Check [README.md](README.md) for full documentation.

---

🎉 **You're all set!** Your trading bot will now send Telegram notifications when it detects trading signals based on your configured indicators and conditions.
