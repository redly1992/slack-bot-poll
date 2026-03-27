require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * Calculate Profit & Loss for Backtest Signals
 * Looks 24 hours ahead from each signal to determine actual outcome
 */

class PnLCalculator {
  constructor(config = {}) {
    this.dbPath = config.dbPath || 'backtest-results.db';
    this.dataDir = config.dataDir || 'data';
    this.symbol = config.symbol || 'BTC/USDT';
    this.holdHours = config.holdHours || 24;
    this.positionSize = config.positionSize || 1000; // $1000 per trade
    this.db = null;
    this.data15m = null;
  }
  
  /**
   * Initialize database connection
   */
  initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log(`📊 Database opened: ${this.dbPath}`);
          resolve();
        }
      });
    });
  }
  
  /**
   * Load CSV data for price lookups (includes high/low for SL/TP scanning)
   */
  loadPriceData() {
    const filename = path.join(this.dataDir, `${this.symbol.replace('/', '-').toLowerCase()}-15m.csv`);
    
    if (!fs.existsSync(filename)) {
      throw new Error(`Price data file not found: ${filename}`);
    }
    
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse CSV into sorted array for forward scanning and map for fast lookup
    const candles = [];
    const priceMap = new Map();
    
    lines.slice(1).forEach(line => {
      const parts = line.split(',');
      const timestamp = parseInt(parts[0]);
      const open = parseFloat(parts[2]);
      const high = parseFloat(parts[3]);
      const low = parseFloat(parts[4]);
      const close = parseFloat(parts[5]);
      candles.push({ timestamp, open, high, low, close });
      priceMap.set(timestamp, { open, high, low, close });
    });
    
    // Sort by timestamp ascending
    candles.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`📁 Loaded ${candles.length} price points from 15m data`);
    return { candles, priceMap };
  }
  
  /**
   * Get all signals that need P/L calculation
   */
  getSignalsNeedingPnL() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM backtest_signals 
        WHERE exit_price IS NULL 
        ORDER BY timestamp
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  /**
   * Find exit: scan candles forward from entry, check SL/TP hit or time exit.
   * For LONG: SL hit if candle.low <= stopLoss, TP hit if candle.high >= takeProfit
   * For SHORT: SL hit if candle.high >= stopLoss, TP hit if candle.low <= takeProfit
   * If both SL and TP triggered on same candle, SL wins (conservative).
   * Falls back to time-based exit if no SL/TP set.
   */
  findExit(signal, candles) {
    const entryTimestamp = signal.timestamp;
    const direction = signal.direction;
    const stopLoss = signal.stop_loss_price;
    const takeProfit = signal.take_profit_price;
    const maxExitTimestamp = entryTimestamp + (this.holdHours * 60 * 60 * 1000);

    // Find starting candle index (first candle after entry)
    const startIdx = candles.findIndex(c => c.timestamp > entryTimestamp);
    if (startIdx === -1) return null;

    for (let i = startIdx; i < candles.length; i++) {
      const candle = candles[i];

      // Stop scanning at max hold time
      if (candle.timestamp > maxExitTimestamp) {
        // Time-based exit: use close of the last scanned candle or closest candle
        const timeCandle = candles[i - 1] || candles[startIdx];
        return {
          exitTimestamp: timeCandle.timestamp,
          exitPrice: timeCandle.close,
          exitType: 'TIME'
        };
      }

      if (stopLoss && takeProfit) {
        if (direction === 'LONG') {
          const slHit = candle.low <= stopLoss;
          const tpHit = candle.high >= takeProfit;
          if (slHit) return { exitTimestamp: candle.timestamp, exitPrice: stopLoss, exitType: 'SL' };
          if (tpHit) return { exitTimestamp: candle.timestamp, exitPrice: takeProfit, exitType: 'TP' };
        } else if (direction === 'SHORT') {
          const slHit = candle.high >= stopLoss;
          const tpHit = candle.low <= takeProfit;
          if (slHit) return { exitTimestamp: candle.timestamp, exitPrice: stopLoss, exitType: 'SL' };
          if (tpHit) return { exitTimestamp: candle.timestamp, exitPrice: takeProfit, exitType: 'TP' };
        }
      }
    }

    // Ran out of data
    if (candles.length > startIdx) {
      const last = candles[candles.length - 1];
      return { exitTimestamp: last.timestamp, exitPrice: last.close, exitType: 'TIME' };
    }
    return null;
  }

  /**
   * Legacy: Find exit price N hours after entry (no SL/TP)
   */
  findExitPrice(entryTimestamp, priceMap) {
    const exitTimestamp = entryTimestamp + (this.holdHours * 60 * 60 * 1000);
    
    if (priceMap.has(exitTimestamp)) {
      return { timestamp: exitTimestamp, price: priceMap.get(exitTimestamp).close };
    }
    
    const tolerance = 30 * 60 * 1000;
    for (let offset = 0; offset <= tolerance; offset += 15 * 60 * 1000) {
      const ts1 = exitTimestamp + offset;
      const ts2 = exitTimestamp - offset;
      if (priceMap.has(ts1)) return { timestamp: ts1, price: priceMap.get(ts1).close };
      if (priceMap.has(ts2)) return { timestamp: ts2, price: priceMap.get(ts2).close };
    }
    return null;
  }
  
  /**
   * Calculate P/L for a signal
   */
  calculatePnL(signal, exitPrice, exitType = 'TIME') {
    const entryPrice = signal.entry_price;
    const direction = signal.direction; // LONG or SHORT
    
    let pnlPercent;
    if (direction === 'LONG') {
      pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else if (direction === 'SHORT') {
      pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
    } else {
      return { pnlPercent: 0, pnlUsd: 0, result: 'UNKNOWN', exitType };
    }
    
    const pnlUsd = (this.positionSize * pnlPercent) / 100;
    const result = pnlPercent > 0 ? 'WIN' : pnlPercent < 0 ? 'LOSS' : 'BREAKEVEN';
    
    return {
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      pnlUsd: parseFloat(pnlUsd.toFixed(2)),
      result,
      exitType
    };
  }
  
  /**
   * Update signal with P/L data
   */
  updateSignalPnL(signalId, exitData) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE backtest_signals
        SET exit_timestamp = ?,
            exit_price = ?,
            pnl_percent = ?,
            pnl_usd = ?,
            result = ?,
            was_correct = ?,
            exit_type = ?
        WHERE id = ?
      `, [
        exitData.exitTimestamp,
        exitData.exitPrice,
        exitData.pnlPercent,
        exitData.pnlUsd,
        exitData.result,
        exitData.wasCorrect,
        exitData.exitType,
        signalId
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  /**
   * Calculate P/L for all signals
   */
  async calculate() {
    console.log('\n🚀 Starting P/L Calculation');
    console.log(`${'='.repeat(60)}\n`);
    
    await this.initDatabase();

    // Add exit_type column if it doesn't exist (migration for existing DBs)
    await new Promise((resolve) => {
      this.db.run(`ALTER TABLE backtest_signals ADD COLUMN exit_type TEXT`, () => resolve());
    });

    const { candles, priceMap } = this.loadPriceData();
    const signals = await this.getSignalsNeedingPnL();
    
    console.log(`\n📊 Found ${signals.length} signals needing P/L calculation\n`);
    
    if (signals.length === 0) {
      console.log('✅ All signals already have P/L calculated!\n');
      await this.close();
      return;
    }
    
    let calculated = 0;
    let skipped = 0;
    let slHits = 0, tpHits = 0, timeExits = 0;
    
    for (const signal of signals) {
      let exitInfo;

      if (signal.stop_loss_price && signal.take_profit_price) {
        // Use SL/TP-aware scanning
        exitInfo = this.findExit(signal, candles);
        if (exitInfo) {
          exitInfo = { timestamp: exitInfo.exitTimestamp, price: exitInfo.exitPrice, exitType: exitInfo.exitType };
        }
      } else {
        // Fallback: time-based exit (no SL/TP stored)
        const legacyExit = this.findExitPrice(signal.timestamp, priceMap);
        if (legacyExit) {
          exitInfo = { timestamp: legacyExit.timestamp, price: legacyExit.price, exitType: 'TIME' };
        }
      }
      
      if (!exitInfo) {
        skipped++;
        console.log(`⏭️  Signal #${signal.id} - No exit data available (end of dataset)`);
        continue;
      }
      
      const pnl = this.calculatePnL(signal, exitInfo.price, exitInfo.exitType);
      const wasCorrect = pnl.result === 'WIN' ? 1 : 0;

      if (pnl.exitType === 'SL') slHits++;
      else if (pnl.exitType === 'TP') tpHits++;
      else timeExits++;
      
      await this.updateSignalPnL(signal.id, {
        exitTimestamp: exitInfo.timestamp,
        exitPrice: exitInfo.price,
        pnlPercent: pnl.pnlPercent,
        pnlUsd: pnl.pnlUsd,
        result: pnl.result,
        wasCorrect,
        exitType: pnl.exitType
      });
      
      calculated++;
      
      const resultEmoji = pnl.result === 'WIN' ? '✅' : pnl.result === 'LOSS' ? '❌' : '⚖️';
      const exitEmoji = pnl.exitType === 'SL' ? '🛑' : pnl.exitType === 'TP' ? '🎯' : '⏰';
      const signalDate = new Date(signal.timestamp).toISOString().split('T')[0];
      
      console.log(`${resultEmoji} ${exitEmoji} #${signal.id} | ${signalDate} | ${signal.direction} @ $${signal.entry_price.toFixed(2)} → $${exitInfo.price.toFixed(2)} | ${pnl.pnlPercent > 0 ? '+' : ''}${pnl.pnlPercent}% ($${pnl.pnlUsd > 0 ? '+' : ''}${pnl.pnlUsd.toFixed(2)}) [${pnl.exitType}]`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Calculated: ${calculated}`);
    if (slHits > 0 || tpHits > 0 || timeExits > 0) {
      console.log(`   🛑 Stop Loss hits: ${slHits} | 🎯 Take Profit hits: ${tpHits} | ⏰ Time exits: ${timeExits}`);
    }
    console.log(`⏭️  Skipped: ${skipped} (insufficient future data)`);
    
    await this.printSummary();
    await this.close();
  }
  
  /**
   * Print summary statistics
   */
  printSummary() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN result = 'BREAKEVEN' THEN 1 ELSE 0 END) as breakeven,
          AVG(pnl_percent) as avg_pnl_percent,
          SUM(pnl_usd) as total_pnl_usd,
          AVG(ai_confidence) as avg_confidence
        FROM backtest_signals
        WHERE result IS NOT NULL
      `, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row && row.total > 0) {
          console.log(`\n${'='.repeat(60)}`);
          console.log('📈 PERFORMANCE SUMMARY');
          console.log(`${'='.repeat(60)}\n`);
          
          const winRate = ((row.wins / row.total) * 100).toFixed(1);
          
          console.log(`Total Signals:     ${row.total}`);
          console.log(`Wins:              ${row.wins} (${winRate}%)`);
          console.log(`Losses:            ${row.losses}`);
          console.log(`Breakeven:         ${row.breakeven}`);
          console.log(`Avg Confidence:    ${row.avg_confidence.toFixed(1)}%`);
          console.log(`Avg P/L:           ${row.avg_pnl_percent > 0 ? '+' : ''}${row.avg_pnl_percent.toFixed(2)}%`);
          console.log(`Total P/L:         $${row.total_pnl_usd > 0 ? '+' : ''}${row.total_pnl_usd.toFixed(2)}`);

          // Exit type breakdown
          this.db.get(`
            SELECT
              SUM(CASE WHEN exit_type = 'SL' THEN 1 ELSE 0 END) as sl_count,
              SUM(CASE WHEN exit_type = 'TP' THEN 1 ELSE 0 END) as tp_count,
              SUM(CASE WHEN exit_type = 'TIME' OR exit_type IS NULL THEN 1 ELSE 0 END) as time_count
            FROM backtest_signals WHERE result IS NOT NULL
          `, (err, exits) => {
            if (!err && exits) {
              console.log(`\n📊 Exit Breakdown:`);
              console.log(`   🛑 Stop Loss:   ${exits.sl_count || 0}`);
              console.log(`   🎯 Take Profit: ${exits.tp_count || 0}`);
              console.log(`   ⏰ Time Exit:   ${exits.time_count || 0}`);
            }
            this.db.all(`
            SELECT date, direction, entry_price, exit_price, pnl_percent, pnl_usd, ai_confidence
            FROM backtest_signals
            WHERE result IS NOT NULL
            ORDER BY pnl_percent DESC
            LIMIT 3
          `, (err, bestTrades) => {
            if (!err && bestTrades.length > 0) {
              console.log(`\n🏆 Best Trades:`);
              bestTrades.forEach((t, i) => {
                console.log(`   ${i + 1}. ${t.date.split('T')[0]} ${t.direction} ${t.pnl_percent > 0 ? '+' : ''}${t.pnl_percent}% ($${t.pnl_usd > 0 ? '+' : ''}${t.pnl_usd.toFixed(2)}) - ${t.ai_confidence}% confidence`);
              });
            }
            
            this.db.all(`
              SELECT date, direction, entry_price, exit_price, pnl_percent, pnl_usd, ai_confidence
              FROM backtest_signals
              WHERE result IS NOT NULL
              ORDER BY pnl_percent ASC
              LIMIT 3
            `, (err, worstTrades) => {
              if (!err && worstTrades.length > 0) {
                console.log(`\n📉 Worst Trades:`);
                worstTrades.forEach((t, i) => {
                  console.log(`   ${i + 1}. ${t.date.split('T')[0]} ${t.direction} ${t.pnl_percent}% ($${t.pnl_usd.toFixed(2)}) - ${t.ai_confidence}% confidence`);
                });
              }
              console.log('');
              resolve();
            });
          });
          }); // close exit breakdown query
        } else {
          console.log('\n⚠️  No completed signals to summarize\n');
          resolve();
        }
      });
    });
  }
  
  /**
   * Close database
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => {
          console.log('🔒 Database closed\n');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
💰 P/L Calculator - Usage

COMMAND-LINE ARGUMENTS:
  --symbol=<string>          Trading pair symbol (default: BTC/USDT)
  --db-path=<path>           Database file path (default: backtest-results.db)
  --data-dir=<path>          Directory with CSV data (default: data)
  --position-size=<number>   Position size in USD (default: 1000)
  --hold-hours=<number>      Hours to hold position (default: 24)
  --help, -h                 Show this help message

EXAMPLES:
  npm run calculate-pnl
  npm run calculate-pnl -- --symbol=ETH/USDT
  npm run calculate-pnl -- --position-size=500
  node calculate-pnl.js --symbol=BTC/USDT

REQUIREMENTS:
  - backtest-results.db must exist (run backtest first)
  - CSV files must exist in data directory
  - Signals must be recorded in database

OUTPUT:
  - Updates database with exit prices and P/L
  - Shows win rate, total profit, best/worst trades
  - Performance breakdown by direction and market

NOTE: Command-line arguments override environment variables
`);
    process.exit(0);
  }
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
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
    holdHours: cliArgs.holdHours || parseInt(process.env.BACKTEST_HOLD_HOURS) || 24
  };
  
  const calculator = new PnLCalculator(config);
  
  calculator.calculate()
    .then(() => {
      console.log('✅ P/L calculation complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ P/L calculation failed: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = PnLCalculator;
