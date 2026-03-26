const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('backtest-results.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

// Load checkpoint to get progress
let checkpoint = { lastProcessedIndex: -1 };
try {
  if (fs.existsSync('backtest-checkpoint.json')) {
    const data = fs.readFileSync('backtest-checkpoint.json', 'utf-8');
    checkpoint = JSON.parse(data);
  }
} catch (error) {
  // Checkpoint doesn't exist or invalid
}

// Count total candles in 15m data (primary timeframe for backtest)
const startIndex = 100; // Backtest starts at index 100
let totalCandles = 0;
let processableCandles = 0;

try {
  const dataFile = path.join('data', 'btc-usdt-15m.csv');
  if (fs.existsSync(dataFile)) {
    const content = fs.readFileSync(dataFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    totalCandles = lines.length - 1; // Subtract header line
    processableCandles = totalCandles - startIndex;
  }
} catch (error) {
  console.error('Error reading data file:', error.message);
}

db.get('SELECT COUNT(*) as total FROM backtest_signals', (err, row) => {
  if (err) {
    console.error('Query error:', err.message);
    process.exit(1);
  }
  
  console.log(`\n📊 Backtest Progress Report`);
  console.log(`${'='.repeat(60)}`);
  
  // Get latest signal to estimate progress
  db.get('SELECT MAX(timestamp) as last_timestamp FROM backtest_signals', (err2, lastRow) => {
    let estimatedProgress = 0;
    let estimatedIndex = startIndex;
    
    if (!err2 && lastRow && lastRow.last_timestamp) {
      // Calculate progress from latest signal in database
      const dataFile = path.join('data', 'btc-usdt-15m.csv');
      if (fs.existsSync(dataFile)) {
        try {
          const content = fs.readFileSync(dataFile, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          // Find index of last processed timestamp
          for (let i = 1; i < lines.length; i++) {
            const timestamp = parseInt(lines[i].split(',')[0]);
            if (timestamp === lastRow.last_timestamp) {
              estimatedIndex = i;
              break;
            }
          }
        } catch (e) {
          // Ignore error
        }
      }
    } else if (checkpoint.lastProcessedIndex > startIndex) {
      estimatedIndex = checkpoint.lastProcessedIndex;
    }
    
    const processedCandles = estimatedIndex - startIndex;
    const percentComplete = processableCandles > 0 
      ? ((processedCandles / processableCandles) * 100).toFixed(1) 
      : 0;
    
    const isRunning = row.total > 0 && parseFloat(percentComplete) < 100;
    const status = isRunning ? '🔄 Running' : parseFloat(percentComplete) >= 100 ? '✅ Complete' : '⏸️  Not Started';
    
    console.log(`Status:                ${status}`);
    console.log(`Progress:              ${Math.max(0, parseFloat(percentComplete)).toFixed(1)}% complete`);
    console.log(`Candles Processed:     ${Math.max(0, processedCandles).toLocaleString()} / ${processableCandles.toLocaleString()}`);
    console.log(`Signals recorded:      ${row.total}`);
  
  if (checkpoint.updatedAt) {
    console.log(`Last Checkpoint:       ${new Date(checkpoint.updatedAt).toLocaleString()}`);
  }
  
  if (row.total > 0) {
    db.all(`
      SELECT 
        ai_signal,
        COUNT(*) as count,
        AVG(ai_confidence) as avg_confidence
      FROM backtest_signals
      GROUP BY ai_signal
    `, (err, rows) => {
      if (!err && rows) {
        console.log(`\nSignal Distribution:`);
        rows.forEach(r => {
          console.log(`  ${r.ai_signal}: ${r.count} signals (avg confidence: ${r.avg_confidence.toFixed(1)}%)`);
        });
      }
      
      db.get(`
        SELECT 
          MIN(timestamp) as first_signal,
          MAX(timestamp) as last_signal
        FROM backtest_signals
      `, (err, timeRow) => {
        if (!err && timeRow) {
          const first = new Date(timeRow.first_signal).toISOString().split('T')[0];
          const last = new Date(timeRow.last_signal).toISOString().split('T')[0];
          console.log(`\nDate Range:            ${first} to ${last}`);
        }
        
        // Show estimated time to completion if running
        if (percentComplete > 0 && percentComplete < 100 && checkpoint.updatedAt) {
          const elapsed = Date.now() - new Date(checkpoint.updatedAt).getTime();
          const msPerPercent = elapsed / parseFloat(percentComplete);
          const remainingPercent = 100 - parseFloat(percentComplete);
          const estimatedMs = msPerPercent * remainingPercent;
          
          const hours = Math.floor(estimatedMs / (1000 * 60 * 60));
          const minutes = Math.floor((estimatedMs % (1000 * 60 * 60)) / (1000 * 60));
          
          if (hours > 0 || minutes > 0) {
            console.log(`\nEstimated Time Left:   ~${hours}h ${minutes}m`);
          }
        }
        
        console.log('');
        db.close();
      });
    });
  } else {
    console.log('');
    db.close();
  }
  });
});
