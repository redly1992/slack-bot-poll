require('dotenv').config();
const InstructionParser = require('./src/instructionParser');
const MarketDataFetcher = require('./src/marketData');
const IndicatorCalculator = require('./src/indicatorCalculator');
const AIAnalyzer = require('./src/aiAnalyzer');
const TelegramNotifier = require('./src/telegramNotifier');

/**
 * Price Prediction Tool - Follows strategy.md
 * Tracks BTC and ETH with Buy/Sell signals, Entry, and Stop Loss
 */

class PricePredictionTool {
  constructor() {
    this.exchange = process.env.EXCHANGE || 'binance';
    this.marketData = new MarketDataFetcher(this.exchange);
    this.parser = new InstructionParser('instructions/learned-strategy.md');
    
    // Initialize DeepSeek AI
    const aiProvider = process.env.AI_PROVIDER || 'deepseek';
    let aiApiKey, aiModel;
    
    if (aiProvider === 'deepseek') {
      aiApiKey = process.env.DEEPSEEK_API_KEY;
      aiModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    } else if (aiProvider === 'gemini') {
      aiApiKey = process.env.GEMINI_API_KEY;
      aiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    } else if (aiProvider === 'openai') {
      aiApiKey = process.env.OPENAI_API_KEY;
      aiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }
    
    if (!aiApiKey || aiApiKey.includes('your_')) {
      throw new Error(`${aiProvider.toUpperCase()}_API_KEY not configured in .env file`);
    }
    
    this.aiAnalyzer = new AIAnalyzer({
      provider: aiProvider,
      apiKey: aiApiKey,
      model: aiModel
    });
    
    // Initialize Telegram notifier (optional)
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (telegramToken && telegramChatId && !telegramToken.includes('your_') && !telegramChatId.includes('your_')) {
      this.telegram = new TelegramNotifier(telegramToken, telegramChatId);
      console.log(`\n🤖 Price Prediction Tool initialized with ${aiProvider.toUpperCase()}`);
      console.log(`📱 Telegram notifications ENABLED\n`);
    } else {
      this.telegram = null;
      console.log(`\n🤖 Price Prediction Tool initialized with ${aiProvider.toUpperCase()}`);
      console.log(`⚠️  Telegram notifications DISABLED (configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable)\n`);
    }
  }
  
  /**
   * Fetch higher timeframe trend (1D + 4H)
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
      if (dailyTrend.trend === 'BULLISH' && h4Trend.trend === 'BULLISH') overallTrend = 'BULLISH';
      else if (dailyTrend.trend === 'BEARISH' && h4Trend.trend === 'BEARISH') overallTrend = 'BEARISH';
      else if (dailyTrend.trend !== h4Trend.trend && dailyTrend.trend !== 'NEUTRAL' && h4Trend.trend !== 'NEUTRAL') {
        overallTrend = 'MIXED';
      }
      
      return { daily: dailyTrend, h4: h4Trend, overallTrend };
    } catch (error) {
      console.error(`⚠️  Could not fetch higher timeframe data: ${error.message}`);
      return { daily: { trend: 'NEUTRAL' }, h4: { trend: 'NEUTRAL' }, overallTrend: 'NEUTRAL' };
    }
  }
  
  /**
   * Predict price for a single pair
   */
  async predictPair(pair, timeframe = '15m') {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 ${pair.toUpperCase()} PRICE PREDICTION`);
      console.log(`${'='.repeat(60)}\n`);
      
      // Step 1: Get higher timeframe trend
      const trendContext = await this.getHigherTimeframeTrend(pair);
      console.log(`🔭 Higher Timeframe Trend:`);
      console.log(`   Daily: ${trendContext.daily.trend} | 4H: ${trendContext.h4.trend}`);
      console.log(`   Overall: ${trendContext.overallTrend}\n`);
      
      // Step 2: Fetch entry timeframe data (15m)
      const ohlcv = await this.marketData.fetchOHLCV(pair, timeframe, 100);
      
      // Step 3: Calculate technical indicators
      const indicatorConfig = {
        rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
        ema: { enabled: true, fastPeriod: 9, slowPeriod: 21 },
        macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        bollinger: { enabled: true, period: 20, stdDev: 2 },
        stochastic: { enabled: true, kPeriod: 14, dPeriod: 3, smooth: 3 }
      };
      
      const indicators = IndicatorCalculator.calculateAll(ohlcv, indicatorConfig);
      const atr = IndicatorCalculator.calculateATR(ohlcv, 14);
      
      console.log(`📈 Current Market Data:`);
      console.log(`   Price: $${indicators.price.toFixed(2)}`);
      console.log(`   RSI(14): ${indicators.rsi.toFixed(2)}`);
      console.log(`   EMA(9/21): ${indicators.ema.fast.toFixed(2)} / ${indicators.ema.slow.toFixed(2)}`);
      console.log(`   Stochastic: %K=${indicators.stochastic.k.toFixed(2)} %D=${indicators.stochastic.d.toFixed(2)}`);
      console.log(`   ATR(14): ${atr.toFixed(4)}\n`);
      
      // Step 4: AI Analysis
      console.log(`🤖 Running AI Analysis...\n`);
      const config = {
        _strategyContent: this.parser.getStrategyContent(),
        _trendContext: trendContext,
        timeframe: timeframe
      };
      
      const aiAnalysis = await this.aiAnalyzer.analyzeMarket(pair, indicators, ohlcv, config);
      
      // Step 5: AI gives LONG or SHORT based on 4H
      let signal = aiAnalysis.signal;
      
      // Normalize signal (just in case AI returns BUY/SELL instead of LONG/SHORT)
      if (signal === 'BUY') signal = 'LONG';
      if (signal === 'SELL') signal = 'SHORT';
      if (signal === 'HOLD') {
        // Force a direction based on 4H trend if AI somehow returns HOLD
        if (trendContext.h4.trend === 'BULLISH') signal = 'LONG';
        else if (trendContext.h4.trend === 'BEARISH') signal = 'SHORT';
        else signal = (indicators.ema.fast > indicators.ema.slow) ? 'LONG' : 'SHORT';
        console.log(`⚠️  AI returned HOLD, forced to ${signal} based on 4H trend\n`);
      }
      
      // Step 6: Calculate Entry, Stop Loss, Take Profit
      let entry, stopLoss, tp1, tp2, tp3;
      
      entry = indicators.price;
      const direction = signal === 'LONG' ? 'BUY' : 'SELL';
      
      stopLoss = IndicatorCalculator.calculateStopLoss(entry, atr, direction, 1.5);
      const targets = IndicatorCalculator.calculateTakeProfits(entry, stopLoss, direction);
      tp1 = targets.tp1;
      tp2 = targets.tp2;
      tp3 = targets.tp3;
      
      // Step 7: Output formatted prediction
      console.log(`${'═'.repeat(60)}`);
      console.log(`📋 TRADING RECOMMENDATION`);
      console.log(`${'═'.repeat(60)}\n`);
      
      console.log(`📌 Trading Pair:  ${pair.toUpperCase()}`);
      console.log(`🎯 Position:      ${this.getSignalEmoji(signal)} ${signal}`);
      console.log(`💰 Entry Price:   $${entry.toFixed(2)}`);
      
      const riskPercent = Math.abs((entry - stopLoss) / entry * 100).toFixed(2);
      console.log(`🛑 Stop Loss:     $${stopLoss.toFixed(2)} (${riskPercent}% risk)`);
      
      const tp1Percent = Math.abs((tp1 - entry) / entry * 100).toFixed(2);
      const tp2Percent = Math.abs((tp2 - entry) / entry * 100).toFixed(2);
      const tp3Percent = Math.abs((tp3 - entry) / entry * 100).toFixed(2);
      console.log(`🎯 Take Profit 1: $${tp1.toFixed(2)} (+${tp1Percent}%)`);
      console.log(`🎯 Take Profit 2: $${tp2.toFixed(2)} (+${tp2Percent}%)`);
      console.log(`🎯 Take Profit 3: $${tp3.toFixed(2)} (+${tp3Percent}%)`);
      
      console.log(`\n📊 AI Analysis:`);
      console.log(`   Confidence: ${aiAnalysis.confidence}%`);
      console.log(`   Risk Level: ${aiAnalysis.riskLevel}`);
      
      if (aiAnalysis.entryReason) {
        console.log(`\n💡 Entry Reason:`);
        console.log(`   ${aiAnalysis.entryReason}`);
      }
      
      if (aiAnalysis.stopLossReason) {
        console.log(`\n🛑 Stop Loss Reasoning:`);
        console.log(`   ${aiAnalysis.stopLossReason}`);
      }
      
      if (aiAnalysis.reasoning && aiAnalysis.reasoning.length > 0) {
        console.log(`\n📝 Analysis:`);
        aiAnalysis.reasoning.forEach((reason, i) => {
          console.log(`   ${i + 1}. ${reason}`);
        });
      }
      
      if (aiAnalysis.marketAnalysis) {
        console.log(`\n📈 Market Context:`);
        console.log(`   ${aiAnalysis.marketAnalysis}`);
      }
      
      console.log(`\n${'═'.repeat(60)}\n`);
      
      return {
        pair: pair.toUpperCase(),
        signal: signal,
        entry: entry,
        stopLoss: stopLoss,
        tp1: tp1,
        tp2: tp2,
        tp3: tp3,
        confidence: aiAnalysis.confidence,
        riskLevel: aiAnalysis.riskLevel,
        trend: trendContext.overallTrend,
        reasoning: aiAnalysis.reasoning,
        entryReason: aiAnalysis.entryReason,
        stopLossReason: aiAnalysis.stopLossReason,
        indicators: indicators
      };
      
    } catch (error) {
      console.error(`\n❌ Error predicting ${pair}: ${error.message}\n`);
      return null;
    }
  }
  
  /**
   * Send Telegram notification for prediction
   */
  async sendTelegramNotification(result) {
    if (!this.telegram) return;
    
    try {
      const emoji = this.getSignalEmoji(result.signal);
      const riskPercent = result.stopLoss ? Math.abs((result.entry - result.stopLoss) / result.entry * 100).toFixed(2) : 'N/A';
      
      const message = `
🎯 *TRADING PREDICTION*

*Pair:* ${result.pair}
*Position:* ${emoji} *${result.signal}*
*Trend:* ${result.trend}
*Risk Level:* ${result.riskLevel}

📊 *Entry & Targets:*
▫️ Entry: $${result.entry.toFixed(2)}
▫️ Stop Loss: $${result.stopLoss ? result.stopLoss.toFixed(2) : 'N/A'} (${riskPercent}%)
▫️ TP1: $${result.tp1 ? result.tp1.toFixed(2) : 'N/A'}
▫️ TP2: $${result.tp2 ? result.tp2.toFixed(2) : 'N/A'}
▫️ TP3: $${result.tp3 ? result.tp3.toFixed(2) : 'N/A'}

💡 *Entry Reason:*
${result.entryReason || 'Not specified'}

🛡️ *Stop Loss Reason:*
${result.stopLossReason || 'Not specified'}

📈 *AI Confidence:* ${result.confidence}%

📝 *Analysis:*
${result.reasoning.map((r, i) => `${i + 1}. ${r}`).join('\n')}

⏰ ${new Date().toLocaleString()}
`.trim();

      await this.telegram.bot.sendMessage(this.telegram.chatId, message, { parse_mode: 'Markdown' });
      console.log(`📱 Telegram notification sent for ${result.pair}`);
    } catch (error) {
      console.error(`⚠️  Failed to send Telegram notification: ${error.message}`);
    }
  }
  
  /**
   * Get emoji for signal
   */
  getSignalEmoji(signal) {
    const emojis = {
      'LONG': '🟢',
      'SHORT': '🔴',
      'BUY': '🟢',
      'SELL': '🔴',
      'HOLD': '⚪'
    };
    return emojis[signal] || '⚪';
  }
  
  /**
   * Run predictions for multiple pairs
   */
  async run(pairs = ['BTC/USDT', 'ETH/USDT']) {
    console.log(`\n${'█'.repeat(60)}`);
    console.log(`🚀 CRYPTO TRADING PRICE PREDICTION`);
    console.log(`   Following Strategy.md Guidelines`);
    console.log(`${'█'.repeat(60)}\n`);
    
    const results = [];
    
    for (const pair of pairs) {
      const result = await this.predictPair(pair);
      if (result) {
        results.push(result);
        
        // Send Telegram notification for this prediction
        if (this.telegram) {
          await this.sendTelegramNotification(result);
        }
      }
      
      // Wait a bit between pairs to avoid rate limiting
      if (pairs.indexOf(pair) < pairs.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Summary table
    console.log(`\n${'█'.repeat(60)}`);
    console.log(`📊 SUMMARY TABLE`);
    console.log(`${'█'.repeat(60)}\n`);
    
    console.log(`${'─'.repeat(70)}`);
    console.log(`| Pair      | Position | Entry      | Stop Loss  | Risk % | Confidence |`);
    console.log(`${'─'.repeat(70)}`);
    
    results.forEach(r => {
      const pairPad = r.pair.padEnd(9);
      const signalPad = `${this.getSignalEmoji(r.signal)} ${r.signal}`.padEnd(8);
      const entryPad = `$${r.entry.toFixed(2)}`.padEnd(10);
      const slPad = r.stopLoss ? `$${r.stopLoss.toFixed(2)}`.padEnd(10) : 'N/A'.padEnd(10);
      const riskPad = r.stopLoss ? `${Math.abs((r.entry - r.stopLoss) / r.entry * 100).toFixed(2)}%`.padEnd(6) : 'N/A'.padEnd(6);
      const confPad = `${r.confidence}%`.padEnd(10);
      console.log(`| ${pairPad} | ${signalPad} | ${entryPad} | ${slPad} | ${riskPad} | ${confPad} |`);
    });
    
    console.log(`${'─'.repeat(70)}\n`);
    
    // Send summary to Telegram
    if (this.telegram && results.length > 0) {
      await this.sendTelegramSummary(results);
    }
    
    return results;
  }
  
  /**
   * Send summary of all predictions to Telegram
   */
  async sendTelegramSummary(results) {
    if (!this.telegram || results.length === 0) return;
    
    try {
      let summaryMessage = `\n📊 *PREDICTION SUMMARY*\n\n`;
      
      results.forEach(r => {
        const emoji = this.getSignalEmoji(r.signal);
        const riskPercent = r.stopLoss ? Math.abs((r.entry - r.stopLoss) / r.entry * 100).toFixed(2) : 'N/A';
        summaryMessage += `${emoji} *${r.pair}* - ${r.signal}\n`;
        summaryMessage += `   Entry: $${r.entry.toFixed(2)} | SL: $${r.stopLoss ? r.stopLoss.toFixed(2) : 'N/A'} | Risk: ${riskPercent}%\n`;
        summaryMessage += `   Confidence: ${r.confidence}% | Trend: ${r.trend}\n\n`;
      });
      
      summaryMessage += `⏰ ${new Date().toLocaleString()}`;
      
      await this.telegram.bot.sendMessage(this.telegram.chatId, summaryMessage, { parse_mode: 'Markdown' });
      console.log(`📱 Telegram summary sent for ${results.length} predictions`);
    } catch (error) {
      console.error(`⚠️  Failed to send Telegram summary: ${error.message}`);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const predictor = new PricePredictionTool();
  
  // Get pairs from command line or use default (BTC, ETH)
  const pairs = process.argv.slice(2);
  const tradingPairs = pairs.length > 0 
    ? pairs.map(p => p.includes('/') ? p : `${p}/USDT`)
    : ['BTC/USDT', 'ETH/USDT'];
  
  predictor.run(tradingPairs)
    .then(() => {
      console.log('✅ Prediction complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Fatal error: ${error.message}\n`);
      process.exit(1);
    });
}

module.exports = PricePredictionTool;
