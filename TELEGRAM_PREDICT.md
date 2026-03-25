# 📱 Telegram Notifications for Price Predictions

## ✅ Feature Added

**`predict-price.js` now sends Telegram notifications automatically!**

When you run `npm run predict`, you'll receive:
1. **Individual notifications** for each trading pair (BTC, ETH, etc.)
2. **Summary notification** at the end with all predictions

---

## 🎯 What Gets Sent to Telegram

### Individual Prediction Message

For each pair analyzed, you receive:

```
🎯 TRADING PREDICTION

Pair: BTC/USDT
Position: 🟢 LONG
Trend: NEUTRAL
Risk Level: HIGH

📊 Entry & Targets:
▫️ Entry: $71213.10
▫️ Stop Loss: $70909.32 (0.43%)
▫️ TP1: $71668.77
▫️ TP2: $71972.55
▫️ TP3: $72428.22

💡 Entry Reason:
(AI explains WHY this entry is good)

🛡️ Stop Loss Reason:
(AI explains WHERE and WHY stop loss is placed)

📈 AI Confidence: 50%

📝 Analysis:
1. Direction reasoning...
2. Entry timing analysis...
3. Setup quality assessment...

⏰ 3/25/2026, 6:45:00 AM
```

### Summary Message

After all predictions complete:

```
📊 PREDICTION SUMMARY

🟢 BTC/USDT - LONG
   Entry: $71213.10 | SL: $70909.32 | Risk: 0.43%
   Confidence: 50% | Trend: NEUTRAL

🔴 ETH/USDT - SHORT
   Entry: $2450.00 | SL: $2475.00 | Risk: 1.02%
   Confidence: 75% | Trend: BEARISH

⏰ 3/25/2026, 6:45:30 AM
```

---

## 🚀 How to Use

### 1. **Local Usage** (already configured)

Your `.env` file already has Telegram configured:
```bash
TELEGRAM_BOT_TOKEN=8661657616:AAGiTlvhRrH_y6C8DVDtzdB1DcKFFDhA8dM
TELEGRAM_CHAT_ID=1015630264
```

Just run predictions as usual:
```bash
npm run predict              # Default: BTC and ETH
npm run predict BTC          # Single pair
npm run predict BTC ETH SOL  # Multiple pairs
```

**Result:** Predictions show in console AND sent to Telegram! 📱

### 2. **GitHub Actions** (automated)

Your `.github/workflows/price-prediction.yml` already runs every 30 minutes.

Make sure you have these secrets in GitHub:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `DEEPSEEK_API_KEY`

**Result:** Every 30 minutes, predictions sent automatically to Telegram! 🤖

---

## 📊 Notification Details

### What's Included:

✅ **Trading pair** (BTC/USDT, ETH/USDT)  
✅ **Position type** (LONG/SHORT with emoji)  
✅ **Entry price** (exact entry point)  
✅ **Stop loss** (with risk % calculated)  
✅ **3 Take Profit targets** (TP1, TP2, TP3)  
✅ **Entry reasoning** (why NOW is good entry)  
✅ **Stop loss reasoning** (why HERE is good SL)  
✅ **AI confidence score** (50-100%)  
✅ **Detailed analysis points** (3-5 reasons)  
✅ **Trend context** (4H + Daily trend)  
✅ **Risk level** (LOW/MEDIUM/HIGH)  
✅ **Timestamp** (when signal was generated)

### Notification Frequency:

- **Per prediction:** One detailed message per pair
- **Summary:** One compact summary at the end
- **No spam:** Each pair only notified once per run

---

## 🔧 Configuration

### Enable/Disable Telegram

**Enabled automatically if configured:**
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

**Disable notifications:**
```bash
# Remove or comment out in .env
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_CHAT_ID=...
```

Tool will still work, just no Telegram notifications.

### Console Output

You'll see notification status:

**When enabled:**
```
🤖 Price Prediction Tool initialized with DEEPSEEK
📱 Telegram notifications ENABLED
```

**When disabled:**
```
🤖 Price Prediction Tool initialized with DEEPSEEK
⚠️  Telegram notifications DISABLED (configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable)
```

---

## 🎯 Benefits

### 1. **Real-Time Alerts**
Get trading signals instantly on your phone 📱

### 2. **Complete Information**
All critical data in one message - no need to check console

### 3. **Historical Record**
Telegram keeps all signals - review past predictions anytime

### 4. **Mobile Trading**
Make decisions from anywhere, not just at your computer

### 5. **Automated Workflow**
GitHub Actions → DeepSeek AI → Telegram → You

### 6. **No Manual Checking**
Signals come to you, you don't have to run commands

---

## 📈 Example Workflow

### Morning Routine:
```
6:00 AM → GitHub Actions runs prediction
6:01 AM → DeepSeek analyzes BTC and ETH
6:02 AM → 📱 You receive Telegram notifications
6:03 AM → Review signals on your phone
6:05 AM → Enter trades on exchange
```

### Manual Check:
```bash
npm run predict
```
→ Results in console AND Telegram simultaneously

---

## 🔍 Comparison: Before vs After

### Before (No Telegram):
```
❌ Run command
❌ Wait for analysis
❌ Read console output
❌ Manually copy data
❌ Can't access if away from computer
```

### After (With Telegram):
```
✅ Automatic notifications
✅ Phone alerts instantly
✅ Complete signal data
✅ Access from anywhere
✅ Historical record in chat
```

---

## 🛠️ Technical Details

### What Changed:

**Files Modified:**
- `predict-price.js` - Added Telegram integration

**Code Changes:**
1. Import `TelegramNotifier` class
2. Initialize Telegram in constructor
3. Added `sendTelegramNotification()` method
4. Added `sendTelegramSummary()` method
5. Call notifications after each prediction

**Dependencies:**
- Uses existing `src/telegramNotifier.js`
- No new npm packages needed
- Same bot as trading-bot uses

### How It Works:

```javascript
// 1. Initialize (in constructor)
if (telegramToken && telegramChatId) {
  this.telegram = new TelegramNotifier(token, chatId);
}

// 2. After prediction
if (this.telegram) {
  await this.sendTelegramNotification(result);
}

// 3. After all predictions
if (this.telegram && results.length > 0) {
  await this.sendTelegramSummary(results);
}
```

### Message Format:
- **Markdown** formatting for readability
- **Emojis** for visual clarity
- **Structured** layout for quick scanning

---

## 📱 Telegram Bot Setup

If you need to create a new bot:

### 1. Create Bot
1. Open Telegram
2. Search for **@BotFather**
3. Send `/newbot`
4. Follow instructions
5. Copy bot token

### 2. Get Chat ID
1. Start chat with your bot
2. Send any message
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your `chat_id` in JSON response

### 3. Configure
Add to `.env`:
```bash
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_CHAT_ID=your_chat_id_from_api
```

---

## 🧪 Testing

### Test Notifications:

```bash
# Single pair
npm run predict BTC

# Multiple pairs
npm run predict BTC ETH

# Check Telegram for messages
```

### Verify Configuration:

```bash
# Should see this on startup:
📱 Telegram notifications ENABLED

# After prediction:
📱 Telegram notification sent for BTC/USDT
📱 Telegram summary sent for 1 predictions
```

---

## ⚙️ Advanced Usage

### Disable Notifications Temporarily

Don't want notifications for this run only?

**Option 1:** Comment out in `.env` temporarily
```bash
# TELEGRAM_BOT_TOKEN=...
# TELEGRAM_CHAT_ID=...
```

**Option 2:** Use different environment
```bash
TELEGRAM_BOT_TOKEN="" npm run predict
```

### Multiple Bots/Chats

Create separate `.env` files:
```bash
# .env.personal
TELEGRAM_CHAT_ID=your_personal_chat_id

# .env.group
TELEGRAM_CHAT_ID=your_group_chat_id
```

Run with specific config:
```bash
node -r dotenv/config predict-price.js dotenv_config_path=.env.personal
```

---

## 🎯 Summary

**What You Get:**
- ✅ Automatic Telegram notifications for all predictions
- ✅ Detailed signal information with reasoning
- ✅ Entry, stop loss, and take profit levels
- ✅ AI confidence and analysis
- ✅ Summary table at the end
- ✅ Works locally AND with GitHub Actions

**How to Use:**
```bash
npm run predict  # That's it!
```

**Result:**
- Console output (for debugging/logging)
- Telegram notifications (for trading)

**Best of both worlds!** 🚀📱

---

## 📚 Related Documentation

- **TELEGRAM_SETUP.md** - How to create and configure Telegram bot
- **PREDICT_QUICKSTART.md** - How to use predict-price.js
- **GITHUB_ACTIONS_COMPLETE.md** - Automated predictions
- **LONG_SHORT_SYSTEM.md** - How signals are generated
- **STRATEGY_IMPROVEMENTS.md** - AI strategy optimization

---

## 💡 Tips

1. **Keep Telegram notifications enabled** - You might miss good signals otherwise
2. **Review summary table** - Quick overview of all pairs
3. **Check confidence scores** - Higher = better setup quality
4. **Read AI reasoning** - Learn why signals are generated
5. **Track results** - Review Telegram history to improve strategy

---

Enjoy your Telegram-powered trading predictions! 📱🚀
