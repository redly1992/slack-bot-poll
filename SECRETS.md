# GitHub Secrets Setup

To deploy this bot to GitHub Actions, you need to configure the following secrets in your repository settings.

## Required Secrets

Go to your repository **Settings → Secrets and variables → Actions → New repository secret** and add:

### 1. TELEGRAM_BOT_TOKEN

**How to get it:**
1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the prompts to create your bot:
   - Choose a name for your bot (e.g., "My Trading Bot")
   - Choose a username for your bot (must end in 'bot', e.g., "mytradingbot123_bot")
4. BotFather will send you a token that looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Copy this token

**Add to GitHub:**
- Secret name: `TELEGRAM_BOT_TOKEN`
- Secret value: `your_token_from_botfather`

### 2. TELEGRAM_CHAT_ID

**How to get it:**

**Method 1: Using @userinfobot**
1. Search for [@userinfobot](https://t.me/userinfobot) on Telegram
2. Send `/start` to the bot
3. It will reply with your user ID (e.g., `123456789`)
4. This is your Chat ID

**Method 2: Using your bot**
1. Send a message to your newly created bot
2. Open this URL in browser (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":123456789}` in the JSON response
4. That number is your Chat ID

**Add to GitHub:**
- Secret name: `TELEGRAM_CHAT_ID`
- Secret value: `your_chat_id_number`

## Optional Secrets

### EXCHANGE_API_KEY and EXCHANGE_API_SECRET

Only needed if you want to access private endpoints (like your account balance, open orders, etc.). For public market data, these are not required.

**Binance Example:**
1. Log in to Binance
2. Go to API Management
3. Create new API key
4. Save the API Key and Secret Key
5. Add to GitHub secrets (if needed)

## Verifying Secrets

After adding secrets:

1. Go to **Actions** tab in your repository
2. Select **Trading Bot Notification** workflow
3. Click **Run workflow** → **Run workflow**
4. Check the workflow logs to verify it runs successfully
5. You should receive a Telegram notification!

## Security Notes

⚠️ **Never commit secrets to your repository**
- Always use GitHub Secrets for sensitive data
- The `.env` file is in `.gitignore` to prevent accidental commits
- Never share your bot token or API keys publicly

## Troubleshooting

### "Unauthorized" error
- Check that `TELEGRAM_BOT_TOKEN` is correct
- Verify you copied the entire token from BotFather

### No messages received
- Ensure `TELEGRAM_CHAT_ID` is correct (it should be a number)
- Send at least one message to your bot before running
- Check that bot is not blocked

### "Could not find secrets" error
- Verify secrets are added to the repository (not your personal account)
- Secret names must match exactly (case-sensitive)
- Re-add secrets if necessary
