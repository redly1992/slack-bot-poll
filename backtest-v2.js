'use strict';
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const IndicatorCalculator = require('./src/indicatorCalculator');
const TradingStrategyV2   = require('./src/strategyV2');

const INDICATOR_CONFIG = {
  rsi:        { enabled: true, period: 14 },
  ema:        { enabled: true, fastPeriod: 9, slowPeriod: 21 },
  macd:       { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bollinger:  { enabled: true, period: 20, stdDev: 2 },
  stochastic: { enabled: true, period: 14, signalPeriod: 3 },
  // ADX, MFI, PSAR, EMA200, OBV are added automatically by calculateAll
};

// Minimum candle history before we start processing
const MIN_HISTORY = 200;

class BacktestV2 {
  constructor(config = {}) {
    this.dataDir        = config.dataDir        || 'data';
    this.dbPath         = config.dbPath         || 'backtest-results-v2.db';
    this.symbol         = config.symbol         || 'BTC/USDT';
    this.checkpointFile = config.checkpointFile || 'checkpoint-v2.json';
    this.paramsPath     = config.paramsPath      || path.join('instructions', 'strategy-v2-params.json');

    this.strategy = new TradingStrategyV2(this.paramsPath);
    this.db       = null;

    this.stats = {
      candlesProcessed: 0,
      signalsRecorded:  0,
      longSignals:      0,
      shortSignals:     0,
      skippedRanging:   0,
      bySetup:  { A: 0, B: 0, C: 0 },
      byRegime: { BULL: 0, BEAR: 0 },
    };

    this.checkpoint   = this._loadCheckpoint();
    this.currentIndex = 0;
  }

  // ── Checkpoint ────────────────────────────────────────────────────────────

  _loadCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const data = JSON.parse(fs.readFileSync(this.checkpointFile, 'utf-8'));
        console.log(`📌 Checkpoint loaded: resume from index ${data.lastProcessedIndex}`);
        return data;
      }
    } catch (err) {
      console.warn(`⚠️  Failed to load checkpoint: ${err.message}`);
    }
    return { lastProcessedIndex: -1, lastTimestamp: 0 };
  }

  _saveCheckpoint(index, timestamp) {
    try {
      fs.writeFileSync(this.checkpointFile, JSON.stringify({
        lastProcessedIndex: index,
        lastTimestamp:      timestamp,
        updatedAt:          new Date().toISOString(),
      }, null, 2));
    } catch (err) {
      console.warn(`⚠️  Failed to save checkpoint: ${err.message}`);
    }
  }

  // ── CSV loading ───────────────────────────────────────────────────────────

  loadCSV(timeframe) {
    const filename = path.join(
      this.dataDir,
      `${this.symbol.replace('/', '-').toLowerCase()}-${timeframe}.csv`
    );
    if (!fs.existsSync(filename)) throw new Error(`Data file not found: ${filename}`);

    const lines = fs.readFileSync(filename, 'utf-8')
      .split('\n')
      .filter(l => l.trim());

    const data = lines.slice(1).map(line => {
      const p = line.split(',');
      return {
        timestamp: parseInt(p[0]),
        date:      p[1],
        open:      parseFloat(p[2]),
        high:      parseFloat(p[3]),
        low:       parseFloat(p[4]),
        close:     parseFloat(p[5]),
        volume:    parseFloat(p[6]),
      };
    }).filter(c => !isNaN(c.timestamp) && !isNaN(c.close));

    console.log(`📁 Loaded ${data.length} candles from ${timeframe}`);
    return data;
  }

  /**
   * Return the last `count` candles with timestamp <= ts (binary search).
   * Works for any timeframe regardless of whether ts exactly aligns.
   */
  getCandlesUpToTime(allData, ts, count = 100) {
    let lo = 0, hi = allData.length - 1, endIndex = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (allData[mid].timestamp <= ts) { endIndex = mid; lo = mid + 1; }
      else                              { hi = mid - 1; }
    }
    if (endIndex < count - 1) return null;
    return allData.slice(endIndex - count + 1, endIndex + 1);
  }

  // ── Database ──────────────────────────────────────────────────────────────

  initDatabase() {
    return new Promise((resolve, reject) => {
      // Explicit READWRITE|CREATE avoids SQLite opening in read-only mode
      // when orphaned WAL files are present after a crash.
      this.db = new sqlite3.Database(
        this.dbPath,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        err => {
          if (err) { reject(err); return; }
          console.log(`📊 Database: ${this.dbPath}`);
          this._createTables().then(resolve).catch(reject);
        }
      );
    });
  }

  _createTables() {
    return new Promise((resolve, reject) => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS backtest_signals_v2 (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp       INTEGER,
          date            TEXT,
          pair            TEXT,

          -- Indicator snapshots (JSON)
          indicators_5m   TEXT,
          indicators_15m  TEXT,
          indicators_1h   TEXT,
          indicators_4h   TEXT,

          -- Legacy alignment columns (NULL in v2)
          signal_5m       TEXT,
          signal_15m      TEXT,
          signal_1h       TEXT,
          alignment       TEXT,

          -- Legacy AI columns (NULL in v2)
          ai_signal           TEXT,
          ai_confidence       INTEGER,
          ai_reasoning        TEXT,
          ai_entry_reason     TEXT,
          ai_stop_loss_reason TEXT,
          ai_risk_level       TEXT,
          ai_raw_response     TEXT,
          ai_parse_error      TEXT,

          -- Trade data
          entry_price       REAL,
          direction         TEXT,
          stop_loss_price   REAL,
          take_profit_price REAL,
          rr                REAL,
          market_condition  TEXT,

          -- P&L (filled by improve-v2.js)
          exit_timestamp  INTEGER,
          exit_price      REAL,
          exit_type       TEXT,
          pnl_percent     REAL,
          pnl_usd         REAL,
          result          TEXT,
          was_correct     INTEGER,

          -- V2-specific columns
          setup_type      TEXT,
          setup_score     INTEGER,
          skip_reason     TEXT,
          regime          TEXT,
          adx             REAL,
          conditions      TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_v2_timestamp  ON backtest_signals_v2(timestamp);
        CREATE INDEX IF NOT EXISTS idx_v2_setup_type ON backtest_signals_v2(setup_type);
        CREATE INDEX IF NOT EXISTS idx_v2_regime     ON backtest_signals_v2(regime);
        CREATE INDEX IF NOT EXISTS idx_v2_result     ON backtest_signals_v2(result);
      `, err => {
        if (err) reject(err);
        else { console.log('✅ V2 tables ready'); resolve(); }
      });
    });
  }

  recordSignal(data) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        INSERT INTO backtest_signals_v2 (
          timestamp, date, pair,
          indicators_5m, indicators_15m, indicators_1h, indicators_4h,
          entry_price, direction, stop_loss_price, take_profit_price, rr,
          market_condition,
          setup_type, setup_score, conditions, regime, adx
        ) VALUES (?,?,?, ?,?,?,?, ?,?,?,?,?, ?, ?,?,?,?,?)
      `, [
        data.timestamp, data.date, data.pair,
        JSON.stringify(data.ind5m),
        JSON.stringify(data.ind15m),
        JSON.stringify(data.ind1h),
        JSON.stringify(data.ind4h),
        data.entry_price, data.direction,
        data.stop_loss_price, data.take_profit_price, data.rr,
        data.regime,
        data.setup_type, data.setup_score,
        JSON.stringify(data.conditions),
        data.regime, data.adx,
      ], function(err) {
        if (err) reject(err);
        else     resolve(this.lastID);
      });
    });
  }

  // ── Progress bar ──────────────────────────────────────────────────────────

  _updateProgress(current, total) {
    const pct    = ((current / total) * 100).toFixed(1);
    const filled = Math.floor((current / total) * 35);
    const bar    = '█'.repeat(filled) + '░'.repeat(35 - filled);
    const line   = `  [${bar}] ${pct}% | Candles: ${this.stats.candlesProcessed} | Signals: ${this.stats.signalsRecorded} (L:${this.stats.longSignals} S:${this.stats.shortSignals})`;
    process.stdout.write('\r' + line + ' '.repeat(Math.max(0, 120 - line.length)));
  }

  // ── Main run loop ─────────────────────────────────────────────────────────

  async run() {
    console.log('\n🚀 V2 Backtest — deterministic signal engine (zero AI calls)');
    console.log(`${'='.repeat(60)}\n`);

    const data5m  = this.loadCSV('5m');
    const data15m = this.loadCSV('15m');
    const data1h  = this.loadCSV('1h');
    const data4h  = this.loadCSV('4h');

    await this.initDatabase();

    const startIndex   = Math.max(MIN_HISTORY, this.checkpoint.lastProcessedIndex + 1);
    const totalCandles = data15m.length;

    if (startIndex > MIN_HISTORY) {
      console.log(`📌 Resuming from candle ${startIndex} / ${totalCandles} (${((startIndex / totalCandles) * 100).toFixed(1)}%)`);
    }

    this.stats.candlesProcessed = Math.max(0, startIndex - MIN_HISTORY);
    this.currentIndex           = startIndex;

    const cooldown       = this.strategy.params.filters.cooldownCandles || 20;
    let   lastSignalIdx  = 0;

    // Save progress on interrupt
    const sigintHandler = () => {
      process.stdout.write('\n');
      console.log(`\n⚠️  Interrupted at index ${this.currentIndex} — saving checkpoint...`);
      this._saveCheckpoint(this.currentIndex, data15m[this.currentIndex]?.timestamp || 0);
      console.log('✅ Checkpoint saved.\n');
      process.exit(0);
    };
    process.once('SIGINT', sigintHandler);

    this._updateProgress(startIndex, totalCandles);

    for (let i = startIndex; i < data15m.length; i++) {
      this.currentIndex = i;
      const candle15m   = data15m[i];
      const ts          = candle15m.timestamp;

      this.stats.candlesProcessed++;

      if (i % 5 === 0 || i === data15m.length - 1) {
        this._updateProgress(i, totalCandles);
      }

      // Get last N candles for each timeframe (time-aligned, not exact-timestamp)
      const c5m  = this.getCandlesUpToTime(data5m,  ts, 100);
      const c15m = this.getCandlesUpToTime(data15m, ts, 100);
      const c1h  = this.getCandlesUpToTime(data1h,  ts, 100);
      const c4h  = this.getCandlesUpToTime(data4h,  ts,  60);

      if (!c5m || !c15m || !c1h || !c4h) continue;

      // Calculate indicators — calculateAll auto-adds ADX/MFI/PSAR/EMA200/OBV
      let ind5m, ind15m, ind1h, ind4h;
      try {
        ind5m  = IndicatorCalculator.calculateAll(c5m,  INDICATOR_CONFIG);
        ind15m = IndicatorCalculator.calculateAll(c15m, INDICATOR_CONFIG);
        ind1h  = IndicatorCalculator.calculateAll(c1h,  INDICATOR_CONFIG);
        ind4h  = IndicatorCalculator.calculateAll(c4h,  INDICATOR_CONFIG);
      } catch (_) {
        continue; // Not enough data yet
      }

      // Deterministic strategy evaluation
      const signal = this.strategy.analyze(ind5m, ind15m, ind1h, ind4h, c15m);

      if (signal.signal === 'SKIP') {
        if (signal.regime === 'RANGING') this.stats.skippedRanging++;
        continue;
      }

      // Cooldown filter
      if ((i - lastSignalIdx) < cooldown) continue;

      lastSignalIdx = i;
      this.stats.signalsRecorded++;
      if (signal.signal === 'LONG')  this.stats.longSignals++;
      else                           this.stats.shortSignals++;
      this.stats.bySetup[signal.setupType]  = (this.stats.bySetup[signal.setupType]  || 0) + 1;
      this.stats.byRegime[signal.regime]    = (this.stats.byRegime[signal.regime]    || 0) + 1;

      // Store compact indicator snapshots (full objects bloat the DB)
      await this.recordSignal({
        timestamp: ts,
        date:      candle15m.date,
        pair:      this.symbol,
        ind5m:  { price: ind5m.price,  rsi: ind5m.rsi,  adx: ind5m.adx?.adx },
        ind15m: { price: ind15m.price, rsi: ind15m.rsi, macd: ind15m.macd,  ema: ind15m.ema, adx: ind15m.adx?.adx, stochastic: ind15m.stochastic },
        ind1h:  { price: ind1h.price,  rsi: ind1h.rsi,  macd: ind1h.macd,   ema: ind1h.ema },
        ind4h:  { price: ind4h.price,  rsi: ind4h.rsi,  ema: ind4h.ema,     adx: ind4h.adx?.adx, ema200: ind4h.ema200 },
        entry_price:       candle15m.close,
        direction:         signal.signal,
        stop_loss_price:   signal.stopLoss,
        take_profit_price: signal.takeProfit,
        rr:                signal.rr,
        regime:            signal.regime,
        setup_type:        signal.setupType,
        setup_score:       signal.score,
        conditions:        signal.conditions,
        adx:               signal.adx,
      });

      // Checkpoint every 10 candles
      if (i % 10 === 0) this._saveCheckpoint(i, ts);
    }

    process.removeListener('SIGINT', sigintHandler);
    this._updateProgress(totalCandles, totalCandles);
    process.stdout.write('\n\n');

    this._printSummary();

    if (fs.existsSync(this.checkpointFile)) {
      fs.unlinkSync(this.checkpointFile);
      console.log('📌 Checkpoint cleaned up');
    }

    await this._close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  _printSummary() {
    console.log(`${'='.repeat(60)}`);
    console.log('📊 V2 BACKTEST SUMMARY');
    console.log(`${'='.repeat(60)}\n`);
    console.log(`Candles processed:       ${this.stats.candlesProcessed.toLocaleString()}`);
    console.log(`Signals recorded:        ${this.stats.signalsRecorded}`);
    console.log(`  LONG:                  ${this.stats.longSignals}`);
    console.log(`  SHORT:                 ${this.stats.shortSignals}`);
    console.log(`  Skipped (ranging):     ${this.stats.skippedRanging}`);
    console.log(`\nBy Setup Type:`);
    console.log(`  A — EMA Pullback:      ${this.stats.bySetup.A  || 0}`);
    console.log(`  B — Extreme OS/OB:     ${this.stats.bySetup.B  || 0}`);
    console.log(`  C — MACD Momentum:     ${this.stats.bySetup.C  || 0}`);
    console.log(`\nBy Regime:`);
    console.log(`  BULL:                  ${this.stats.byRegime.BULL || 0}`);
    console.log(`  BEAR:                  ${this.stats.byRegime.BEAR || 0}`);
    console.log(`\n📁 Results: ${this.dbPath}\n`);
  }

  _close() {
    return new Promise(resolve => {
      if (this.db) this.db.close(() => { console.log('🔒 Database closed'); resolve(); });
      else         resolve();
    });
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────

const engine = new BacktestV2();
engine.run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ V2 Backtest failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
