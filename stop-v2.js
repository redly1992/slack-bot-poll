'use strict';
/**
 * Stop the V2 auto-cycle daemon.
 * Reads PID from cycle-v2-state.json and sends SIGTERM.
 *
 * Usage: npm run stop-v2
 */
const fs         = require('fs');
const STATE_FILE = 'cycle-v2-state.json';

if (!fs.existsSync(STATE_FILE)) {
  console.log('❌  No V2 state file found (cycle-v2-state.json).');
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
  console.log('❌  No PID found in cycle-v2-state.json.');
  process.exit(1);
}

if (state.status === 'stopped') {
  console.log(`⚠️   V2 auto-cycle (PID ${state.pid}) is already marked as stopped.`);
  process.exit(0);
}

console.log(`🛑  Stopping V2 auto-cycle daemon (PID: ${state.pid})...`);

try {
  process.kill(state.pid, 'SIGTERM');

  state.status    = 'stopped';
  state.stoppedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log(`✅  Sent SIGTERM to PID ${state.pid}`);
  console.log(`    Run "npm run check-v2" to confirm it stopped.`);
} catch (err) {
  if (err.code === 'ESRCH') {
    console.log(`⚠️   Process ${state.pid} not found — already exited.`);
    state.status    = 'stopped';
    state.stoppedAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } else {
    console.error(`❌  Error sending signal: ${err.message}`);
    process.exit(1);
  }
}
