const { IgApiClient } = require('instagram-private-api');

class InstagramNotifier {
  constructor(username, password) {
    this.ig = new IgApiClient();
    this.username = username;
    this.password = password;
    this.isAuthenticated = false;
    this.lastNotificationTime = {};
  }

  /**
   * Authenticate with Instagram
   */
  async authenticate() {
    try {
      this.ig.state.generateDevice(this.username);
      await this.ig.account.login(this.username, this.password);
      this.isAuthenticated = true;
      console.log('[Instagram] Authenticated successfully');
    } catch (error) {
      console.error(`[Instagram] Authentication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a trading signal notification via Instagram DM to yourself
   * @param {string} symbol - Trading pair
   * @param {string} signalType - 'BUY' or 'SELL'
   * @param {Object} indicators - Indicator values
   * @param {Array} reasons - Array of reasons for the signal
   * @param {Object} options - Additional options
   */
  async sendSignal(symbol, signalType, indicators, reasons, options = {}) {
    const { cooldownMinutes = 60 } = options;

    // Check cooldown
    const key = `${symbol}_${signalType}`;
    const now = Date.now();
    const lastNotification = this.lastNotificationTime[key] || 0;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    if (now - lastNotification < cooldownMs) {
      console.log(`[Instagram COOLDOWN] Skipping ${signalType} signal for ${symbol} (cooldown active)`);
      return;
    }

    // Authenticate if not already
    if (!this.isAuthenticated) {
      await this.authenticate();
    }

    // Format message
    const emoji = signalType === 'BUY' ? '🟢' : '🔴';
    const message = this.formatSignalMessage(symbol, signalType, indicators, reasons, emoji);

    try {
      // Get own user ID
      const userId = await this.ig.user.getIdByUsername(this.username);
      
      // Create a thread (DM) with yourself
      const thread = this.ig.entity.directThread([userId.toString()]);
      
      // Send message
      await thread.broadcastText(message);
      
      this.lastNotificationTime[key] = now;
      console.log(`[Instagram SENT] ${signalType} signal notification for ${symbol}`);
    } catch (error) {
      console.error(`[Instagram] Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Format the signal message for Instagram
   * @param {string} symbol - Trading pair
   * @param {string} signalType - Signal type
   * @param {Object} indicators - Indicator values
   * @param {Array} reasons - Signal reasons
   * @param {string} emoji - Emoji for signal type
   * @returns {string}
   */
  formatSignalMessage(symbol, signalType, indicators, reasons, emoji) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    let message = `${emoji} ${signalType} SIGNAL ${emoji}\n\n`;
    message += `Pair: ${symbol}\n`;
    message += `Price: $${indicators.price.toFixed(2)}\n`;
    message += `Time: ${timestamp} UTC\n\n`;
    
    message += `📊 Indicators:\n`;
    if (indicators.rsi !== undefined) {
      message += `• RSI: ${indicators.rsi.toFixed(2)}\n`;
    }
    if (indicators.ema) {
      message += `• EMA Fast: ${indicators.ema.fast.toFixed(2)}\n`;
      message += `• EMA Slow: ${indicators.ema.slow.toFixed(2)}\n`;
    }
    if (indicators.macd) {
      message += `• MACD: ${indicators.macd.macd.toFixed(2)}\n`;
      message += `• Signal: ${indicators.macd.signal.toFixed(2)}\n`;
      message += `• Histogram: ${indicators.macd.histogram.toFixed(2)}\n`;
    }
    if (indicators.bollinger) {
      message += `• BB Upper: ${indicators.bollinger.upper.toFixed(2)}\n`;
      message += `• BB Middle: ${indicators.bollinger.middle.toFixed(2)}\n`;
      message += `• BB Lower: ${indicators.bollinger.lower.toFixed(2)}\n`;
    }

    message += `\n✅ Signal Reasons:\n`;
    reasons.forEach((reason, index) => {
      message += `${index + 1}. ${reason}\n`;
    });

    message += `\n⚠️ Not financial advice. DYOR.`;

    return message;
  }

  /**
   * Send a test message to yourself
   */
  async sendTestMessage() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      const userId = await this.ig.user.getIdByUsername(this.username);
      const thread = this.ig.entity.directThread([userId.toString()]);
      await thread.broadcastText('✅ Trading Bot Instagram integration is active!');
      
      console.log('[Instagram] Test message sent successfully');
    } catch (error) {
      console.error(`[Instagram] Failed to send test message: ${error.message}`);
      throw error;
    }
  }
}

module.exports = InstagramNotifier;
