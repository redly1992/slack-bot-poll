'use strict';
const { execSync } = require('child_process');
const fs           = require('fs');

const STATE_FILE = 'cycle-v2-state.json';

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (_) {}
  return {};
}

function writeState(partial) {
  const state = readState();
  Object.assign(state, partial);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanup() {
  process.stdout.write('  🧹 Cleanup... ');
  let removed = 0;
  // Also remove WAL journal files — orphaned -shm/-wal cause SQLite READONLY errors next cycle
  for (const f of [
    'backtest-results-v2.db',
    'backtest-results-v2.db-shm',
    'backtest-results-v2.db-wal',
    'checkpoint-v2.json',
  ]) {
    if (fs.existsSync(f)) { fs.unlinkSync(f); removed++; }
  }
  console.log(`removed ${removed} file(s)`);
}

function runStep(cmd, label, cycleNumber) {
  console.log(`\n[Cycle ${cycleNumber}] ▶️  ${label}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`\n[Cycle ${cycleNumber}] ❌ "${label}" exited with error: ${err.message}`);
    return false;
  }
}

async function main() {
  const initial      = readState();
  let   cycleNumber  = (initial.totalCyclesCompleted || 0) + 1;
  const startedAt    = initial.overallStartedAt || new Date().toISOString();

  writeState({
    status:           'running',
    pid:              process.pid,
    cycleNumber,
    overallStartedAt: startedAt,
    symbol:           'BTC/USDT',
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received — stopping after current step...');
    writeState({ status: 'stopped', stoppedAt: new Date().toISOString() });
    process.exit(0);
  });

  console.log('\n🤖 V2 Auto-Cycle Daemon');
  console.log(`   PID:     ${process.pid}`);
  console.log(`   State:   ${STATE_FILE}`);
  console.log(`   Monitor: npm run check-v2`);
  console.log(`   Stop:    npm run stop-v2\n`);

  while (true) {
    const cycleStart = Date.now();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(` 🔄  CYCLE #${cycleNumber}  —  ${new Date().toLocaleString()}`);
    console.log(`${'═'.repeat(60)}`);

    // Step 1 — Cleanup
    writeState({ cycleNumber, cycleStartedAt: new Date().toISOString(), currentStep: 'cleanup', stepNumber: 1, stepStartedAt: new Date().toISOString() });
    cleanup();
    await sleep(2000);

    // Step 2 — Backtest
    writeState({ currentStep: 'backtest', stepNumber: 2, stepStartedAt: new Date().toISOString() });
    const backtestOk = runStep('node backtest-v2.js', 'backtest-v2', cycleNumber);
    await sleep(2000);

    // Step 3 — Improve (only if backtest succeeded)
    if (!backtestOk) {
      console.warn(`  ⚠️  Backtest failed — skipping improve-v2, will retry next cycle`);
    } else {
      writeState({ currentStep: 'improve-v2', stepNumber: 3, stepStartedAt: new Date().toISOString() });
      runStep('node improve-v2.js', 'improve-v2', cycleNumber);
      await sleep(2000);
    }

    const durationMs = Date.now() - cycleStart;
    writeState({
      currentStep:          'between-cycles',
      stepNumber:           0,
      totalCyclesCompleted: cycleNumber,
      lastCycleCompletedAt: new Date().toISOString(),
      avgCycleDurationMs:   durationMs,
    });

    console.log(`\n✅ Cycle #${cycleNumber} complete in ${(durationMs / 60000).toFixed(1)} min`);
    cycleNumber++;
    writeState({ cycleNumber });
  }
}

main().catch(err => {
  console.error('\n💥 Auto-cycle-v2 fatal error:', err.message);
  writeState({ status: 'error', error: err.message });
  process.exit(1);
});
