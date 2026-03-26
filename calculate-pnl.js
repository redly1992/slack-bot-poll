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
   * Load CSV data for price lookups
   */
  loadPriceData() {
    const filename = path.join(this.dataDir, `${this.symbol.replace('/', '-').toLowerCase()}-15m.csv`);
    
    if (!fs.existsSync(filename)) {
      throw new Error(`Price data file not found: ${filename}`);
    }
    
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Parse CSV into map for fast lookup by timestamp
    const priceMap = new Map();
    
    lines.slice(1).forEach(line => {
      const parts = line.split(',');
      const timestamp = parseInt(parts[0]);
      const close = parseFloat(parts[5]);
      priceMap.set(timestamp, close);
    });
    
    console.log(`📁 Loaded ${priceMap.size} price points from 15m data`);
    return priceMap;
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
   * Find exit price N hours after entry
   */
  findExitPrice(entryTimestamp, priceMap) {
    const exitTimestamp = entryTimestamp + (this.holdHours * 60 * 60 * 1000);
    
    // Try exact match first
    if (priceMap.has(exitTimestamp)) {
      return { timestamp: exitTimestamp, price: priceMap.get(exitTimestamp) };
    }
    
    // Find closest candle within 30 minutes
    const tolerance = 30 * 60 * 1000; // 30 minutes
    for (let offset = 0; offset <= tolerance; offset += 15 * 60 * 1000) {
      const ts1 = exitTimestamp + offset;
      const ts2 = exitTimestamp - offset;
      
      if (priceMap.has(ts1)) {
        return { timestamp: ts1, price: priceMap.get(ts1) };
      }
      if (priceMap.has(ts2)) {
        return { timestamp: ts2, price: priceMap.get(ts2) };
      }
    }
    
    return null; // Not enough future data
  }
  
  /**
   * Calculate P/L for a signal
   */
  calculatePnL(signal, exitPrice) {
    const entryPrice = signal.entry_price;
    const direction = signal.direction; // LONG or SHORT
    
    let pnlPercent;
    if (direction === 'LONG') {
      pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
    } else if (direction === 'SHORT') {
      pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;
    } else {
      return { pnlPercent: 0, pnlUsd: 0, result: 'UNKNOWN' };
    }
    
    const pnlUsd = (this.positionSize * pnlPercent) / 100;
    const result = pnlPercent > 0 ? 'WIN' : pnlPercent < 0 ? 'LOSS' : 'BREAKEVEN';
    
    return {
      pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      pnlUsd: parseFloat(pnlUsd.toFixed(2)),
      result
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
            was_correct = ?
        WHERE id = ?
      `, [
        exitData.exitTimestamp,
        exitData.exitPrice,
        exitData.pnlPercent,
        exitData.pnlUsd,
        exitData.result,
        exitData.wasCorrect,
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
    const priceMap = this.loadPriceData();
    const signals = await this.getSignalsNeedingPnL();
    
    console.log(`\n📊 Found ${signals.length} signals needing P/L calculation\n`);
    
    if (signals.length === 0) {
      console.log('✅ All signals already have P/L calculated!\n');
      await this.close();
      return;
    }
    
    let calculated = 0;
    let skipped = 0;
    
    for (const signal of signals) {
      const exitInfo = this.findExitPrice(signal.timestamp, priceMap);
      
      if (!exitInfo) {
        skipped++;
        console.log(`⏭️  Signal #${signal.id} - No exit data available (end of dataset)`);
        continue;
      }
      
      const pnl = this.calculatePnL(signal, exitInfo.price);
      
      // Determine if AI was correct
      const aiDirection = signal.direction;
      const wasCorrect = pnl.result === 'WIN' ? 1 : 0;
      
      await this.updateSignalPnL(signal.id, {
        exitTimestamp: exitInfo.timestamp,
        exitPrice: exitInfo.price,
        pnlPercent: pnl.pnlPercent,
        pnlUsd: pnl.pnlUsd,
        result: pnl.result,
        wasCorrect
      });
      
      calculated++;
      
      const resultEmoji = pnl.result === 'WIN' ? '✅' : pnl.result === 'LOSS' ? '❌' : '⚖️';
      const signalDate = new Date(signal.timestamp).toISOString().split('T')[0];
      
      console.log(`${resultEmoji} #${signal.id} | ${signalDate} | ${aiDirection} @ $${signal.entry_price.toFixed(2)} → $${exitInfo.price.toFixed(2)} | ${pnl.pnlPercent > 0 ? '+' : ''}${pnl.pnlPercent}% ($${pnl.pnlUsd > 0 ? '+' : ''}${pnl.pnlUsd.toFixed(2)})`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Calculated: ${calculated}`);
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
          
          // Get best and worst trades
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
