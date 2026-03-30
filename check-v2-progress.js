'use strict';
const sqlite3 = require('sqlite3').verbose();
const fs      = require('fs');
const path    = require('path');

const STATE_FILE = 'cycle-v2-state.json';
const CHECKPOINT = 'checkpoint-v2.json';
const DB_PATH    = 'backtest-results-v2.db';

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJSON(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (_) {}
  return null;
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return '?';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function renderBar(pct, width = 38) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

function getTotalCandles() {
  try {
    const file  = path.join('data', 'btc-usdt-15m.csv');
    if (!fs.existsSync(file)) return 0;
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim());
    return Math.max(0, lines.length - 1);
  } catch (_) { return 0; }
}

const STEP_NAMES  = ['cleanup', 'backtest', 'improve-v2'];
const TOTAL_STEPS = STEP_NAMES.length;
// v2 starts meaningful work at index 200 (larger min-history than v1)
const MIN_HISTORY = 200;

function computeCyclePct(state, checkpoint, totalCandles) {
  if (!state || !state.currentStep) return 0;
  const stepIdx  = STEP_NAMES.indexOf(state.currentStep);
  const stepSize = 100 / TOTAL_STEPS;

  if (state.currentStep === 'between-cycles') return 100;
  if (stepIdx === -1) return 0;

  let pct = stepIdx * stepSize;
  if (state.currentStep === 'backtest' && checkpoint && totalCandles > MIN_HISTORY) {
    const idx    = checkpoint.lastProcessedIndex || 0;
    const subPct = Math.min(1, Math.max(0, (idx - MIN_HISTORY) / (totalCandles - MIN_HISTORY)));
    pct += subPct * stepSize;
  } else {
    pct += stepSize * 0.5;
  }
  return Math.min(100, pct);
}

// ── Read state ────────────────────────────────────────────────────────────────

const state        = readJSON(STATE_FILE);
const checkpoint   = readJSON(CHECKPOINT);
const totalCandles = getTotalCandles();

let backtestIdx = 0, backtestPct = 0;
if (checkpoint && totalCandles > MIN_HISTORY) {
  backtestIdx = Math.max(0, (checkpoint.lastProcessedIndex || 0) - MIN_HISTORY);
  backtestPct = Math.min(100, (backtestIdx / (totalCandles - MIN_HISTORY)) * 100);
}

const cyclePct = computeCyclePct(state, checkpoint, totalCandles);

// ── Print header ──────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(62)}`);
console.log(' 📊  TRADING BOT V2 — PROGRESS REPORT');
console.log(`${'═'.repeat(62)}`);

if (!state) {
  console.log('\n  ⏸️   No V2 auto-cycle running.');
  console.log('       Start with: npm run auto-cycle-v2\n');
} else {
  const statusEmoji = state.status === 'running' ? '🟢' : state.status === 'stopped' ? '🔴' : '🟡';
  const elapsed     = state.overallStartedAt
    ? fmtDuration(Date.now() - new Date(state.overallStartedAt).getTime())
    : '?';

  console.log(`\n  Status:             ${statusEmoji}  ${(state.status || 'unknown').toUpperCase()}`);
  console.log(`  PID:                ${state.pid || '?'}`);
  console.log(`  Total time running: ${elapsed}`);

  console.log(`\n${'─'.repeat(62)}`);
  console.log(' 🔄  CYCLE OVERVIEW');
  console.log(`${'─'.repeat(62)}`);
  console.log(`  Cycles completed:   ${state.totalCyclesCompleted || 0}`);
  console.log(`  Current cycle:      #${state.cycleNumber || 1}`);

  // Show best win rate ever achieved + regression indicator
  const bestWR = state.bestWinRate || 0;
  if (bestWR > 0) {
    console.log(`  Best win rate ever: 🏆 ${bestWR.toFixed(1)}%`);
    if (state.bestParamsFile) {
      console.log(`  Best params from:   ${state.bestParamsFile}`);
    }
  }
  const currentParams = readJSON(path.join('instructions', 'strategy-v2-params.json'));
  if (currentParams?._wasRegression) {
    console.log(`  Last cycle:         📉 REGRESSION — AI retrying from best`);
  } else if (currentParams?._prevWinRate) {
    console.log(`  Last cycle result:  ${currentParams._prevWinRate.toFixed(1)}%`);
  }

  if (state.avgCycleDurationMs) {
    console.log(`  Avg cycle duration: ${fmtDuration(state.avgCycleDurationMs)}`);
    if (state.status === 'running' && state.cycleStartedAt) {
      const cycleElapsed = Date.now() - new Date(state.cycleStartedAt).getTime();
      const eta          = state.avgCycleDurationMs - cycleElapsed;
      if (eta > 0) console.log(`  ETA this cycle:     ~${fmtDuration(eta)}`);
    }
  }

  if (state.lastCycleCompletedAt) {
    console.log(`  Last cycle done:    ${new Date(state.lastCycleCompletedAt).toLocaleString()}`);
  }

  console.log(`\n${'─'.repeat(62)}`);
  console.log(' 📋  CURRENT CYCLE PROGRESS');
  console.log(`${'─'.repeat(62)}`);
  console.log(`  ${renderBar(cyclePct)} ${cyclePct.toFixed(1)}%\n`);

  STEP_NAMES.forEach((name, i) => {
    const stepNum  = i + 1;
    const isCurrent = state.currentStep === name;
    const isDone    = (state.stepNumber || 0) > stepNum || state.currentStep === 'between-cycles';
    const isPending = !isCurrent && !isDone;

    const icon = isPending ? '  ○' : isDone ? '  ✅' : '  ▶️ ';
    let extra  = '';

    if (isCurrent) {
      const stepElapsed = state.stepStartedAt
        ? fmtDuration(Date.now() - new Date(state.stepStartedAt).getTime())
        : '';
      extra = `  ← running (${stepElapsed})`;
      if (name === 'backtest' && totalCandles > 0) extra += `  ${backtestPct.toFixed(1)}%`;
    }

    console.log(`${icon}  Step ${stepNum}: ${name}${extra}`);
  });

  if (state.currentStep === 'backtest' && totalCandles > MIN_HISTORY) {
    console.log('');
    console.log(`  Backtest: ${renderBar(backtestPct, 30)} ${backtestPct.toFixed(1)}%`);
    console.log(`  Candles:  ${backtestIdx.toLocaleString()} / ${(totalCandles - MIN_HISTORY).toLocaleString()}`);
    if (checkpoint?.updatedAt) {
      console.log(`  Last save: ${new Date(checkpoint.updatedAt).toLocaleString()}`);
    }
  }
}

// ── DB stats ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(DB_PATH)) {
  console.log(`\n  📂 No V2 database yet.\n`);
  process.exit(0);
}

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, err => {
  if (err) { console.error('  ❌ DB error:', err.message); process.exit(1); }
});

db.serialize(() => {
  db.get('SELECT COUNT(*) as total FROM backtest_signals_v2', (err, row) => {
    if (err || !row) { db.close(); return; }

    console.log(`\n${'─'.repeat(62)}`);
    console.log(' 📈  V2 SIGNALS');
    console.log(`${'─'.repeat(62)}`);
    console.log(`  Total signals:  ${row.total}`);

    db.get(`
      SELECT
        SUM(CASE WHEN result='WIN'  THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result='LOSS' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN result IS NOT NULL THEN 1 ELSE 0 END) as graded,
        SUM(CASE WHEN exit_type='SL' THEN 1 ELSE 0 END) as sl_hits,
        SUM(CASE WHEN exit_type='TP' THEN 1 ELSE 0 END) as tp_hits,
        SUM(pnl_usd)     as total_pnl,
        AVG(pnl_percent) as avg_pnl
      FROM backtest_signals_v2 WHERE result IS NOT NULL
    `, (err2, r) => {
      if (!err2 && r && r.graded > 0) {
        const winRate    = ((r.wins / r.graded) * 100).toFixed(1);
        const pnlSign    = (r.total_pnl || 0) >= 0 ? '+' : '';
        console.log(`\n  Win Rate:  ${renderBar(parseFloat(winRate), 30)} ${winRate}%`);
        console.log(`             ${r.wins} wins / ${r.losses} losses / ${r.graded} graded`);
        console.log(`\n  Avg P/L per trade:  ${(r.avg_pnl || 0) >= 0 ? '+' : ''}${(r.avg_pnl || 0).toFixed(2)}%`);
        console.log(`  Total P/L:          $${pnlSign}${(r.total_pnl || 0).toFixed(2)}`);
        if (r.sl_hits || r.tp_hits) {
          console.log(`  Exits:  🛑 SL ${r.sl_hits || 0}  |  🎯 TP ${r.tp_hits || 0}`);
        }
      } else {
        console.log('  ⏳ P&L not yet calculated (run improve-v2 first).');
      }

      // Setup breakdown
      db.all(`
        SELECT setup_type,
               COUNT(*) as cnt,
               SUM(CASE WHEN result='WIN' THEN 1 ELSE 0 END) as wins
        FROM backtest_signals_v2
        GROUP BY setup_type
        ORDER BY setup_type
      `, (err3, rows) => {
        if (!err3 && rows && rows.length > 0) {
          console.log(`\n  Setup Breakdown:`);
          for (const row of rows) {
            const wr = row.cnt > 0 ? ((row.wins / row.cnt) * 100).toFixed(1) : '0.0';
            console.log(`    Setup ${row.setup_type || '?'}: ${row.cnt} signals — ${wr}% win rate`);
          }
        }

        db.get('SELECT MIN(date) as first, MAX(date) as last FROM backtest_signals_v2', (_, tr) => {
          if (tr?.first) {
            console.log(`\n  Date range:  ${tr.first.split('T')[0]} → ${tr.last.split('T')[0]}`);
          }
          console.log('');
          db.close();
        });
      });
    });
  });
});
