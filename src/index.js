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

      // Fetch market data
      const ohlcv = await this.marketData.fetchOHLCV(pair, timeframe, candleLimit);
      console.log(`  Fetched ${ohlcv.length} candles`);

      // Calculate indicators
      const indicators = IndicatorCalculator.calculateAll(ohlcv, indicatorConfig);
      console.log(`  Current price: $${indicators.price.toFixed(2)}`);
      
      if (indicators.rsi) {
        console.log(`  RSI: ${indicators.rsi.toFixed(2)}`);
      }
      if (indicators.ema) {
        console.log(`  EMA Fast: ${indicators.ema.fast.toFixed(2)} | Slow: ${indicators.ema.slow.toFixed(2)}`);
      }

      // Evaluate signals with technical indicators
      const technicalEvaluation = SignalEvaluator.evaluate(indicators, signalRules, indicatorConfig);

      // AI Analysis (if enabled)
      let finalDecision;
      if (this.useAI) {
        console.log(`  🤖 Running AI analysis...`);
        // Pass strategy.md content so AI knows its persona/rules
        const enrichedConfig = {
          ...rawConfig,
          _strategyContent: this.parser.getStrategyContent()
        };
        const aiAnalysis = await this.aiAnalyzer.analyzeMarket(pair, indicators, ohlcv, enrichedConfig);
        
        console.log(`  🤖 AI Signal: ${aiAnalysis.signal} (${aiAnalysis.confidence}% confidence)`);
        if (aiAnalysis.marketAnalysis) {
          console.log(`  📊 ${aiAnalysis.marketAnalysis}`);
        }
        
        // Use AI signal directly (no longer requires all technical conditions)
        finalDecision = {
          decision: aiAnalysis.signal,
          source: 'ai',
          reasons: aiAnalysis.reasoning || [],
          confidence: aiAnalysis.confidence,
          aiAnalysis: aiAnalysis.marketAnalysis,
          riskLevel: aiAnalysis.riskLevel
        };
        console.log(`  🎯 Final Decision: ${finalDecision.decision} (${finalDecision.source})`);
      } else {
        // Use technical indicators only
        finalDecision = {
          decision: technicalEvaluation.buy ? 'BUY' : technicalEvaluation.sell ? 'SELL' : 'HOLD',
          source: 'technical',
          reasons: technicalEvaluation.buy ? technicalEvaluation.buyReasons : technicalEvaluation.sellReasons,
          confidence: 50
        };
      }

      // Log signal reasons
      if (finalDecision.reasons && finalDecision.reasons.length > 0) {
        const icon = finalDecision.decision === 'BUY' ? '🟢' : finalDecision.decision === 'SELL' ? '🔴' : '⚪';
        console.log(`  ${icon} ${finalDecision.decision} signal`);
        finalDecision.reasons.forEach(reason => console.log(`    - ${reason}`));
      }

      // Always send Telegram notification (BUY / SELL / HOLD)
      if (!this.dryRun && notificationSettings.enabled) {
        for (const { name, notifier } of this.notifiers) {
          const notifierEnabled = notificationSettings[name.toLowerCase()] !== false;
          if (notifierEnabled) {
            if (finalDecision.decision === 'HOLD') {
              await notifier.sendMarketUpdate(pair, indicators, finalDecision);
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
                  riskLevel: finalDecision.riskLevel
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
