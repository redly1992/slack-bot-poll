# Instagram DM Integration Setup 📸

This guide will help you set up Instagram Direct Message notifications for your trading bot.

## ⚠️ Important Notice

Instagram's Private API is unofficial and against Instagram's Terms of Service. Use at your own risk:
- Your account could be flagged or banned
- Two-factor authentication must be disabled
- Instagram may rate-limit or block automation
- **Recommended**: Use a separate Instagram account for bot notifications

## Prerequisites

- An Instagram account (preferably a dedicated one for the bot)
- Two-factor authentication disabled on that account
- Account should not be brand new (Instagram flags new accounts doing automation)

## Setup Steps

### 1. Create or Use an Instagram Account

**Option A: Create New Account**
1. Create a new Instagram account
2. Wait 24-48 hours before using it with the bot
3. Post 1-2 photos to make it look legitimate
4. Follow a few accounts

**Option B: Use Existing Account**
- Make sure 2FA is disabled
- Consider using a secondary account, not your main one

### 2. Configure Environment Variables

Edit your `.env` file and add:

```env
# Instagram Configuration
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
INSTAGRAM_ENABLED=true
```

**Security Tips:**
- Never commit your `.env` file to git (it's already in `.gitignore`)
- Use a strong, unique password
- Consider using an app-specific password if available

### 3. Update Instruction File

Edit your instruction file (e.g., `instructions/default.md`) and enable Instagram notifications:

```yaml
notifications:
  enabled: true
  cooldownMinutes: 60
  telegram: true      # Telegram notifications
  instagram: true     # Instagram DM notifications
```

### 4. Test Locally

Test the Instagram integration in dry-run mode first:

```bash
# Set Instagram enabled for testing
INSTAGRAM_ENABLED=true DRY_RUN=true npm start
```

Then test with actual Instagram DMs:

```bash
# Live test (will send actual Instagram DM to yourself)
INSTAGRAM_ENABLED=true npm start
```

You should receive a DM from yourself with the trading signal!

## How It Works

1. Bot authenticates with your Instagram account
2. When a trading signal is detected, the bot:
   - Gets your own user ID
   - Creates a DM thread with yourself
   - Sends the signal message to your own DM
3. You receive trading notifications in your Instagram Direct Messages

## Message Format

Instagram DM notifications look like this:

```
🟢 BUY SIGNAL 🟢

Pair: BTC/USDT
Price: $70724.15
Time: 2026-03-23 12:30:45 UTC

📊 Indicators:
• RSI: 28.45
• EMA Fast: 69500.23
• EMA Slow: 68900.15
• BB Upper: 72000.00
• BB Middle: 70000.00
• BB Lower: 68000.00

✅ Signal Reasons:
1. RSI is oversold
2. Price below lower Bollinger Band
3. Fast EMA crosses above slow EMA (bullish)

⚠️ Not financial advice. DYOR.
```

## GitHub Actions Setup

To use Instagram in GitHub Actions, add these secrets:

Go to **Settings → Secrets and variables → Actions**:

1. `INSTAGRAM_USERNAME` - Your Instagram username
2. `INSTAGRAM_PASSWORD` - Your Instagram password

Then update `.github/workflows/trading-bot.yml`:

```yaml
- name: Run trading bot
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
    INSTAGRAM_USERNAME: ${{ secrets.INSTAGRAM_USERNAME }}
    INSTAGRAM_PASSWORD: ${{ secrets.INSTAGRAM_PASSWORD }}
    INSTAGRAM_ENABLED: true
    # ... other vars
  run: npm start
```

## Troubleshooting

### "Challenge Required" Error

Instagram detected unusual activity:
- Wait 24 hours before trying again
- Log in to Instagram from a browser on the same network
- Complete any security challenges Instagram shows you
- Make the account look more legitimate (post photos, follow people)

### "Bad Password" Error

- Double-check username and password
- Ensure no extra spaces in `.env` file
- Try logging in manually through the app/website first
- Disable two-factor authentication

### "Checkpoint Required" Error

Instagram requires verification:
- Log in through the Instagram app or website
- Complete any verification steps
- Wait before using automation again

### Rate Limiting

Instagram limits how many DMs you can send:
- Increase `cooldownMinutes` in instruction file
- Use longer timeframes (1h, 4h instead of 5m, 15m)
- Reduce the number of trading pairs

### Authentication Takes Long Time

First authentication can be slow:
- Instagram API needs to generate device fingerprint
- Wait 30-60 seconds for first login
- Subsequent runs will be faster

## Disabling Instagram Notifications

### Temporarily Disable

Set in `.env`:
```env
INSTAGRAM_ENABLED=false
```

Or in instruction file:
```yaml
notifications:
  telegram: true
  instagram: false
```

### Completely Remove

1. Remove Instagram credentials from `.env`
2. Set `INSTAGRAM_ENABLED=false`
3. Optionally uninstall the package:
   ```bash
   npm uninstall instagram-private-api
   ```

## Combining with Telegram

You can use both Telegram and Instagram notifications simultaneously:

```yaml
notifications:
  enabled: true
  telegram: true      # Send to Telegram
  instagram: true     # Also send to Instagram DM
```

This gives you redundancy and flexibility in how you receive notifications.

## Security Best Practices

1. **Use a dedicated account** - Don't use your main Instagram account
2. **Strong passwords** - Use unique, strong passwords
3. **Monitor activity** - Check for unusual login attempts
4. **Limit permissions** - Only give bot access to one account
5. **Regular rotation** - Change passwords periodically
6. **Backup method** - Keep Telegram enabled as backup notification channel

## Alternative: Telegram Only

If Instagram integration seems too risky, you can stick with Telegram notifications only:
- More stable and reliable
- Official API (not against ToS)
- Better for high-frequency notifications
- No risk of account bans

Simply set `INSTAGRAM_ENABLED=false` and use Telegram exclusively.

## FAQ

**Q: Will this post on my Instagram feed?**  
A: No, it only sends Direct Messages to yourself. Nothing is posted publicly.

**Q: Can I send to other people?**  
A: The current implementation sends to yourself. You can modify `instagramNotifier.js` to send to specific user IDs.

**Q: Is this against Instagram's ToS?**  
A: Yes, using unofficial APIs violates Instagram's Terms of Service. Use at your own risk with a dedicated account.

**Q: Why not use official Instagram API?**  
A: Instagram's official API doesn't support sending DMs. Only the unofficial private API has this capability.

**Q: Can Instagram ban my account?**  
A: Yes, there's always a risk. That's why we recommend using a dedicated account, not your main one.

---

**Need help?** Check the main [README.md](README.md) or open an issue on GitHub.
