require('dotenv').config();
const ccxt = require('ccxt');
const InstructionParser = require('./src/instructionParser');
const IndicatorCalculator = require('./src/indicatorCalculator');
const AIAnalyzer = require('./src/aiAnalyzer');
const TelegramNotifier = require('./src/telegramNotifier');

/**
 * Continuous Multi-Timeframe Monitoring Bot
 * 
 * Monitors 5m, 15m, 1H indicators in real-time.
 * When ALL timeframes align (BUY or SELL), triggers AI analysis.
 * Only sends Telegram notification if AI confidence >= 80%.
 */

class ContinuousMonitor {
  constructor(config = {}) {
    // Configuration
    this.pairs = config.pairs || process.env.MONITOR_PAIRS?.split(',') || ['BTC/USDT', 'ETH/USDT'];
    this.timeframes = ['5m', '15m', '1h'];
    this.checkInterval = config.checkInterval || 60000; // 1 minute
    this.minConfidence = config.minConfidence || 70; // Minimum AI confidence
    this.cooldownMinutes = config.cooldownMinutes || 60; // Cooldown per pair
    this.exchange = process.env.EXCHANGE || 'binance';
    
    // Initialize components
    this.marketData = new ccxt[this.exchange]({
      enableRateLimit: true,
    });
    
    this.parser = new InstructionParser('instructions/learned-strategy.md');
    
    // Initialize AI via shared provider config (set AI_PROVIDER in .env)
    const { resolveAIConfig } = require('./src/aiClient');
    this.aiAnalyzer = new AIAnalyzer(resolveAIConfig());
    
    // Initialize Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!telegramToken || !telegramChatId || telegramToken.includes('your_') || telegramChatId.includes('your_')) {
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured');
    }
    
    this.telegram = new TelegramNotifier(telegramToken, telegramChatId);
    
    // State tracking
    this.lastNotification = {}; // Track last notification time per pair
    this.lastCheck = {}; // Track last check results
    this.isRunning = false;
    this.stats = {
      checksPerformed: 0,
      alignmentsDetected: 0,
      aiTriggered: 0,
      signalsSent: 0,
      startTime: null
    };
    
    console.log('\n🤖 Continuous Monitor initialized');
    console.log(`📊 Monitoring pairs: ${this.pairs.join(', ')}`);
    console.log(`⏱️  Timeframes: ${this.timeframes.join(', ')}`);
    console.log(`🎯 Min AI confidence: ${this.minConfidence}%`);
    console.log(`⏳ Check interval: ${this.checkInterval / 1000}s`);
    console.log(`🔄 Cooldown: ${this.cooldownMinutes} minutes\n`);
  }
  
  /**
   * Start continuous monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Monitor is already running');
      return;
    }
    
    this.isRunning = true;
    this.stats.startTime = Date.now();
    
    console.log('🚀 Starting continuous monitoring...\n');
    console.log(`${'═'.repeat(60)}`);
    
    // Initial check
    await this.checkAllPairs();
    
    // Schedule periodic checks
    this.intervalId = setInterval(async () => {
      try {
        await this.checkAllPairs();
      } catch (error) {
        console.error(`❌ Error in check cycle: ${error.message}`);
      }
    }, this.checkInterval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    console.log('\n\n🛑 Stopping continuous monitor...');
    clearInterval(this.intervalId);
    this.isRunning = false;
    
    this.printStats();
    process.exit(0);
  }
  
  /**
   * Check all trading pairs
   */
  async checkAllPairs() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${timestamp}] Checking ${this.pairs.length} pairs...`);
    
    for (const pair of this.pairs) {
      try {
        await this.checkPair(pair);
      } catch (error) {
        console.error(`❌ ${pair}: ${error.message}`);
      }
    }
    
    this.stats.checksPerformed++;
    console.log(`${'─'.repeat(60)}`);
  }
  
  /**
   * Check single trading pair
   */
  async checkPair(pair) {
    try {
      // Fetch OHLCV data for all timeframes
      const ohlcvData = {};
      
      for (const tf of this.timeframes) {
        ohlcvData[tf] = await this.marketData.fetchOHLCV(pair, tf, 100);
        await this.sleep(200); // Rate limiting
      }
      
      // Calculate indicators for each timeframe
      const indicators = {};
      const signals = {};
      
      for (const tf of this.timeframes) {
        try {
          // Transform OHLCV array to object format
          // CCXT returns: [timestamp, open, high, low, close, volume]
          const formattedOHLCV = ohlcvData[tf].map(candle => ({
            timestamp: candle[0],
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5]
          }));
          
          const indicatorConfig = {
            rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
            ema: { enabled: true, fastPeriod: 9, slowPeriod: 21 },
            macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
            bollinger: { enabled: true, period: 20, stdDev: 2 },
            stochastic: { enabled: true, kPeriod: 14, dPeriod: 3, smooth: 3 }
          };
          
          indicators[tf] = IndicatorCalculator.calculateAll(formattedOHLCV, indicatorConfig);
          const signalResult = this.determineSignal(indicators[tf], tf);
          signals[tf] = signalResult.signal;
          indicators[tf].explanation = signalResult.explanation;
        } catch (error) {
          console.error(`  ⚠️  ${pair} ${tf}: Indicator calculation failed - ${error.message}`);
          signals[tf] = 'NEUTRAL';
          if (!indicators[tf]) indicators[tf] = {};
          indicators[tf].explanation = { summary: 'Error calculating indicators' };
        }
      }
      
      // Check if all timeframes align
      const allBuy = this.timeframes.every(tf => signals[tf] === 'BUY');
      const allSell = this.timeframes.every(tf => signals[tf] === 'SELL');
      
      const alignment = allBuy ? 'BUY' : allSell ? 'SELL' : 'MIXED';
      
      // Log current state
      const signalEmojis = {
        'BUY': '🟢',
        'SELL': '🔴',
        'NEUTRAL': '⚪'
      };
      
      const statusLine = this.timeframes.map(tf => 
        `${tf}:${signalEmojis[signals[tf]] || '⚪'}`
      ).join(' ');
      
      console.log(`  ${pair.padEnd(12)} ${statusLine} → ${alignment}`);
      
      // Show indicator explanations for each timeframe
      if ((allBuy || allSell)) {
        console.log(`  📊 Indicator Analysis for ${pair}:`);
        for (const tf of this.timeframes) {
          if (indicators[tf]?.explanation) {
            console.log(`     ${tf}:`);
            const exp = indicators[tf].explanation;
            Object.keys(exp).forEach(key => {
              if (key !== 'summary') {
                console.log(`       ${exp[key]}`);
              }
            });
          }
        }
      }
      
      // If aligned and different from last check, trigger AI
      if ((allBuy || allSell) && this.lastCheck[pair] !== alignment) {
        console.log(`  🎯 ${pair}: All timeframes aligned on ${alignment}!`);
        this.stats.alignmentsDetected++;
        await this.triggerAIAnalysis(pair, alignment, indicators, ohlcvData);
      }
      
      // Update last check state
      this.lastCheck[pair] = alignment;
      
    } catch (error) {
      console.error(`  ❌ ${pair}: ${error.message}`);
    }
  }
  
  /**
   * Determine BUY/SELL signal from indicators with explanations
   */
  determineSignal(indicators, timeframe = '') {
    // Safety check
    if (!indicators || !indicators.rsi) {
      return { signal: 'NEUTRAL', explanation: { summary: 'No indicator data available' } };
    }
    
    let buyScore = 0;
    let sellScore = 0;
    const explanation = {};
    
    // RSI
    const rsi = indicators.rsi;
    if (rsi < 40) {
      buyScore++;
      explanation.rsi = `✅ RSI: ${rsi.toFixed(2)} < 40 (Oversold → BUY signal)`;
    } else if (rsi > 60) {
      sellScore++;
      explanation.rsi = `✅ RSI: ${rsi.toFixed(2)} > 60 (Overbought → SELL signal)`;
    } else {
      explanation.rsi = `⚪ RSI: ${rsi.toFixed(2)} (Neutral: 40-60)`;
    }
    
    // EMA alignment
    const emaFast = indicators.ema?.fast || indicators.ema9;
    const emaSlow = indicators.ema?.slow || indicators.ema21;
    const ema50 = indicators.ema50 || indicators.price; // fallback
    
    if (emaFast > emaSlow && emaSlow > ema50) {
      buyScore++;
      explanation.ema = `✅ EMA: ${emaFast.toFixed(2)} > ${emaSlow.toFixed(2)} > ${ema50.toFixed(2)} (Bullish alignment → BUY)`;
    } else if (emaFast < emaSlow && emaSlow < ema50) {
      sellScore++;
      explanation.ema = `✅ EMA: ${emaFast.toFixed(2)} < ${emaSlow.toFixed(2)} < ${ema50.toFixed(2)} (Bearish alignment → SELL)`;
    } else {
      explanation.ema = `⚪ EMA: Fast=${emaFast.toFixed(2)}, Slow=${emaSlow.toFixed(2)} (Mixed/No clear trend)`;
    }
    
    // MACD
    const macd = indicators.macd?.histogram || indicators.macdHistogram || 0;
    if (macd > 0) {
      buyScore++;
      explanation.macd = `✅ MACD Histogram: ${macd.toFixed(4)} > 0 (Bullish momentum → BUY)`;
    } else if (macd < 0) {
      sellScore++;
      explanation.macd = `✅ MACD Histogram: ${macd.toFixed(4)} < 0 (Bearish momentum → SELL)`;
    } else {
      explanation.macd = `⚪ MACD Histogram: ${macd.toFixed(4)} (No momentum)`;
    }
    
    // Stochastic
    const stochK = indicators.stochastic?.k || indicators.stochK || 50;
    const stochD = indicators.stochastic?.d || indicators.stochD || 50;
    
    if (stochK < 20 && stochK > stochD) {
      buyScore++;
      explanation.stoch = `✅ Stochastic: %K=${stochK.toFixed(2)} < 20 and crossing up %D=${stochD.toFixed(2)} (Oversold bounce → BUY)`;
    } else if (stochK > 80 && stochK < stochD) {
      sellScore++;
      explanation.stoch = `✅ Stochastic: %K=${stochK.toFixed(2)} > 80 and crossing down %D=${stochD.toFixed(2)} (Overbought rejection → SELL)`;
    } else {
      explanation.stoch = `⚪ Stochastic: %K=${stochK.toFixed(2)}, %D=${stochD.toFixed(2)} (No extreme/cross)`;
    }
    
    // Bollinger Bands
    const lastPrice = indicators.price || indicators.close;
    const bbLower = indicators.bollinger?.lower || indicators.bbLower;
    const bbUpper = indicators.bollinger?.upper || indicators.bbUpper;
    
    if (bbLower && lastPrice < bbLower) {
      buyScore++;
      explanation.bb = `✅ Bollinger: Price ${lastPrice.toFixed(2)} < Lower ${bbLower.toFixed(2)} (Below lower band → BUY)`;
    } else if (bbUpper && lastPrice > bbUpper) {
      sellScore++;
      explanation.bb = `✅ Bollinger: Price ${lastPrice.toFixed(2)} > Upper ${bbUpper.toFixed(2)} (Above upper band → SELL)`;
    } else {
      explanation.bb = `⚪ Bollinger: Price ${lastPrice.toFixed(2)} within bands (No extreme)`;
    }
    
    // Summary
    explanation.summary = `BUY signals: ${buyScore}/5 | SELL signals: ${sellScore}/5 (Need ≥3 for signal)`;
    
    // Decision: Need at least 3 indicators agreeing
    let signal = 'NEUTRAL';
    if (buyScore >= 3) signal = 'BUY';
    else if (sellScore >= 3) signal = 'SELL';

    console.log(`Explanation`, explanation);
    console.log(`Sell Score`, sellScore);
    console.log(`Buy Score`, buyScore);

    return { signal, explanation };
  }
  
  /**
   * Trigger AI analysis
   */
  async triggerAIAnalysis(pair, signal, indicators, ohlcvData) {
    // Check cooldown
    if (this.isOnCooldown(pair)) {
      console.log(`  ⏳ ${pair}: On cooldown, skipping AI analysis`);
      return;
    }
    
    console.log(`  🤖 ${pair}: Triggering AI analysis...`);
    this.stats.aiTriggered++;
    
    try {
      // Get higher timeframe trend (4H + Daily for context)
      const trendContext = await this.getHigherTimeframeTrend(pair);
      
      // Prepare data for AI (use 15m as primary for detailed analysis)
      const primaryIndicators = indicators['15m'];
      
      // Call AI analyzer
      const aiAnalysis = await this.aiAnalyzer.analyzeMarket(
        pair,
        primaryIndicators,
        this.parser.getInstructions(),
        trendContext
      );
      
      console.log(`  📊 AI Result: ${aiAnalysis.signal} (${aiAnalysis.confidence}%)`);
      
      // Check confidence threshold
      if (aiAnalysis.confidence >= this.minConfidence) {
        console.log(`  ✅ High confidence! Sending notification...`);
        await this.sendTelegramNotification(pair, signal, aiAnalysis, indicators, trendContext);
        this.lastNotification[pair] = Date.now();
        this.stats.signalsSent++;
      } else {
        console.log(`  ⚠️  Low confidence (${aiAnalysis.confidence}% < ${this.minConfidence}%), skipping notification`);
      }
      
    } catch (error) {
      console.error(`  ❌ AI analysis failed: ${error.message}`);
    }
  }
  
  /**
   * Get higher timeframe trend (4H + Daily)
   */
  async getHigherTimeframeTrend(pair) {
    try {
      const [daily, h4] = await Promise.all([
        this.marketData.fetchOHLCV(pair, '1d', 60),
        this.marketData.fetchOHLCV(pair, '4h', 60),
      ]);
      
      const dailyTrend = IndicatorCalculator.determineTrend(daily);
      const h4Trend = IndicatorCalculator.determineTrend(h4);
      
      let overallTrend = 'NEUTRAL';
      if (dailyTrend.trend === 'BULLISH' && h4Trend.trend === 'BULLISH') {
        overallTrend = 'BULLISH';
      } else if (dailyTrend.trend === 'BEARISH' && h4Trend.trend === 'BEARISH') {
        overallTrend = 'BEARISH';
      } else if (dailyTrend.trend !== h4Trend.trend && dailyTrend.trend !== 'NEUTRAL' && h4Trend.trend !== 'NEUTRAL') {
        overallTrend = 'MIXED';
      }
      
      return { daily: dailyTrend, h4: h4Trend, overallTrend };
    } catch (error) {
      console.error(`  ⚠️  Could not fetch higher timeframe: ${error.message}`);
      return { daily: { trend: 'NEUTRAL' }, h4: { trend: 'NEUTRAL' }, overallTrend: 'NEUTRAL' };
    }
  }
  
  /**
   * Send Telegram notification
   */
  async sendTelegramNotification(pair, signal, aiAnalysis, indicators, trendContext) {
    try {
      const emoji = signal === 'BUY' ? '🟢' : '🔴';
      const normalizedSignal = signal === 'BUY' ? 'LONG' : 'SHORT';
      
      // Get current price and ATR from 15m indicators
      const ind15m = indicators['15m'];
      const currentPrice = ind15m.price;
      const ohlcv15m = await this.marketData.fetchOHLCV(pair, '15m', 100);
      const atr = IndicatorCalculator.calculateATR(ohlcv15m, 14);
      
      const stopLoss = normalizedSignal === 'LONG' 
        ? currentPrice - (1.5 * atr)
        : currentPrice + (1.5 * atr);
      
      const tp1 = normalizedSignal === 'LONG'
        ? currentPrice + (1.5 * atr)
        : currentPrice - (1.5 * atr);
      
      const tp2 = normalizedSignal === 'LONG'
        ? currentPrice + (2.5 * atr)
        : currentPrice - (2.5 * atr);
      
      const tp3 = normalizedSignal === 'LONG'
        ? currentPrice + (4 * atr)
        : currentPrice - (4 * atr);
      
      const riskPercent = Math.abs((currentPrice - stopLoss) / currentPrice * 100).toFixed(2);
      
      const message = `
🚨 *HIGH-QUALITY SIGNAL DETECTED* 🚨

*Pair:* ${pair}
*Position:* ${emoji} *${normalizedSignal}*
*Multi-TF Alignment:* ✅ 5m + 15m + 1H
*4H/Daily Trend:* ${trendContext.overallTrend}

📊 *Entry & Targets:*
▫️ Entry: $${currentPrice.toFixed(2)}
▫️ Stop Loss: $${stopLoss.toFixed(2)} (${riskPercent}%)
▫️ TP1: $${tp1.toFixed(2)}
▫️ TP2: $${tp2.toFixed(2)}
▫️ TP3: $${tp3.toFixed(2)}

🤖 *AI Analysis:*
▫️ Signal: ${aiAnalysis.signal}
▫️ Confidence: *${aiAnalysis.confidence}%*
▫️ Risk Level: ${aiAnalysis.riskLevel}

💡 *Entry Reason:*
${aiAnalysis.entryReason || 'All timeframes aligned with strong indicators'}

🛡️ *Stop Loss Reason:*
${aiAnalysis.stopLossReason || `Based on ${(1.5 * atr).toFixed(2)} ATR buffer`}

📝 *Key Points:*
${aiAnalysis.reasoning ? aiAnalysis.reasoning.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'Multi-timeframe confirmation'}

📈 *Technical Indicators (15m):*
▫️ RSI: ${ind15m.rsi.toFixed(2)}
▫️ EMA9/21: ${(ind15m.ema?.fast || 0).toFixed(2)} / ${(ind15m.ema?.slow || 0).toFixed(2)}
▫️ MACD: ${(ind15m.macd?.histogram || 0).toFixed(4)}
▫️ Stochastic: %K=${(ind15m.stochastic?.k || 0).toFixed(2)}

⏰ ${new Date().toLocaleString()}

⚡ *This is a high-confidence signal with multi-timeframe confirmation!*
`.trim();

      await this.telegram.bot.sendMessage(this.telegram.chatId, message, { parse_mode: 'Markdown' });
      console.log(`  📱 Telegram notification sent`);
      
    } catch (error) {
      console.error(`  ⚠️  Failed to send Telegram: ${error.message}`);
    }
  }
  
  /**
   * Check if pair is on cooldown
   */
  isOnCooldown(pair) {
    if (!this.lastNotification[pair]) return false;
    
    const timeSinceLastNotification = Date.now() - this.lastNotification[pair];
    const cooldownMs = this.cooldownMinutes * 60 * 1000;
    
    return timeSinceLastNotification < cooldownMs;
  }
  
  /**
   * Print statistics
   */
  printStats() {
    const uptime = Date.now() - this.stats.startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log('\n📊 Session Statistics:');
    console.log(`   Uptime: ${hours}h ${minutes}m`);
    console.log(`   Checks performed: ${this.stats.checksPerformed}`);
    console.log(`   Alignments detected: ${this.stats.alignmentsDetected}`);
    console.log(`   AI analyses triggered: ${this.stats.aiTriggered}`);
    console.log(`   High-quality signals sent: ${this.stats.signalsSent}`);
    console.log(`   Success rate: ${this.stats.aiTriggered > 0 ? ((this.stats.signalsSent / this.stats.aiTriggered) * 100).toFixed(1) : 0}%\n`);
  }
  
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if executed directly
if (require.main === module) {
  const config = {
    pairs: process.env.MONITOR_PAIRS?.split(',') || ['BTC/USDT', 'ETH/USDT'],
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000, // 1 minute
    minConfidence: parseInt(process.env.MIN_CONFIDENCE) || 70,
    cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES) || 60,
  };
  
  const monitor = new ContinuousMonitor(config);
  
  monitor.start().catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = ContinuousMonitor;
