require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const IndicatorCalculator = require('./src/indicatorCalculator');
const AIAnalyzer = require('./src/aiAnalyzer');

/**
 * Backtesting Engine
 * Simulates continuous monitoring on historical data
 * Records AI predictions and actual outcomes
 */

class BacktestEngine {
  constructor(config = {}) {
    this.dataDir = config.dataDir || 'data';
    this.dbPath = config.dbPath || 'backtest-results.db';
    this.symbol = config.symbol || 'BTC/USDT';
    this.positionSize = config.positionSize || 1000; // $1000 per trade
    this.holdHours = config.holdHours || 24; // Hold for 24 hours
    this.checkpointFile = config.checkpointFile || 'backtest-checkpoint.json';
    this.fresh = config.fresh || false; // If true, ignore checkpoint and start fresh
    
    // Initialize AI
    const aiProvider = process.env.AI_PROVIDER || 'deepseek';
    let aiApiKey, aiModel;
    
    if (aiProvider === 'deepseek') {
      aiApiKey = process.env.DEEPSEEK_API_KEY;
      aiModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    } else if (aiProvider === 'gemini') {
      aiApiKey = process.env.GEMINI_API_KEY;
      aiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    }
    
    if (!aiApiKey || aiApiKey.includes('your_')) {
      throw new Error(`${aiProvider.toUpperCase()}_API_KEY not configured`);
    }
    
    this.aiAnalyzer = new AIAnalyzer({
      provider: aiProvider,
      apiKey: aiApiKey,
      model: aiModel
    });
    
    this.db = null;
    this.stats = {
      candlesProcessed: 0,
      alignmentsDetected: 0,
      signalsRecorded: 0,
      aiCalls: 0
    };
    this.checkpoint = this.loadCheckpoint();
  }
  
  /**
   * Load checkpoint if exists
   */
  loadCheckpoint() {
    // If fresh start requested, ignore checkpoint
    if (this.fresh) {
      console.log('🆕 Fresh start: Ignoring checkpoint');
      return { lastProcessedIndex: -1, lastTimestamp: 0 };
    }
    
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const data = fs.readFileSync(this.checkpointFile, 'utf-8');
        const checkpoint = JSON.parse(data);
        console.log(`📌 Checkpoint loaded: Resume from index ${checkpoint.lastProcessedIndex}`);
        return checkpoint;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load checkpoint: ${error.message}`);
    }
    return { lastProcessedIndex: -1, lastTimestamp: 0 };
  }
  
  /**
   * Save checkpoint
   */
  saveCheckpoint(index, timestamp) {
    try {
      const checkpoint = {
        lastProcessedIndex: index,
        lastTimestamp: timestamp,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      console.warn(`⚠️  Failed to save checkpoint: ${error.message}`);
    }
  }
  
  /**
   * Initialize database
   */
  initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log(`📊 Database initialized: ${this.dbPath}`);
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }
  
  /**
   * Create database tables
   */
  createTables() {
    return new Promise((resolve, reject) => {
      const schema = `
        CREATE TABLE IF NOT EXISTS backtest_signals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER,
          date TEXT,
          pair TEXT,
          
          indicators_5m TEXT,
          indicators_15m TEXT,
          indicators_1h TEXT,
          indicators_4h TEXT,
          
          signal_5m TEXT,
          signal_15m TEXT,
          signal_1h TEXT,
          alignment TEXT,
          
          ai_signal TEXT,
          ai_confidence INTEGER,
          ai_reasoning TEXT,
          ai_entry_reason TEXT,
          ai_stop_loss_reason TEXT,
          ai_risk_level TEXT,
          
          entry_price REAL,
          direction TEXT,
          
          exit_timestamp INTEGER,
          exit_price REAL,
          pnl_percent REAL,
          pnl_usd REAL,
          result TEXT,
          
          market_condition TEXT,
          was_correct INTEGER
        );
        
        CREATE INDEX IF NOT EXISTS idx_timestamp ON backtest_signals(timestamp);
        CREATE INDEX IF NOT EXISTS idx_result ON backtest_signals(result);
      `;
      
      this.db.exec(schema, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Database tables created');
          resolve();
        }
      });
    });
  }
  
  /**
   * Load CSV data
   */
  loadCSV(timeframe) {
    const filename = path.join(this.dataDir, `${this.symbol.replace('/', '-').toLowerCase()}-${timeframe}.csv`);
    
    if (!fs.existsSync(filename)) {
      throw new Error(`Data file not found: ${filename}`);
    }
    
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Skip header, parse data
    const data = lines.slice(1).map(line => {
      const parts = line.split(',');
      return {
        timestamp: parseInt(parts[0]),
        date: parts[1],
        open: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        close: parseFloat(parts[5]),
        volume: parseFloat(parts[6])
      };
    });
    
    console.log(`📁 Loaded ${data.length} candles from ${timeframe} data`);
    return data;
  }
  
  /**
   * Get candles up to timestamp
   */
  getCandlesUpTo(allData, timestamp, count = 100) {
    const index = allData.findIndex(c => c.timestamp === timestamp);
    if (index < count) return null; // Not enough history
    
    return allData.slice(Math.max(0, index - count + 1), index + 1);
  }
  
  /**
   * Calculate indicators for candles
   */
  calculateIndicators(candles) {
    const indicatorConfig = {
      rsi: { enabled: true, period: 14, overbought: 70, oversold: 30 },
      ema: { enabled: true, fastPeriod: 9, slowPeriod: 21 },
      macd: { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      bollinger: { enabled: true, period: 20, stdDev: 2 },
      stochastic: { enabled: true, kPeriod: 14, dPeriod: 3, smooth: 3 }
    };
    
    return IndicatorCalculator.calculateAll(candles, indicatorConfig);
  }
  
  /**
   * Determine signal from indicators
   */
  determineSignal(indicators) {
    let buyScore = 0;
    let sellScore = 0;
    const reasons = [];
    
    // RSI
    if (indicators.rsi < 45) {
      buyScore++;
      reasons.push(`RSI oversold (${indicators.rsi.toFixed(1)})`);
    }
    if (indicators.rsi > 55) {
      sellScore++;
      reasons.push(`RSI overbought (${indicators.rsi.toFixed(1)})`);
    }
    
    // EMA
    const emaFast = indicators.ema?.fast || 0;
    const emaSlow = indicators.ema?.slow || 0;
    
    if (emaFast > emaSlow) {
      buyScore++;
      reasons.push('EMA bullish');
    }
    if (emaFast < emaSlow) {
      sellScore++;
      reasons.push('EMA bearish');
    }
    
    // MACD
    const macd = indicators.macd?.histogram || 0;
    if (macd > 0) {
      buyScore++;
      reasons.push('MACD positive');
    }
    if (macd < 0) {
      sellScore++;
      reasons.push('MACD negative');
    }
    
    // Stochastic
    const stochK = indicators.stochastic?.k || 50;
    const stochD = indicators.stochastic?.d || 50;
    
    if (stochK < 30) {
      buyScore++;
      reasons.push('Stoch oversold');
    }
    if (stochK > 70) {
      sellScore++;
      reasons.push('Stoch overbought');
    }
    
    // Bollinger
    const price = indicators.price;
    const bbLower = indicators.bollinger?.lower;
    const bbUpper = indicators.bollinger?.upper;
    
    if (bbLower && price < bbLower * 1.005) {
      buyScore++;
      reasons.push('Near BB lower');
    }
    if (bbUpper && price > bbUpper * 0.995) {
      sellScore++;
      reasons.push('Near BB upper');
    }
    
    // Require at least 2 indicators agreeing (lowered from 3)
    if (buyScore >= 2) return { signal: 'BUY', score: buyScore, reasons };
    if (sellScore >= 2) return { signal: 'SELL', score: sellScore, reasons };
    return { signal: 'NEUTRAL', score: 0, reasons };
  }
  
  /**
   * Get AI prediction
   */
  async getAIPrediction(indicators15m, indicators4h, candles15m) {
    try {
      // Build trend context similar to continuous-monitor.js
      const trendContext = {
        h4: {
          trend: indicators4h.ema?.fast > indicators4h.ema?.slow ? 'BULLISH' : 'BEARISH',
          rsi: indicators4h.rsi,
          macd: indicators4h.macd?.histogram > 0 ? 'positive' : 'negative'
        },
        daily: { trend: 'NEUTRAL' }, // We don't have daily data
        overallTrend: indicators4h.ema?.fast > indicators4h.ema?.slow ? 'BULLISH' : 'BEARISH'
      };
      
      // Call analyzeMarket with correct parameter order
      const aiAnalysis = await this.aiAnalyzer.analyzeMarket(
        this.symbol,
        indicators15m,
        candles15m,
        {}, // config can be empty, aiAnalyzer loads strategy.md internally
        trendContext
      );
      
      this.stats.aiCalls++;
      return aiAnalysis;
    } catch (error) {
      console.error(`  ⚠️  AI analysis failed: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Record signal to database
   */
  recordSignal(signalData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO backtest_signals (
          timestamp, date, pair,
          indicators_5m, indicators_15m, indicators_1h, indicators_4h,
          signal_5m, signal_15m, signal_1h, alignment,
          ai_signal, ai_confidence, ai_reasoning, ai_entry_reason, ai_stop_loss_reason, ai_risk_level,
          entry_price, direction, market_condition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        signalData.timestamp,
        signalData.date,
        signalData.pair,
        JSON.stringify(signalData.indicators_5m),
        JSON.stringify(signalData.indicators_15m),
        JSON.stringify(signalData.indicators_1h),
        JSON.stringify(signalData.indicators_4h),
        signalData.signal_5m,
        signalData.signal_15m,
        signalData.signal_1h,
        signalData.alignment,
        signalData.ai_signal,
        signalData.ai_confidence,
        JSON.stringify(signalData.ai_reasoning),
        signalData.ai_entry_reason,
        signalData.ai_stop_loss_reason,
        signalData.ai_risk_level,
        signalData.entry_price,
        signalData.direction,
        signalData.market_condition,
        (err) => {
          if (err) reject(err);
          else {
            this.stats.signalsRecorded++;
            resolve();
          }
        }
      );
      
      stmt.finalize();
    });
  }
  
  /**
   * Run backtest
   */
  async run() {
    console.log('\n🚀 Starting Backtest');
    console.log(`${'='.repeat(60)}\n`);
    
    // Load data
    const data5m = this.loadCSV('5m');
    const data15m = this.loadCSV('15m');
    const data1h = this.loadCSV('1h');
    const data4h = this.loadCSV('4h');
    
    // Initialize database
    await this.initDatabase();
    
    console.log('\n⏱️  Processing candles...\n');
    
    // Determine start index (resume from checkpoint or start fresh)
    const startIndex = Math.max(100, this.checkpoint.lastProcessedIndex + 1);
    const totalCandles = data15m.length - startIndex;
    
    if (startIndex > 100) {
      console.log(`📌 Resuming from index ${startIndex} (skipping ${startIndex - 100} already processed)\n`);
    }
    
    // Process each 15m candle (our primary timeframe)
    for (let i = startIndex; i < data15m.length; i++) {
      const currentCandle = data15m[i];
      const timestamp = currentCandle.timestamp;
      
      this.stats.candlesProcessed++;
      
      // Get corresponding candles from all timeframes
      const candles5m = this.getCandlesUpTo(data5m, timestamp, 100);
      const candles15m = this.getCandlesUpTo(data15m, timestamp, 100);
      const candles1h = this.getCandlesUpTo(data1h, timestamp, 100);
      const candles4h = this.getCandlesUpTo(data4h, timestamp, 60);
      
      if (!candles5m || !candles15m || !candles1h || !candles4h) continue;
      
      // Calculate indicators
      const ind5m = this.calculateIndicators(candles5m);
      const ind15m = this.calculateIndicators(candles15m);
      const ind1h = this.calculateIndicators(candles1h);
      const ind4h = this.calculateIndicators(candles4h);
      
      // Determine signals
      const sig5m = this.determineSignal(ind5m);
      const sig15m = this.determineSignal(ind15m);
      const sig1h = this.determineSignal(ind1h);
      
      // Check alignment (all timeframes agree)
      const allBuy = sig5m.signal === 'BUY' && sig15m.signal === 'BUY' && sig1h.signal === 'BUY';
      const allSell = sig5m.signal === 'SELL' && sig15m.signal === 'SELL' && sig1h.signal === 'SELL';
      
      if (allBuy || allSell) {
        this.stats.alignmentsDetected++;
        const alignment = allBuy ? 'BUY' : 'SELL';
        
        // Progress indicator
        const progress = ((i / data15m.length) * 100).toFixed(1);
        console.log(`[${progress}%] ${currentCandle.date} - ${alignment} alignment detected at $${currentCandle.close.toFixed(2)}`);
        
        // Get AI prediction
        const aiAnalysis = await this.getAIPrediction(ind15m, ind4h, candles15m);
        
        if (aiAnalysis && aiAnalysis.signal && aiAnalysis.signal !== 'HOLD') {
          // Record signal
          await this.recordSignal({
            timestamp,
            date: currentCandle.date,
            pair: this.symbol,
            indicators_5m: ind5m,
            indicators_15m: ind15m,
            indicators_1h: ind1h,
            indicators_4h: ind4h,
            signal_5m: sig5m.signal,
            signal_15m: sig15m.signal,
            signal_1h: sig1h.signal,
            alignment,
            ai_signal: aiAnalysis.signal,
            ai_confidence: aiAnalysis.confidence || 0,
            ai_reasoning: aiAnalysis.reasoning || [],
            ai_entry_reason: aiAnalysis.entryReason || '',
            ai_stop_loss_reason: aiAnalysis.stopLossReason || '',
            ai_risk_level: aiAnalysis.riskLevel || 'MEDIUM',
            entry_price: currentCandle.close,
            direction: aiAnalysis.signal,
            market_condition: ind4h.ema?.fast > ind4h.ema?.slow ? 'BULLISH' : 'BEARISH'
          });
          
          console.log(`  ✅ AI: ${aiAnalysis.signal} (${aiAnalysis.confidence}%) - Recorded`);
        } else {
          console.log(`  ⏭️  AI returned ${aiAnalysis?.signal || 'no signal'} - Skipped`);
        }
        
        // Limit API calls for cost
        await this.sleep(1000);
      }
      
      // Save checkpoint every 50 candles and update progress bar
      if (i % 50 === 0) {
        this.saveCheckpoint(i, timestamp);
        const processed = i - startIndex;
        const progress = ((processed / totalCandles) * 100).toFixed(1);
        const barWidth = 40;
        const filled = Math.floor((processed / totalCandles) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        
        process.stdout.write(`\r  [${bar}] ${progress}% | Candles: ${this.stats.candlesProcessed} | Alignments: ${this.stats.alignmentsDetected} | Signals: ${this.stats.signalsRecorded} | AI Calls: ${this.stats.aiCalls}`);
      }
    }
    
    // Clear progress bar
    console.log('');
    
    console.log('\n\n✅ Backtest complete!\n');
    this.printStats();
    
    // Clean up checkpoint file on successful completion
    if (fs.existsSync(this.checkpointFile)) {
      fs.unlinkSync(this.checkpointFile);
      console.log('📌 Checkpoint file cleaned up');
    }
    
    await this.close();
  }
  
  /**
   * Print statistics
   */
  printStats() {
    console.log(`${'='.repeat(60)}`);
    console.log('📊 BACKTEST STATISTICS');
    console.log(`${'='.repeat(60)}\n`);
    console.log(`Candles processed:     ${this.stats.candlesProcessed.toLocaleString()}`);
    console.log(`Alignments detected:   ${this.stats.alignmentsDetected}`);
    console.log(`Signals recorded:      ${this.stats.signalsRecorded}`);
    console.log(`AI calls made:         ${this.stats.aiCalls}`);
    console.log(`\n📁 Results saved to:   ${this.dbPath}`);
  }
  
  /**
   * Close database
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('\n🔒 Database closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command-line arguments
 * Supports: --symbol=ETH/USDT, --data-dir=data, etc.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Backtest Engine - Usage

COMMAND-LINE ARGUMENTS:
  --symbol=<string>          Trading pair symbol (default: BTC/USDT)
  --data-dir=<path>          Directory with CSV data (default: data)
  --db-path=<path>           Database file path (default: backtest-results.db)
  --position-size=<number>   Position size in USD (default: 1000)
  --hold-hours=<number>      Hours to hold position (default: 24)
  --fresh                    Start fresh (ignore checkpoint, start from beginning)
  --resume                   Resume from checkpoint (default behavior)
  --help, -h                 Show this help message

CHECKPOINT BEHAVIOR:
  By default, backtest resumes from the last checkpoint if it exists.
  - Checkpoint saves every 50 candles to backtest-checkpoint.json
  - Use --fresh to ignore checkpoint and start from the beginning
  - Use --resume to explicitly resume (same as default)
  - To start completely fresh: rm backtest-checkpoint.json && npm run backtest

EXAMPLES:
  npm run backtest                              # Resume from checkpoint
  npm run backtest -- --fresh                   # Start fresh (ignore checkpoint)
  npm run backtest -- --symbol=ETH/USDT         # Resume ETH backtest
  npm run backtest -- --symbol=ETH/USDT --fresh # Fresh start with ETH
  npm run backtest -- --symbol=SOL/USDT --position-size=500
  node backtest.js --symbol=BTC/USDT --fresh

REQUIREMENTS:
  - CSV files must exist in data directory
  - Naming format: <symbol>-<timeframe>.csv (e.g., btc-usdt-5m.csv)
  - Download data first: npm run download-data

OUTPUT:
  - SQLite database with signals and results
  - Progress bar shows live statistics
  - Checkpoint saved every 50 candles for resume

NOTE: Command-line arguments override environment variables
`);
    process.exit(0);
  }
  
  args.forEach(arg => {
    if (arg === '--fresh') {
      config.fresh = true;
    } else if (arg === '--resume') {
      config.fresh = false;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      if (key === 'symbol') {
        config.symbol = value;
      } else if (key === 'dataDir' || key === 'data-dir') {
        config.dataDir = value;
      } else if (key === 'dbPath' || key === 'db-path') {
        config.dbPath = value;
      } else if (key === 'positionSize' || key === 'position-size') {
        config.positionSize = parseFloat(value);
      } else if (key === 'holdHours' || key === 'hold-hours') {
        config.holdHours = parseInt(value);
      }
    }
  });
  
  return config;
}

// Run if executed directly
if (require.main === module) {
  // Parse command-line arguments first (highest priority)
  const cliArgs = parseArgs();
  
  // Merge with env vars and defaults (CLI args override env vars)
  const config = {
    symbol: cliArgs.symbol || process.env.BACKTEST_SYMBOL || 'BTC/USDT',
    dataDir: cliArgs.dataDir || process.env.BACKTEST_DATA_DIR || 'data',
    dbPath: cliArgs.dbPath || process.env.BACKTEST_DB_PATH || 'backtest-results.db',
    positionSize: cliArgs.positionSize || parseFloat(process.env.BACKTEST_POSITION_SIZE) || 1000,
    holdHours: cliArgs.holdHours || parseInt(process.env.BACKTEST_HOLD_HOURS) || 24,
    fresh: cliArgs.fresh !== undefined ? cliArgs.fresh : false
  };
  
  const engine = new BacktestEngine(config);
  
  engine.run()
    .then(() => {
      console.log('\n✅ Backtest completed successfully!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Backtest failed: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = BacktestEngine;
