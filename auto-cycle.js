require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Auto-Cycle Daemon
 * Runs cleanup → backtest → improve-cycle (which includes pnl calc + analysis)
 * repeatedly, updating cycle-state.json so check-progress can track it.
 *
 * Usage:  npm run auto-cycle
 * Stop:   npm run stop
 * Watch:  npm run check-progress
 */

const STATE_FILE = 'cycle-state.json';
const LOG_FILE = 'auto-cycle.log';

const STEPS = [
  { name: 'cleanup',       cmd: 'node cleanup.js',        label: 'Cleanup DB & checkpoint' },
  { name: 'backtest',      cmd: 'node backtest.js',        label: 'Running backtest'         },
  { name: 'improve-cycle', cmd: 'node improve-cycle.js',   label: 'Improve strategy (AI)'    },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

function writeState(patch) {
  let current = {};
  try { current = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch (_) {}
  const next = Object.assign(current, patch);
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2)); } catch (_) {}
}

function readTotalCandles(symbol) {
  try {
    const file = path.join('data', `${symbol.replace('/', '-').toLowerCase()}-15m.csv`);
    if (!fs.existsSync(file)) return 0;
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(l => l.trim());
    return Math.max(0, lines.length - 1 - 100); // subtract header + warmup
  } catch (_) { return 0; }
}

// ── main loop ─────────────────────────────────────────────────────────────────

async function main() {
  const overallStartedAt = new Date().toISOString();
  const pid = process.pid;
  const symbol = process.env.BACKTEST_SYMBOL || 'BTC/USDT';
  let cycleNumber = 1;
  let totalCyclesCompleted = 0;
  let cycleDurations = []; // track last 3 cycle durations for ETA

  // Write initial state
  writeState({
    pid,
    status: 'running',
    overallStartedAt,
    cycleNumber,
    totalCyclesCompleted,
    totalSteps: STEPS.length,
    symbol
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    log(`\n⚠️  Received ${signal}. Shutting down after current step...`);
    writeState({ status: 'stopped', stoppedAt: new Date().toISOString() });
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  log(`🚀 Auto-cycle daemon started  PID: ${pid}`);
  log(`📄 Logs: ${LOG_FILE}  |  State: ${STATE_FILE}`);
  log(`📊 Monitor: npm run check-progress  |  Stop: npm run stop`);

  while (true) {
    const cycleStart = Date.now();
    log(`\n${'='.repeat(60)}`);
    log(`🔄 CYCLE ${cycleNumber} START`);
    log(`${'='.repeat(60)}`);

    writeState({
      cycleNumber,
      totalCyclesCompleted,
      cycleStartedAt: new Date().toISOString(),
      currentStep: null,
      status: 'running'
    });

    let cycleOk = true;

    for (let idx = 0; idx < STEPS.length; idx++) {
      const step = STEPS[idx];
      const stepNumber = idx + 1;
      const stepStart = Date.now();

      writeState({
        currentStep: step.name,
        currentStepLabel: step.label,
        stepNumber,
        stepStartedAt: new Date().toISOString()
      });

      log(`\n📋 [Cycle ${cycleNumber}] Step ${stepNumber}/${STEPS.length}: ${step.label}`);

      try {
        execSync(step.cmd, { stdio: 'inherit' });
        const elapsed = ((Date.now() - stepStart) / 1000).toFixed(0);
        log(`✅ Step ${stepNumber} done (${elapsed}s): ${step.name}`);
      } catch (err) {
        log(`⚠️  Step ${stepNumber} failed: ${step.name} — ${err.message}`);
        // Continue loop — a failed step shouldn't stop the daemon
        cycleOk = false;
      }
    }

    totalCyclesCompleted++;
    const cycleDuration = Date.now() - cycleStart;
    cycleDurations.push(cycleDuration);
    if (cycleDurations.length > 3) cycleDurations.shift();

    const avgCycleMs = cycleDurations.reduce((a, b) => a + b, 0) / cycleDurations.length;

    log(`\n${cycleOk ? '✅' : '⚠️ '} CYCLE ${cycleNumber} COMPLETE in ${(cycleDuration / 60000).toFixed(1)} min`);

    writeState({
      currentStep: 'between-cycles',
      currentStepLabel: 'Cycle complete — starting next cycle...',
      stepNumber: STEPS.length,
      stepStartedAt: null,
      lastCycleCompletedAt: new Date().toISOString(),
      totalCyclesCompleted,
      avgCycleDurationMs: Math.round(avgCycleMs)
    });

    cycleNumber++;

    // Brief pause between cycles
    await new Promise(r => setTimeout(r, 3000));
  }
}

main().catch(err => {
  log(`❌ Fatal: ${err.message}`);
  writeState({ status: 'error', error: err.message });
  process.exit(1);
});
