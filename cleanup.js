/**
 * Cleanup - delete backtest database and checkpoint
 * Run this after improve-cycle to start a fresh backtest
 */

const fs = require('fs');

const FILES = [
  'backtest-results.db',
  'backtest-checkpoint.json'
];

console.log('\n🧹 Cleaning up backtest files...\n');

let cleaned = 0;

FILES.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`  🗑️  Deleted: ${file}`);
      cleaned++;
    } else {
      console.log(`  ⏭️  Not found: ${file}`);
    }
  } catch (error) {
    console.log(`  ⚠️  Could not delete ${file}: ${error.message}`);
    console.log(`      Close any open DB connections and try again.`);
  }
});

console.log(`\n${cleaned > 0 ? '✅' : 'ℹ️ '} ${cleaned} file(s) removed.\n`);
console.log('Ready for a fresh backtest:');
console.log('  npm run backtest\n');
