const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * Unified progress reporter.
 * Shows: cycle count, current step, % of current cycle,
 *        backtest sub-progress (from checkpoint), and live DB stats.
 */

const STATE_FILE  = 'cycle-state.json';
const CHECKPOINT  = 'backtest-checkpoint.json';

// ── helpers ──────────────────────────────────────────────────────────────────

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

function getTotalCandles(symbol) {
  try {
    const file = path.join('data', `${(symbol || 'BTC/USDT').replace('/', '-').toLowerCase()}-15m.csv`);
    if (!fs.existsSync(file)) return 0;
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim());
    return Math.max(0, lines.length - 1); // minus header
  } catch (_) { return 0; }
}

// ── Step weight map (each step = 1/totalSteps of a cycle) ────────────────────
const STEP_NAMES = ['cleanup', 'backtest', 'improve-cycle'];
const TOTAL_STEPS = STEP_NAMES.length;

function computeCyclePct(state, checkpoint, totalCandles) {
  if (!state || !state.currentStep) return 0;

  const stepIdx  = STEP_NAMES.indexOf(state.currentStep);
  const stepSize = 100 / TOTAL_STEPS; // each step = 20%

  if (state.currentStep === 'between-cycles') return 100;
  if (stepIdx === -1) return 0;

  // Base: percentage from completed steps
  let pct = stepIdx * stepSize;

  // Add sub-progress for the current step
  if (state.currentStep === 'backtest' && checkpoint && totalCandles > 0) {
    const idx = checkpoint.lastProcessedIndex || 0;
    const subPct = Math.min(1, Math.max(0, (idx - 100) / (totalCandles - 100)));
    pct += subPct * stepSize;
  } else {
    // Other steps: count them as "in progress" (50% through the step)
    pct += stepSize * 0.5;
  }

  return Math.min(100, pct);
}

// ── main ─────────────────────────────────────────────────────────────────────

const state      = readJSON(STATE_FILE);
const checkpoint = readJSON(CHECKPOINT);
const symbol     = (state && state.symbol) || 'BTC/USDT';
const totalCandles = getTotalCandles(symbol);

// Backtest candle progress
let backtestPct  = 0;
let backtestIdx  = 0;
if (checkpoint && totalCandles > 0) {
  backtestIdx = Math.max(0, (checkpoint.lastProcessedIndex || 0) - 100);
  backtestPct = Math.min(100, (backtestIdx / (totalCandles - 100)) * 100);
}

const cyclePct   = computeCyclePct(state, checkpoint, totalCandles);

// ── print header ─────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(62)}`);
console.log(' 📊  TRADING BOT — PROGRESS REPORT');
console.log(`${'═'.repeat(62)}`);

if (!state) {
  console.log('\n  ⏸️   No auto-cycle running. Start with: npm run auto-cycle\n');
} else {
  const statusEmoji = state.status === 'running' ? '🟢' : state.status === 'stopped' ? '🔴' : '🟡';
  const elapsed = state.overallStartedAt ? fmtDuration(Date.now() - new Date(state.overallStartedAt).getTime()) : '?';

  console.log(`\n  Status:             ${statusEmoji}  ${(state.status || 'unknown').toUpperCase()}`);
  console.log(`  PID:                ${state.pid || '?'}`);
  console.log(`  Total time running: ${elapsed}`);

  console.log(`\n${'─'.repeat(62)}`);
  console.log(' 🔄  CYCLE OVERVIEW');
  console.log(`${'─'.repeat(62)}`);
  console.log(`  Cycles completed:   ${state.totalCyclesCompleted || 0}`);
  console.log(`  Current cycle:      #${state.cycleNumber || 1}`);
  if (state.avgCycleDurationMs) {
    console.log(`  Avg cycle duration: ${fmtDuration(state.avgCycleDurationMs)}`);
    if (state.status === 'running' && state.cycleStartedAt) {
      const cycleElapsed = Date.now() - new Date(state.cycleStartedAt).getTime();
      const eta = state.avgCycleDurationMs - cycleElapsed;
      if (eta > 0) console.log(`  ETA this cycle:     ~${fmtDuration(eta)}`);
    }
  }
  if (state.lastCycleCompletedAt) {
    console.log(`  Last cycle done:    ${new Date(state.lastCycleCompletedAt).toLocaleString()}`);
  }

  console.log(`\n${'─'.repeat(62)}`);
  console.log(' 📋  CURRENT CYCLE PROGRESS');
  console.log(`${'─'.repeat(62)}`);
  console.log(`  ${renderBar(cyclePct)} ${cyclePct.toFixed(1)}%`);
  console.log('');

  STEP_NAMES.forEach((name, i) => {
    const stepNum = i + 1;
    const isCurrent = state.currentStep === name;
    const isDone = state.stepNumber > stepNum ||
      (state.currentStep === 'between-cycles') ||
      (state.stepNumber === stepNum && !isCurrent);
    const isPending = !isCurrent && !isDone;

    let icon = isPending ? '  ○' : isDone ? '  ✅' : '  ▶️ ';
    let label = name;
    let extra = '';

    if (isCurrent) {
      const stepElapsed = state.stepStartedAt
        ? fmtDuration(Date.now() - new Date(state.stepStartedAt).getTime())
        : '';
      extra = `  ← running (${stepElapsed})`;
      if (name === 'backtest' && totalCandles > 0) {
        extra += `  ${backtestPct.toFixed(1)}% of candles`;
      }
    }
    console.log(`${icon}  Step ${stepNum}: ${label}${extra}`);
  });

  // Backtest bar (only while backtest step is active or has partial data)
  if (state.currentStep === 'backtest' && totalCandles > 0) {
    console.log('');
    console.log(`  Backtest: ${renderBar(backtestPct, 30)} ${backtestPct.toFixed(1)}%`);
    console.log(`  Candles:  ${backtestIdx.toLocaleString()} / ${(totalCandles - 100).toLocaleString()}`);
    if (checkpoint && checkpoint.updatedAt) {
      console.log(`  Last save: ${new Date(checkpoint.updatedAt).toLocaleString()}`);
    }
  }
}

// ── DB stats (if DB exists) ───────────────────────────────────────────────────

if (!fs.existsSync('backtest-results.db')) {
  console.log(`\n  📂 No database yet.\n`);
  process.exit(0);
}

const db = new sqlite3.Database('backtest-results.db', (err) => {
  if (err) { console.error('  ❌ DB error:', err.message); process.exit(1); }
});

db.serialize(() => {
  db.get(`SELECT COUNT(*) as total FROM backtest_signals`, (err, row) => {
    if (err || !row) { db.close(); return; }

    console.log(`\n${'─'.repeat(62)}`);
    console.log(' 📈  CURRENT CYCLE RESULTS');
    console.log(`${'─'.repeat(62)}`);
    console.log(`  Total signals:      ${row.total}`);

    db.get(`
      SELECT
        SUM(CASE WHEN result = 'WIN'  THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN result IS NOT NULL THEN 1 ELSE 0 END) as graded,
        SUM(CASE WHEN exit_type = 'SL' THEN 1 ELSE 0 END) as sl_hits,
        SUM(CASE WHEN exit_type = 'TP' THEN 1 ELSE 0 END) as tp_hits,
        SUM(pnl_usd) as total_pnl,
        AVG(pnl_percent) as avg_pnl,
        AVG(ai_confidence) as avg_conf
      FROM backtest_signals WHERE result IS NOT NULL
    `, (err2, r) => {
      if (!err2 && r && r.graded > 0) {
        const winRate = ((r.wins / r.graded) * 100).toFixed(1);
        const winRateBar = renderBar(parseFloat(winRate), 30);
        const pnlSign = (r.total_pnl || 0) >= 0 ? '+' : '';

        console.log(`\n  Win Rate:    ${winRateBar} ${winRate}%`);
        console.log(`               ${r.wins} wins  /  ${r.losses} losses  /  ${r.graded} graded`);
        console.log('');
        console.log(`  Avg P/L per trade:  ${(r.avg_pnl || 0) >= 0 ? '+' : ''}${(r.avg_pnl || 0).toFixed(2)}%`);
        console.log(`  Total P/L:          $${pnlSign}${(r.total_pnl || 0).toFixed(2)}`);
        console.log(`  Avg AI confidence:  ${(r.avg_conf || 0).toFixed(1)}%`);
        if (r.sl_hits || r.tp_hits) {
          console.log(`  Exits:  🛑 SL ${r.sl_hits || 0}  |  🎯 TP ${r.tp_hits || 0}`);
        }
      } else {
        console.log('  ⏳ P&L not yet calculated for this cycle.');
      }

      db.get(`SELECT MIN(date) as first, MAX(date) as last FROM backtest_signals`, (_, tr) => {
        if (tr && tr.first) {
          console.log(`  Date range:         ${tr.first.split('T')[0]} → ${tr.last.split('T')[0]}`);
        }
        console.log('');
        db.close();
      });
    });
  });
});
