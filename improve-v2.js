'use strict';
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const OpenAI  = require('openai');

const DB_PATH        = 'backtest-results-v2.db';
const PARAMS_PATH    = path.join('instructions', 'strategy-v2-params.json');
const DATA_DIR       = 'data';
const STATE_FILE     = 'cycle-v2-state.json';
const POSITION_SIZE  = 1000;   // USD per trade
const MAX_FWD_CANDLES = 48;    // 12 hours of 15m data

class ImproveV2 {
  constructor() {
    this.db      = null;
    this.data15m = null;
  }

  // ── Database ──────────────────────────────────────────────────────────────

  openDB() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, err => {
        if (err) reject(new Error(`Cannot open ${DB_PATH}: ${err.message}`));
        else     resolve();
      });
    });
  }

  closeDB() {
    return new Promise(resolve => {
      if (this.db) this.db.close(() => resolve());
      else         resolve();
    });
  }

  dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
  }

  dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, err => { if (err) reject(err); else resolve(); });
    });
  }

  // ── 15m price data for P&L forward-scan ──────────────────────────────────

  loadData15m() {
    const filepath = path.join(DATA_DIR, 'btc-usdt-15m.csv');
    if (!fs.existsSync(filepath)) throw new Error(`15m data not found: ${filepath}`);

    const lines = fs.readFileSync(filepath, 'utf-8').split('\n').filter(l => l.trim());
    this.data15m = lines.slice(1).map(line => {
      const p = line.split(',');
      return {
        timestamp: parseInt(p[0]),
        high:      parseFloat(p[3]),
        low:       parseFloat(p[4]),
        close:     parseFloat(p[5]),
      };
    }).filter(c => !isNaN(c.timestamp) && !isNaN(c.close));

    console.log(`📁 Loaded ${this.data15m.length} 15m candles for P&L scanning`);
  }

  // ── P&L calculation ───────────────────────────────────────────────────────

  /**
   * Ensure P&L columns exist (idempotent ALTER TABLE — errors are swallowed).
   */
  async ensureColumns() {
    const stmts = [
      'ALTER TABLE backtest_signals_v2 ADD COLUMN exit_timestamp INTEGER',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN exit_price REAL',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN exit_type TEXT',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN pnl_percent REAL',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN pnl_usd REAL',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN result TEXT',
      'ALTER TABLE backtest_signals_v2 ADD COLUMN was_correct INTEGER',
    ];
    for (const stmt of stmts) {
      await new Promise(resolve => this.db.run(stmt, () => resolve()));
    }
  }

  /**
   * Scan forward from signal entry to find exit via SL/TP or time limit.
   * LONG:  SL hit if candle.low <= stopLoss   | TP hit if candle.high >= takeProfit
   * SHORT: SL hit if candle.high >= stopLoss  | TP hit if candle.low  <= takeProfit
   */
  findExit(signal) {
    const candles   = this.data15m;
    const direction = signal.direction;
    const sl        = signal.stop_loss_price;
    const tp        = signal.take_profit_price;

    if (!sl || !tp) return null;

    // Binary search for first candle after entry
    let lo = 0, hi = candles.length - 1, startIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (candles[mid].timestamp > signal.timestamp) { startIdx = mid; hi = mid - 1; }
      else                                            { lo = mid + 1; }
    }
    if (startIdx === -1) return null;

    const maxIdx = Math.min(startIdx + MAX_FWD_CANDLES, candles.length);

    for (let i = startIdx; i < maxIdx; i++) {
      const c = candles[i];
      if (direction === 'LONG') {
        if (c.low  <= sl) return { exitTimestamp: c.timestamp, exitPrice: sl, exitType: 'SL' };
        if (c.high >= tp) return { exitTimestamp: c.timestamp, exitPrice: tp, exitType: 'TP' };
      } else if (direction === 'SHORT') {
        if (c.high >= sl) return { exitTimestamp: c.timestamp, exitPrice: sl, exitType: 'SL' };
        if (c.low  <= tp) return { exitTimestamp: c.timestamp, exitPrice: tp, exitType: 'TP' };
      }
    }

    // Time-based exit: close of the last candle in the window
    const lastC = candles[Math.min(maxIdx - 1, candles.length - 1)];
    return { exitTimestamp: lastC.timestamp, exitPrice: lastC.close, exitType: 'TIME' };
  }

  async calculatePnL() {
    const signals = await this.dbAll(
      'SELECT * FROM backtest_signals_v2 WHERE result IS NULL ORDER BY timestamp'
    );
    console.log(`\n💰 Calculating P&L for ${signals.length} ungraded signal(s)...`);

    let wins = 0, losses = 0, slHits = 0, tpHits = 0, timeExits = 0;

    for (const signal of signals) {
      const exit = this.findExit(signal);
      if (!exit) continue;

      const entry  = signal.entry_price;
      let pnlPct;
      if (signal.direction === 'LONG') {
        pnlPct = ((exit.exitPrice - entry) / entry) * 100;
      } else {
        pnlPct = ((entry - exit.exitPrice) / entry) * 100;
      }

      const pnlUsd     = parseFloat(((POSITION_SIZE * pnlPct) / 100).toFixed(2));
      const result     = pnlPct > 0 ? 'WIN' : pnlPct < 0 ? 'LOSS' : 'BREAKEVEN';
      const wasCorrect = result === 'WIN' ? 1 : 0;

      if (result === 'WIN') wins++;
      else if (result === 'LOSS') losses++;
      if (exit.exitType === 'SL')   slHits++;
      else if (exit.exitType === 'TP')  tpHits++;
      else                              timeExits++;

      await this.dbRun(
        `UPDATE backtest_signals_v2
         SET exit_timestamp=?, exit_price=?, exit_type=?,
             pnl_percent=?, pnl_usd=?, result=?, was_correct=?
         WHERE id=?`,
        [exit.exitTimestamp, exit.exitPrice, exit.exitType,
         parseFloat(pnlPct.toFixed(2)), pnlUsd, result, wasCorrect, signal.id]
      );
    }

    console.log(`  ✅ Wins: ${wins} | Losses: ${losses} | 🛑 SL: ${slHits} | 🎯 TP: ${tpHits} | ⏰ Time: ${timeExits}`);
  }

  // ── Analysis summary ──────────────────────────────────────────────────────

  buildAnalysis(signals) {
    const total = signals.length;
    if (total === 0) return null;

    const wins     = signals.filter(s => s.result === 'WIN').length;
    const losses   = signals.filter(s => s.result === 'LOSS').length;
    const slHits   = signals.filter(s => s.exit_type === 'SL').length;
    const tpHits   = signals.filter(s => s.exit_type === 'TP').length;
    const avgRR    = signals.reduce((sum, s) => sum + (s.rr || 0), 0) / total;
    const totalPnl = signals.reduce((sum, s) => sum + (s.pnl_usd || 0), 0);

    const summary = {
      overall: {
        total,
        wins,
        losses,
        winRate:     parseFloat(((wins / total) * 100).toFixed(1)),
        avgRR:       parseFloat(avgRR.toFixed(2)),
        slHits,
        tpHits,
        timeExits:   signals.filter(s => s.exit_type === 'TIME').length,
        totalPnlUsd: parseFloat(totalPnl.toFixed(2)),
      },
      bySetup:     {},
      byRegime:    {},
      byAdxRange:  {
        low:  { label: 'ADX < 25',    wins: 0, total: 0, winRate: 0 },
        mid:  { label: 'ADX 25-35',   wins: 0, total: 0, winRate: 0 },
        high: { label: 'ADX > 35',    wins: 0, total: 0, winRate: 0 },
      },
      topWinConditions:  {},
      topLossConditions: {},
    };

    // By setup type
    for (const type of ['A', 'B', 'C']) {
      const sigs = signals.filter(s => s.setup_type === type);
      const sw   = sigs.filter(s => s.result === 'WIN').length;
      summary.bySetup[type] = {
        total:    sigs.length,
        wins:     sw,
        winRate:  sigs.length > 0 ? parseFloat(((sw / sigs.length) * 100).toFixed(1)) : 0,
        avgScore: sigs.length > 0 ? parseFloat((sigs.reduce((a, s) => a + (s.setup_score || 0), 0) / sigs.length).toFixed(1)) : 0,
      };
    }

    // By regime
    for (const regime of ['BULL', 'BEAR']) {
      const sigs = signals.filter(s => s.regime === regime);
      const sw   = sigs.filter(s => s.result === 'WIN').length;
      summary.byRegime[regime] = {
        total:   sigs.length,
        wins:    sw,
        winRate: sigs.length > 0 ? parseFloat(((sw / sigs.length) * 100).toFixed(1)) : 0,
      };
    }

    // By ADX range
    for (const sig of signals) {
      const adx    = sig.adx || 0;
      const bucket = adx < 25 ? 'low' : adx < 35 ? 'mid' : 'high';
      summary.byAdxRange[bucket].total++;
      if (sig.result === 'WIN') summary.byAdxRange[bucket].wins++;
    }
    for (const b of Object.values(summary.byAdxRange)) {
      b.winRate = b.total > 0 ? parseFloat(((b.wins / b.total) * 100).toFixed(1)) : 0;
    }

    // Top conditions in wins / losses
    const winConds  = {};
    const lossConds = {};
    for (const sig of signals) {
      let conds = [];
      try { conds = JSON.parse(sig.conditions || '[]'); } catch (_) {}
      const target = sig.result === 'WIN' ? winConds : lossConds;
      for (const cond of conds) {
        // Normalise: strip numeric values so similar conditions group together
        const key = cond.replace(/[\d.]+/g, 'N').replace(/\s+/g, ' ').trim();
        target[key] = (target[key] || 0) + 1;
      }
    }

    summary.topWinConditions = Object.fromEntries(
      Object.entries(winConds).sort((a, b) => b[1] - a[1]).slice(0, 20)
    );
    summary.topLossConditions = Object.fromEntries(
      Object.entries(lossConds).sort((a, b) => b[1] - a[1]).slice(0, 20)
    );

    return summary;
  }

  // ── AI parameter optimization ─────────────────────────────────────────────

  _buildAIPrompt(analysis, paramsToImprove, regressionContext = null) {
    let prompt = `You are a quantitative trading strategy optimizer for a cryptocurrency bot.\n\n`;

    if (regressionContext) {
      prompt += `## ⚠️ REGRESSION ALERT — PREVIOUS ATTEMPT FAILED\n`;
      prompt += `The last parameter change caused a WIN RATE REGRESSION:\n`;
      prompt += `  Previous best: ${regressionContext.bestWinRate.toFixed(1)}%\n`;
      prompt += `  After change:  ${regressionContext.currentWinRate.toFixed(1)}%\n`;
      prompt += `  Drop:         -${(regressionContext.bestWinRate - regressionContext.currentWinRate).toFixed(1)}%\n\n`;
      prompt += `The FAILED parameters that caused the regression:\n`;
      prompt += `${JSON.stringify(regressionContext.failedParams, null, 2)}\n\n`;
      prompt += `You MUST start from the BEST KNOWN PARAMETERS below (not the failed ones).\n`;
      prompt += `Make DIFFERENT adjustments than last time. The previous change was wrong.\n\n`;
    }

    prompt += `## BACKTEST RESULTS ANALYSIS\n`;
    prompt += `${JSON.stringify(analysis, null, 2)}\n\n`;
    prompt += `## ${regressionContext ? 'BEST KNOWN PARAMETERS (restore from these)' : 'CURRENT STRATEGY PARAMETERS'}\n`;
    prompt += `${JSON.stringify(paramsToImprove, null, 2)}\n\n`;
    prompt += `## YOUR OPTIMIZATION TASK\n`;
    prompt += `Analyze the results and return improved parameters. Apply these rules:\n\n`;
    prompt += `1. **scoreThreshold**: Increase by 1 if setup win rate < 45% AND total > 5 trades.\n`;
    prompt += `   Decrease by 1 (min 3) if setup win rate > 65% AND total < 10 trades (too few signals).\n\n`;
    prompt += `2. **enabled**: Set to false ONLY if setup win rate < 30% AND total > 8 trades.\n`;
    prompt += `   IMPORTANT: At least 2 of the 3 setups MUST remain enabled at all times.\n\n`;
    prompt += `3. **adxTrendMinimum**: Maximum value is 25. Do NOT increase above 25 — it produces zero signals.\n`;
    prompt += `   If ADX-low bucket (<25) win rate < 40%, increase by 1. Keep at or below 25.\n\n`;
    prompt += `4. **RSI ranges (setupA)**: RSI long range must be at least 12 wide (max-min >= 12).\n`;
    prompt += `   Keep rsiLong.min between 20-45, rsiLong.max between 35-60.\n`;
    prompt += `   Keep rsiShort.min between 40-65, rsiShort.max between 55-80.\n\n`;
    prompt += `5. **riskManagement slAtr/tpAtr**: If SL hits > 60% of exits, increase slAtr by 0.2.\n`;
    prompt += `   If TP hits < 20% of exits, decrease tpAtr by 0.3.\n\n`;
    prompt += `6. **cooldownCandles**: Keep between 12 and 32. Increase by 4 if total signals > 200.\n\n`;
    prompt += `CRITICAL: Your response must produce a strategy generating AT LEAST 5-10 signals over 1 year.\n`;
    prompt += `Do not over-optimize into zero signals.\n\n`;
    prompt += `## RESPONSE\n`;
    prompt += `Return ONLY valid JSON. No markdown, no code blocks, no explanations.\n`;
    prompt += `The JSON must match the EXACT schema of the parameters (same keys, same nesting).\n`;
    prompt += `Only change values that the data supports. Preserve all keys.`;
    return prompt;
  }

  async callAI(analysis, paramsToImprove, regressionContext = null) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      throw new Error('DEEPSEEK_API_KEY not configured in .env');
    }

    const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
    const prompt = this._buildAIPrompt(analysis, paramsToImprove, regressionContext);

    const response = await client.chat.completions.create({
      model:    process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        {
          role:    'system',
          content: 'You are a quantitative trading parameter optimizer. Respond with valid JSON only. No markdown. No explanations.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });

    return response.choices[0].message.content;
  }

  parseAIResponse(rawText, currentParams) {
    // Strip markdown code fences if present
    let text = rawText.trim()
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.warn(`⚠️  AI JSON parse failed: ${err.message}`);
      return null;
    }

    // Validate required top-level keys
    const required = ['version', 'marketRegime', 'setupA', 'setupB', 'setupC', 'riskManagement', 'filters'];
    for (const key of required) {
      if (!(key in parsed)) {
        console.warn(`⚠️  AI response missing key: "${key}" — falling back to current params`);
        return null;
      }
    }

    return parsed;
  }

  // ── Hard constraints applied to AI params to prevent self-destruction ────
  enforceSafetyConstraints(params, currentParams) {
    const p = JSON.parse(JSON.stringify(params)); // deep clone

    // 1. ADX minimum: cap at 25 — higher than this produces near-zero signals
    if (p.marketRegime.adxTrendMinimum > 25) {
      console.log(`  ⚠️  ADX capped 25 (AI wanted ${p.marketRegime.adxTrendMinimum})`);
      p.marketRegime.adxTrendMinimum = 25;
    }

    // 2. At least 2 setups must remain enabled
    const enabledCount = [p.setupA.enabled, p.setupB.enabled, p.setupC.enabled].filter(Boolean).length;
    if (enabledCount < 2) {
      console.log(`  ⚠️  AI disabled too many setups (${3 - enabledCount} disabled) — re-enabling setupB`);
      p.setupB.enabled = true;
    }

    // 3. scoreThreshold limits per setup
    const maxThreshold = { A: 6, B: 6, C: 7 };
    const minThreshold = { A: 3, B: 3, C: 3 };
    for (const [key, setup] of [['setupA', p.setupA], ['setupB', p.setupB], ['setupC', p.setupC]]) {
      const label = key.slice(-1);
      if (setup.scoreThreshold > maxThreshold[label]) {
        console.log(`  ⚠️  ${key}.scoreThreshold capped at ${maxThreshold[label]} (AI wanted ${setup.scoreThreshold})`);
        setup.scoreThreshold = maxThreshold[label];
      }
      if (setup.scoreThreshold < minThreshold[label]) {
        setup.scoreThreshold = minThreshold[label];
      }
    }

    // 4. RSI long range must be at least 12 wide and within [20, 60]
    if (p.setupA.rsiLong) {
      p.setupA.rsiLong.min = Math.max(20, Math.min(p.setupA.rsiLong.min, 45));
      p.setupA.rsiLong.max = Math.max(p.setupA.rsiLong.min + 12, Math.min(p.setupA.rsiLong.max, 60));
    }
    if (p.setupA.rsiShort) {
      p.setupA.rsiShort.max = Math.min(80, Math.max(p.setupA.rsiShort.max, 55));
      p.setupA.rsiShort.min = Math.min(p.setupA.rsiShort.max - 12, Math.max(p.setupA.rsiShort.min, 40));
    }

    // 5. cooldownCandles max 32 (prevents too-sparse signals)
    if (p.filters.cooldownCandles > 32) {
      console.log(`  ⚠️  cooldownCandles capped at 32 (AI wanted ${p.filters.cooldownCandles})`);
      p.filters.cooldownCandles = 32;
    }

    return p;
  }

  // ── Backup & save params ──────────────────────────────────────────────────

  backupCurrentParams(currentParams, winRate) {
    const state    = this._readState();
    const cycleN   = state.cycleNumber || 1;
    const date     = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const pctStr   = isNaN(winRate) ? '0.0' : winRate.toFixed(1);
    const filename = `strategy-v2-params-backup${date}-cycle${cycleN}-pct${pctStr}.json`;
    const filepath = path.join('instructions', filename);
    fs.writeFileSync(filepath, JSON.stringify(currentParams, null, 2));
    console.log(`💾 Backed up params → ${filepath}`);
    return filename;  // returned so caller can track best backup file
  }

  // Find the backup with the HIGHEST win rate (best ever achieved)
  findBestBackup() {
    const dir = 'instructions';
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('strategy-v2-params-backup') && f.endsWith('.json'));

    let best = null;
    for (const file of files) {
      const match = file.match(/pct([\d.]+)\.json$/);
      if (!match) continue;
      const pct = parseFloat(match[1]);
      if (pct > 0 && (!best || pct > best.winRate)) {
        try {
          const params = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
          best = { file, winRate: pct, params };
        } catch (_) {}
      }
    }
    return best;
  }

  // Find the most recent backup with >= 5 signals (i.e., a non-zero pct)
  findLastGoodBackup() {
    const dir = 'instructions';
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('strategy-v2-params-backup') && f.endsWith('.json'))
      .sort()
      .reverse(); // most recent first

    for (const file of files) {
      const match = file.match(/pct([\d.]+)\.json$/);
      if (!match) continue;
      const pct = parseFloat(match[1]);
      if (pct > 0) {
        try {
          const params = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
          return { file, winRate: pct, params };
        } catch (_) {}
      }
    }
    return null;
  }

  _readState() {
    try {
      if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch (_) {}
    return { cycleNumber: 1, bestWinRate: 0, bestParamsFile: null };
  }

  _updateBestWinRate(winRate, backupFile) {
    try {
      const state = this._readState();
      state.bestWinRate   = winRate;
      state.bestParamsFile = backupFile;
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (_) {}
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  async run() {
    console.log('\n🤖 V2 Strategy Improver — AI-powered parameter optimizer');
    console.log(`${'='.repeat(60)}\n`);

    // 1. Open DB and calculate P&L
    await this.openDB();
    this.loadData15m();
    await this.ensureColumns();
    await this.calculatePnL();

    // 2. Load current params + compute win rate from this cycle's results
    const currentParams = JSON.parse(fs.readFileSync(PARAMS_PATH, 'utf-8'));
    const allSignals = await this.dbAll(
      'SELECT * FROM backtest_signals_v2 WHERE result IS NOT NULL ORDER BY timestamp'
    );
    const currentWinRate = allSignals.length > 0
      ? (allSignals.filter(s => s.result === 'WIN').length / allSignals.length * 100)
      : 0;

    // 3. ALWAYS backup the params that just ran (with its win rate)
    const backupFile = this.backupCurrentParams(currentParams, currentWinRate);
    console.log(`\n📊 ${allSignals.length} graded trade(s) | Win rate: ${currentWinRate.toFixed(1)}%`);

    // 4. Handle too-few signals (over-constrained params)
    if (allSignals.length < 5) {
      console.log('⚠️  Very few signals (<5) — params may be too restrictive.');
      const best = this.findBestBackup();
      if (best) {
        console.log(`🔄 Restoring best known params: ${best.file} (${best.winRate}%)`);
        fs.writeFileSync(PARAMS_PATH, JSON.stringify(best.params, null, 2));
      }
      await this.closeDB();
      return;
    }

    // 5. Compare against best win rate ever achieved
    const state = this._readState();
    const bestWinRate = state.bestWinRate || 0;
    const isRegression = currentWinRate < bestWinRate;

    if (isRegression) {
      console.log(`\n📉 REGRESSION DETECTED: ${currentWinRate.toFixed(1)}% < best ${bestWinRate.toFixed(1)}%`);
      console.log(`   Last change made things WORSE — reverting to best params for AI retry...`);
    } else {
      console.log(`\n📈 Win rate: ${currentWinRate.toFixed(1)}% ${bestWinRate > 0 ? `(best was ${bestWinRate.toFixed(1)}%)` : '(first baseline)'}`);
      // Update the best tracker
      this._updateBestWinRate(currentWinRate, backupFile);
    }

    // 6. Decide which params to give the AI:
    //    - Regression: AI gets the BEST KNOWN params + failure context
    //    - Improvement: AI gets the CURRENT (just-tested) params
    let paramsForAI = currentParams;
    let regressionContext = null;

    if (isRegression) {
      const best = this.findBestBackup();
      if (best) {
        paramsForAI = best.params;
        regressionContext = {
          bestWinRate,
          currentWinRate,
          failedParams: currentParams   // show AI what went wrong
        };
        console.log(`   AI will improve from: ${best.file} (${best.winRate}%)`);
      } else {
        // No backup found — just use current params without regression context
        console.log('   No best backup found — proceeding with current params');
      }
    }

    // 7. Build analysis + call AI
    const analysis = this.buildAnalysis(allSignals);
    console.log(`\n📊 ANALYSIS SUMMARY:`);
    console.log(`  Win Rate:   ${analysis.overall.winRate}%  (${analysis.overall.wins}W / ${analysis.overall.losses}L)`);
    console.log(`  Total P&L:  $${analysis.overall.totalPnlUsd >= 0 ? '+' : ''}${analysis.overall.totalPnlUsd}`);
    console.log(`  Setup A:    ${analysis.bySetup.A.winRate}% win rate (${analysis.bySetup.A.total} trades)`);
    console.log(`  Setup B:    ${analysis.bySetup.B.winRate}% win rate (${analysis.bySetup.B.total} trades)`);
    console.log(`  Setup C:    ${analysis.bySetup.C.winRate}% win rate (${analysis.bySetup.C.total} trades)`);
    console.log(`  BULL:       ${analysis.byRegime.BULL?.winRate || 0}% (${analysis.byRegime.BULL?.total || 0} trades)`);
    console.log(`  BEAR:       ${analysis.byRegime.BEAR?.winRate || 0}% (${analysis.byRegime.BEAR?.total || 0} trades)`);
    console.log(`  ADX <25:    ${analysis.byAdxRange.low.winRate}% (${analysis.byAdxRange.low.total} trades)`);
    console.log(`  ADX 25-35:  ${analysis.byAdxRange.mid.winRate}% (${analysis.byAdxRange.mid.total} trades)`);
    console.log(`  ADX >35:    ${analysis.byAdxRange.high.winRate}% (${analysis.byAdxRange.high.total} trades)`);

    const aiLabel = regressionContext ? '🔁 Re-asking AI (regression recovery)' : '🤖 Calling DeepSeek AI';
    console.log(`\n${aiLabel}...`);
    let newParams = null;
    try {
      const rawResponse = await this.callAI(analysis, paramsForAI, regressionContext);
      newParams = this.parseAIResponse(rawResponse, paramsForAI);
    } catch (err) {
      console.warn(`⚠️  AI call failed: ${err.message}`);
    }

    if (!newParams) {
      console.log('ℹ️  Keeping params unchanged (AI unavailable or response invalid)');
      if (isRegression && paramsForAI !== currentParams) {
        // Still restore best params even if AI failed
        fs.writeFileSync(PARAMS_PATH, JSON.stringify(paramsForAI, null, 2));
        console.log('   Restored best known params as fallback.');
      }
      await this.closeDB();
      return;
    }

    // 8. Safety constraints
    console.log('\n🛡️  Applying safety constraints...');
    newParams = this.enforceSafetyConstraints(newParams, paramsForAI);

    // 9. Annotate and write
    newParams.version         = 2;
    newParams._lastImproved   = new Date().toISOString();
    newParams._cycleNumber    = this._readState().cycleNumber || 1;
    newParams._prevWinRate    = currentWinRate;
    newParams._bestWinRate    = Math.max(bestWinRate, currentWinRate);
    newParams._wasRegression  = isRegression;
    newParams._description    = 'V2 Trading Strategy Parameters — auto-tuned by AI';

    fs.writeFileSync(PARAMS_PATH, JSON.stringify(newParams, null, 2));

    if (isRegression) {
      console.log(`\n✅ New params saved (recovery attempt from ${bestWinRate.toFixed(1)}% baseline)`);
    } else {
      console.log(`\n✅ Improved params saved (${currentWinRate.toFixed(1)}% → next cycle)`);
    }

    await this.closeDB();
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

const improver = new ImproveV2();
improver.run()
  .then(() => { console.log('✅ Improvement cycle complete!\n'); process.exit(0); })
  .catch(err => {
    console.error('\n❌ Improvement failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
