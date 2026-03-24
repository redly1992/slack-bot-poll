require('dotenv').config();
const InstructionParser = require('./instructionParser');
const MarketDataFetcher = require('./marketData');
const IndicatorCalculator = require('./indicatorCalculator');
const SignalEvaluator = require('./signalEvaluator');
const TelegramNotifier = require('./telegramNotifier');
const InstagramNotifier = require('./instagramNotifier');
const AIAnalyzer = require('./aiAnalyzer');

class TradingBot {
  constructor() {
    // Load configuration
    this.instructionFile = process.env.INSTRUCTION_FILE || 'instructions/default.md';
    this.dryRun = process.env.DRY_RUN === 'true';
    this.exchange = process.env.EXCHANGE || 'binance';

    // Initialize components
    this.parser = new InstructionParser(this.instructionFile);
    this.marketData = new MarketDataFetcher(this.exchange);
    
    // Initialize AI analyzer (optional)
    const aiEnabled = process.env.AI_ENABLED === 'true';
    const aiProvider = process.env.AI_PROVIDER || 'gemini'; // Default to Gemini
    
    // Get API key and model based on provider
    let aiApiKey, aiModel;
    if (aiProvider === 'openai') {
      aiApiKey = process.env.OPENAI_API_KEY;
      aiModel = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
    } else if (aiProvider === 'gemini') {
      aiApiKey = process.env.GEMINI_API_KEY;
      aiModel = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash';
    }

    if (aiEnabled && aiApiKey && !aiApiKey.includes('your_')) {
      try {
        this.aiAnalyzer = new AIAnalyzer({
          provider: aiProvider,
          apiKey: aiApiKey,
          model: aiModel
        });
        this.useAI = true;
      } catch (error) {
        console.log(`⚠️  AI Analyzer initialization failed: ${error.message}`);
        this.useAI = false;
      }
    } else if (aiEnabled) {
      console.log(`⚠️  AI enabled but ${aiProvider.toUpperCase()}_API_KEY not configured, using technical indicators only`);
      this.useAI = false;
    } else {
      console.log('ℹ️  AI analysis disabled, using technical indicators only');
      this.useAI = false;
    }
    
    // Initialize notifiers (only if not dry run)
    this.notifiers = [];
    
    if (!this.dryRun) {
      // Telegram notifier
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID;

      if (telegramToken && telegramChatId) {
        this.telegramNotifier = new TelegramNotifier(telegramToken, telegramChatId);
        this.notifiers.push({ name: 'Telegram', notifier: this.telegramNotifier });
        console.log('✅ Telegram notifier enabled');
      } else {
        console.log('⚠️  Telegram credentials not found, Telegram notifications disabled');
      }

      // Instagram notifier (optional)
      const instagramEnabled = process.env.INSTAGRAM_ENABLED === 'true';
      const instagramUsername = process.env.INSTAGRAM_USERNAME;
      const instagramPassword = process.env.INSTAGRAM_PASSWORD;

      if (instagramEnabled && instagramUsername && instagramPassword) {
        this.instagramNotifier = new InstagramNotifier(instagramUsername, instagramPassword);
        this.notifiers.push({ name: 'Instagram', notifier: this.instagramNotifier });
        console.log('✅ Instagram notifier enabled');
      } else if (instagramEnabled) {
        console.log('⚠️  Instagram credentials not found, Instagram notifications disabled');
      }
    }

    console.log(`🤖 Trading Bot initialized (${this.dryRun ? 'DRY RUN' : 'LIVE'} mode)${this.useAI ? ' with AI' : ''}`);
  }

  /**
   * Fetch and analyze higher timeframe trends (1d + 4h)
   * @returns {{ daily: Object, h4: Object, overallTrend: string }}
   */
  async getHigherTimeframeTrend(pair) {
    try {
      const [daily, h4] = await Promise.all([
        this.marketData.fetchOHLCV(pair, '1d', 60),
        this.marketData.fetchOHLCV(pair, '4h', 60),
      ]);

      const dailyTrend = IndicatorCalculator.determineTrend(daily);
      const h4Trend = IndicatorCalculator.determineTrend(h4);

      // Overall trend = both agree → strong signal; mixed → neutral
      let overallTrend = 'NEUTRAL';
      if (dailyTrend.trend === 'BULLISH' && h4Trend.trend === 'BULLISH') overallTrend = 'BULLISH';
      else if (dailyTrend.trend === 'BEARISH' && h4Trend.trend === 'BEARISH') overallTrend = 'BEARISH';
      else if (dailyTrend.trend !== h4Trend.trend && dailyTrend.trend !== 'NEUTRAL' && h4Trend.trend !== 'NEUTRAL') {
        overallTrend = 'MIXED';
      }

      return { daily: dailyTrend, h4: h4Trend, overallTrend };
    } catch (error) {
      console.error(`  ⚠️  Could not fetch higher timeframe data: ${error.message}`);
      return { daily: { trend: 'NEUTRAL' }, h4: { trend: 'NEUTRAL' }, overallTrend: 'NEUTRAL' };
    }
  }

  /**
   * Run the bot analysis
   */
  async run() {
    try {
      console.log('\n📊 Starting market analysis...\n');

      // Parse instruction file
      const config = this.parser.parse();
      const pairs = this.parser.getPairs();
      const timeframe = this.parser.getTimeframe();
      const candleLimit = this.parser.getCandleLimit();
      const indicators = this.parser.getIndicators();
      const signals = this.parser.getSignals();
      const notificationSettings = this.parser.getNotificationSettings();

      console.log(`Analyzing ${pairs.length} pairs on ${timeframe} timeframe`);
      console.log(`Pairs: ${pairs.join(', ')}\n`);

      // Analyze each trading pair
      for (const pair of pairs) {
        await this.analyzePair(
          pair,
          timeframe,
          candleLimit,
          indicators,
          signals,
          notificationSettings,
          config
        );
      }

      console.log('\n✅ Analysis complete\n');
    } catch (error) {
      console.error(`❌ Bot error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze a single trading pair
   */
  async analyzePair(pair, timeframe, candleLimit, indicatorConfig, signalRules, notificationSettings, rawConfig) {
    try {
      console.log(`\n📈 Analyzing ${pair}...`);

      // --- Step 1: Higher timeframe trend (1d + 4h) ---
      console.log(`  🔭 Fetching higher timeframe trend (1d / 4h)...`);
      const trendContext = await this.getHigherTimeframeTrend(pair);
      const trendEmoji = { BULLISH: '📈', BEARISH: '📉', NEUTRAL: '➡️', MIXED: '↔️' }[trendContext.overallTrend] || '➡️';
      console.log(`  ${trendEmoji} Trend → Daily: ${trendContext.daily.trend} | 4H: ${trendContext.h4.trend} | Overall: ${trendContext.overallTrend}`);

      // --- Step 2: 15m entry data ---
      const ohlcv = await this.marketData.fetchOHLCV(pair, timeframe, candleLimit);
      console.log(`  Fetched ${ohlcv.length} candles (${timeframe})`);

      // --- Step 3: Calculate indicators ---
      const indicators = IndicatorCalculator.calculateAll(ohlcv, indicatorConfig);
      console.log(`  Current price: $${indicators.price.toFixed(2)}`);
      if (indicators.rsi) console.log(`  RSI: ${indicators.rsi.toFixed(2)}`);
      if (indicators.ema) console.log(`  EMA Fast: ${indicators.ema.fast.toFixed(2)} | Slow: ${indicators.ema.slow.toFixed(2)}`);
      if (indicators.stochastic) {
        console.log(`  Stochastic %K: ${indicators.stochastic.k.toFixed(2)} | %D: ${indicators.stochastic.d.toFixed(2)}`);
      }

      // --- Step 4: ATR-based stop-loss ---
      let atr = null;
      try {
        atr = IndicatorCalculator.calculateATR(ohlcv, 14);
        console.log(`  ATR(14): ${atr.toFixed(4)}`);
      } catch (e) {
        console.error(`  ATR error: ${e.message}`);
      }

      // --- Step 5: Technical signal evaluation ---
      const technicalEvaluation = SignalEvaluator.evaluate(indicators, signalRules, indicatorConfig);

      // --- Step 6: AI or technical decision ---
      let finalDecision;
      if (this.useAI) {
        console.log(`  🤖 Running AI analysis...`);
        const enrichedConfig = {
          ...rawConfig,
          _strategyContent: this.parser.getStrategyContent(),
          _trendContext: trendContext,
        };
        const aiAnalysis = await this.aiAnalyzer.analyzeMarket(pair, indicators, ohlcv, enrichedConfig);

        console.log(`  🤖 AI Signal: ${aiAnalysis.signal} (${aiAnalysis.confidence}% confidence)`);
        if (aiAnalysis.marketAnalysis) console.log(`  📊 ${aiAnalysis.marketAnalysis}`);

        finalDecision = {
          decision: aiAnalysis.signal,
          source: 'ai',
          reasons: aiAnalysis.reasoning || [],
          confidence: aiAnalysis.confidence,
          aiAnalysis: aiAnalysis.marketAnalysis,
          riskLevel: aiAnalysis.riskLevel,
        };
      } else {
        finalDecision = {
          decision: technicalEvaluation.buy ? 'BUY' : technicalEvaluation.sell ? 'SELL' : 'HOLD',
          source: 'technical',
          reasons: technicalEvaluation.buy ? technicalEvaluation.buyReasons : technicalEvaluation.sellReasons,
          confidence: 50,
        };
      }

      // --- Step 7: Filter by higher timeframe trend ---
      if (finalDecision.decision === 'BUY' && trendContext.overallTrend === 'BEARISH') {
        console.log(`  ⛔ BUY signal filtered out — higher TF trend is BEARISH`);
        finalDecision.decision = 'HOLD';
        finalDecision.reasons = ['BUY suppressed: higher timeframe trend is bearish'];
        finalDecision.confidence = Math.min(finalDecision.confidence, 30);
      } else if (finalDecision.decision === 'SELL' && trendContext.overallTrend === 'BULLISH') {
        console.log(`  ⛔ SELL signal filtered out — higher TF trend is BULLISH`);
        finalDecision.decision = 'HOLD';
        finalDecision.reasons = ['SELL suppressed: higher timeframe trend is bullish'];
        finalDecision.confidence = Math.min(finalDecision.confidence, 30);
      }

      // --- Step 8: Calculate SL / TP (always — even for HOLD, show trend-aligned levels) ---
      let riskManagement = null;
      if (atr) {
        // For active signals use the signal direction.
        // For HOLD, derive the watch direction from the higher TF trend so the
        // trader knows where to place orders if/when a setup forms.
        let rmDirection = finalDecision.decision;
        let isWatchOnly = false;
        if (rmDirection === 'HOLD') {
          if (trendContext.overallTrend === 'BULLISH') { rmDirection = 'BUY'; isWatchOnly = true; }
          else if (trendContext.overallTrend === 'BEARISH') { rmDirection = 'SELL'; isWatchOnly = true; }
        }

        if (rmDirection !== 'HOLD') {
          const stopLoss = IndicatorCalculator.calculateStopLoss(indicators.price, atr, rmDirection, 1.5);
          const { tp1, tp2, tp3, riskAmount } = IndicatorCalculator.calculateTakeProfits(indicators.price, stopLoss, rmDirection);
          riskManagement = { stopLoss, tp1, tp2, tp3, riskAmount, atr, direction: rmDirection, isWatchOnly };
          const slLabel = isWatchOnly ? '🔍 Watch' : '🛑 Stop Loss';
          console.log(`  ${slLabel} (${rmDirection}): $${stopLoss.toFixed(2)} | 1.5×ATR=$${(atr * 1.5).toFixed(4)}`);
          console.log(`  🎯 TP1: $${tp1.toFixed(2)} | TP2: $${tp2.toFixed(2)} | TP3: $${tp3.toFixed(2)}`);
        }
      }

      // Log signal reasons
      if (finalDecision.reasons && finalDecision.reasons.length > 0) {
        const icon = finalDecision.decision === 'BUY' ? '🟢' : finalDecision.decision === 'SELL' ? '🔴' : '⚪';
        console.log(`  ${icon} ${finalDecision.decision} signal`);
        finalDecision.reasons.forEach(reason => console.log(`    - ${reason}`));
      }
      console.log(`  🎯 Final Decision: ${finalDecision.decision} (${finalDecision.source})`);

      // --- Step 9: Send notification ---
      if (!this.dryRun && notificationSettings.enabled) {
        for (const { name, notifier } of this.notifiers) {
          const notifierEnabled = notificationSettings[name.toLowerCase()] !== false;
          if (notifierEnabled) {
            if (finalDecision.decision === 'HOLD') {
              await notifier.sendMarketUpdate(pair, indicators, finalDecision, trendContext, riskManagement);
            } else {
              await notifier.sendSignal(
                pair,
                finalDecision.decision,
                indicators,
                finalDecision.reasons,
                {
                  cooldownMinutes: notificationSettings.cooldownMinutes,
                  aiAnalysis: finalDecision.aiAnalysis,
                  confidence: finalDecision.confidence,
                  riskLevel: finalDecision.riskLevel,
                  trendContext,
                  riskManagement,
                }
              );
            }
          }
        }
      } else if (this.dryRun) {
        console.log(`  [DRY RUN] Would send ${finalDecision.decision} notification`);
      }

    } catch (error) {
      console.error(`  ❌ Error analyzing ${pair}: ${error.message}`);
    }
  }
}

// Run the bot if executed directly
if (require.main === module) {
  const bot = new TradingBot();
  bot.run()
    .then(() => {
      console.log('Bot execution finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = TradingBot;
