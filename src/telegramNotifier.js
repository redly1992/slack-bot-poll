const TelegramBot = require('node-telegram-bot-api');

class TelegramNotifier {
  constructor(token, chatId) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
    this.lastNotificationTime = {};
  }

  /**
   * Send a trading signal notification
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
      console.log(`[COOLDOWN] Skipping ${signalType} signal for ${symbol} (cooldown active)`);
      return;
    }

    // Format message
    const emoji = signalType === 'BUY' ? '🟢' : '🔴';
    const message = this.formatSignalMessage(symbol, signalType, indicators, reasons, emoji, options);

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      this.lastNotificationTime[key] = now;
      console.log(`[SENT] ${signalType} signal notification for ${symbol}`);
    } catch (error) {
      console.error(`Failed to send Telegram notification: ${error.message}`);
    }
  }

  /**
   * Format the signal message
   * @param {string} symbol - Trading pair
   * @param {string} signalType - Signal type
   * @param {Object} indicators - Indicator values
   * @param {Array} reasons - Signal reasons
   * @param {string} emoji - Emoji for signal type
   * @returns {string}
   */
  formatSignalMessage(symbol, signalType, indicators, reasons, emoji, options = {}) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    let message = `${emoji} *${signalType} SIGNAL* ${emoji}\n\n`;
    message += `*Pair:* ${symbol}\n`;
    message += `*Price:* $${indicators.price.toFixed(2)}\n`;
    message += `*Time:* ${timestamp} UTC\n\n`;
    
    message += `*Indicators:*\n`;
    if (indicators.rsi !== undefined) {
      message += `• RSI: ${indicators.rsi.toFixed(2)}\n`;
    }
    if (indicators.ema) {
      message += `• EMA Fast: ${indicators.ema.fast.toFixed(2)}\n`;
      message += `• EMA Slow: ${indicators.ema.slow.toFixed(2)}\n`;
    }
    if (indicators.macd) {
      message += `• MACD: ${indicators.macd.macd.toFixed(2)}\n`;
      message += `• MACD Signal: ${indicators.macd.signal.toFixed(2)}\n`;
      message += `• MACD Histogram: ${indicators.macd.histogram.toFixed(2)}\n`;
    }
    if (indicators.bollinger) {
      message += `• BB Upper: ${indicators.bollinger.upper.toFixed(2)}\n`;
      message += `• BB Middle: ${indicators.bollinger.middle.toFixed(2)}\n`;
      message += `• BB Lower: ${indicators.bollinger.lower.toFixed(2)}\n`;
    }

    message += `\n*Signal Reasons:*\n`;
    reasons.forEach((reason, index) => {
      message += `${index + 1}. ${reason}\n`;
    });

    if (options.aiAnalysis) {
      message += `\n*AI Analysis:*\n${options.aiAnalysis}\n`;
    }

    const riskEmoji = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' }[options.riskLevel] || '⚪';
    message += `\n${riskEmoji} Risk: ${options.riskLevel || 'MEDIUM'} | Confidence: ${options.confidence || 0}%`;
    message += `\n\n⚠️ _This is not financial advice. DYOR._`;

    return message;
  }

  /**
   * Send a market update (HOLD) notification - always fires
   */
  async sendMarketUpdate(symbol, indicators, decision) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const riskEmoji = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' }[decision.riskLevel] || '⚪';
    const trendEmoji = indicators.ema && indicators.ema.fast > indicators.ema.slow ? '📈' : '📉';

    let message = `⚪ *MARKET UPDATE* ⚪\n\n`;
    message += `*Pair:* ${symbol}\n`;
    message += `*Signal:* HOLD\n`;
    message += `*Price:* $${indicators.price.toFixed(2)} ${trendEmoji}\n`;
    message += `*Time:* ${timestamp} UTC\n\n`;

    message += `*Indicators:*\n`;
    if (indicators.rsi !== undefined) {
      const rsiStatus = indicators.rsi < 35 ? ' 🔵 near oversold' : indicators.rsi > 65 ? ' 🔴 near overbought' : ' ➡️ neutral';
      message += `• RSI: ${indicators.rsi.toFixed(2)}${rsiStatus}\n`;
    }
    if (indicators.ema) {
      const emaTrend = indicators.ema.fast > indicators.ema.slow ? '↗️ Bullish' : '↘️ Bearish';
      message += `• EMA Trend: ${emaTrend}\n`;
      message += `• EMA Fast/Slow: ${indicators.ema.fast.toFixed(2)} / ${indicators.ema.slow.toFixed(2)}\n`;
    }
    if (indicators.macd) {
      const macdMomentum = indicators.macd.histogram > 0 ? '↗️ Positive' : '↘️ Negative';
      message += `• MACD Momentum: ${macdMomentum} (${indicators.macd.histogram.toFixed(2)})\n`;
    }
    if (indicators.bollinger) {
      message += `• BB: ${indicators.bollinger.lower.toFixed(2)} – ${indicators.bollinger.upper.toFixed(2)}\n`;
    }

    if (decision.aiAnalysis) {
      message += `\n*AI Analysis:*\n${decision.aiAnalysis}\n`;
    }

    if (decision.reasons && decision.reasons.length > 0) {
      message += `\n*Reasons:*\n`;
      decision.reasons.slice(0, 3).forEach((r, i) => {
        message += `${i + 1}. ${r}\n`;
      });
    }

    message += `\n${riskEmoji} Risk: ${decision.riskLevel || 'MEDIUM'} | Confidence: ${decision.confidence || 0}%`;
    message += `\n\n⚠️ _Not financial advice. DYOR._`;

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
      console.log(`[SENT] Market update (HOLD) for ${symbol}`);
    } catch (error) {
      console.error(`Failed to send Telegram market update: ${error.message}`);
    }
  }

  /**
   * Send a test message
   */
  async sendTestMessage() {
    try {
      await this.bot.sendMessage(this.chatId, '✅ Trading Bot is active and ready!');
      console.log('Test message sent successfully');
    } catch (error) {
      console.error(`Failed to send test message: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TelegramNotifier;
