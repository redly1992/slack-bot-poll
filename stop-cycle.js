/**
 * Stop the auto-cycle daemon.
 * Reads PID from cycle-state.json and sends SIGTERM.
 *
 * Usage:  npm run stop
 */

const fs = require('fs');
const STATE_FILE = 'cycle-state.json';

if (!fs.existsSync(STATE_FILE)) {
  console.log('❌  No auto-cycle state file found (cycle-state.json).');
  console.log('    The daemon may not be running, or was never started.');
  process.exit(1);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
} catch (err) {
  console.error(`❌  Could not read ${STATE_FILE}: ${err.message}`);
  process.exit(1);
}

if (!state.pid) {
  console.log('❌  No PID found in cycle-state.json.');
  process.exit(1);
}

if (state.status === 'stopped') {
  console.log(`⚠️   Auto-cycle (PID ${state.pid}) is already marked as stopped.`);
  process.exit(0);
}

console.log(`🛑  Stopping auto-cycle daemon (PID: ${state.pid})...`);

try {
  process.kill(state.pid, 'SIGTERM');

  // Mark as stopped in state file
  state.status = 'stopped';
  state.stoppedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log(`✅  Sent SIGTERM to PID ${state.pid}`);
  console.log(`    The daemon will finish its current step then exit.`);
  console.log(`    Run "npm run check-progress" to confirm it stopped.`);
} catch (err) {
  if (err.code === 'ESRCH') {
    console.log(`⚠️   Process ${state.pid} not found — already exited.`);
    state.status = 'stopped';
    state.stoppedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } else {
    console.error(`❌  Error sending signal: ${err.message}`);
    process.exit(1);
  }
}
