require('dotenv').config();
const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');

/**
 * Download Historical Data for Backtesting
 * Downloads OHLCV data for specified timeframes and saves to CSV
 */

class HistoricalDataDownloader {
  constructor(config = {}) {
    this.exchange = new ccxt.binance({ enableRateLimit: true });
    this.symbol = config.symbol || 'BTC/USDT';
    this.timeframes = config.timeframes || ['5m', '15m', '1h', '4h'];
    this.months = config.months || 3; // Default 3 months
    this.dataDir = config.dataDir || 'data';
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  /**
   * Calculate date range
   */
  getDateRange() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - this.months);
    
    return {
      start: startDate.getTime(),
      end: endDate.getTime(),
      startStr: startDate.toISOString().split('T')[0],
      endStr: endDate.toISOString().split('T')[0]
    };
  }
  
  /**
   * Download OHLCV data for a specific timeframe
   */
  async downloadTimeframe(timeframe) {
    const { start, end, startStr, endStr } = this.getDateRange();
    const allData = [];
    let since = start;
    
    console.log(`\n📥 Downloading ${this.symbol} ${timeframe} data...`);
    console.log(`   Period: ${startStr} to ${endStr} (${this.months} months)`);
    
    let batchCount = 0;
    
    while (since < end) {
      try {
        // Fetch batch (limit 1000 candles per request)
        const ohlcv = await this.exchange.fetchOHLCV(
          this.symbol,
          timeframe,
          since,
          1000
        );
        
        if (ohlcv.length === 0) break;
        
        // Add to collection
        allData.push(...ohlcv);
        
        // Update since for next batch
        since = ohlcv[ohlcv.length - 1][0] + 1;
        
        batchCount++;
        
        // Progress bar (similar to backtest)
        const progress = Math.min(100, ((since - start) / (end - start)) * 100);
        const barLength = 30;
        const filledLength = Math.floor((progress / 100) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        process.stdout.write(`\r   [${bar}] ${progress.toFixed(1)}% | Candles: ${allData.length} | Batches: ${batchCount}`);
        
        // Rate limiting
        await this.sleep(this.exchange.rateLimit);
        
        // Stop if we've reached the end
        if (since >= end) break;
        
      } catch (error) {
        console.error(`\n   ⚠️  Error fetching batch: ${error.message}`);
        await this.sleep(5000); // Wait 5 seconds before retry
      }
    }
    
    console.log(`\n   ✅ Downloaded ${allData.length} candles in ${batchCount} batches`);
    
    return allData;
  }
  
  /**
   * Save data to CSV file
   */
  saveToCSV(data, timeframe) {
    const filename = path.join(this.dataDir, `${this.symbol.replace('/', '-').toLowerCase()}-${timeframe}.csv`);
    
    // CSV header
    let csv = 'timestamp,date,open,high,low,close,volume\n';
    
    // Add data rows
    data.forEach(candle => {
      const [timestamp, open, high, low, close, volume] = candle;
      const date = new Date(timestamp).toISOString();
      csv += `${timestamp},${date},${open},${high},${low},${close},${volume}\n`;
    });
    
    fs.writeFileSync(filename, csv);
    
    const fileSizeMB = (fs.statSync(filename).size / 1024 / 1024).toFixed(2);
    console.log(`   💾 Saved to: ${filename} (${fileSizeMB} MB)`);
    
    return filename;
  }
  
  /**
   * Download all timeframes
   */
  async downloadAll() {
    console.log('\n🚀 Starting Historical Data Download');
    console.log(`${'='.repeat(60)}`);
    console.log(`Symbol: ${this.symbol}`);
    console.log(`Timeframes: ${this.timeframes.join(', ')}`);
    console.log(`Period: ${this.months} months`);
    console.log(`Data directory: ${this.dataDir}`);
    console.log(`${'='.repeat(60)}`);
    
    const results = [];
    
    for (const timeframe of this.timeframes) {
      try {
        const data = await this.downloadTimeframe(timeframe);
        const filename = this.saveToCSV(data, timeframe);
        
        results.push({
          timeframe,
          candles: data.length,
          filename,
          success: true
        });
        
      } catch (error) {
        console.error(`\n❌ Failed to download ${timeframe}: ${error.message}`);
        results.push({
          timeframe,
          candles: 0,
          filename: null,
          success: false,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 DOWNLOAD SUMMARY');
    console.log(`${'='.repeat(60)}\n`);
    
    results.forEach(r => {
      if (r.success) {
        console.log(`✅ ${r.timeframe.padEnd(5)} - ${r.candles.toLocaleString()} candles`);
      } else {
        console.log(`❌ ${r.timeframe.padEnd(5)} - Failed: ${r.error}`);
      }
    });
    
    const successful = results.filter(r => r.success).length;
    console.log(`\n✅ Successfully downloaded ${successful}/${this.timeframes.length} timeframes`);
    
    if (successful === this.timeframes.length) {
      console.log('\n🎉 All data downloaded successfully!');
      console.log(`📁 Files saved in: ${path.resolve(this.dataDir)}`);
    }
    
    return results;
  }
  
  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Parse command-line arguments
 * Supports: --months=6, --symbol=ETH/USDT, --timeframes=5m,15m
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📥 Historical Data Downloader - Usage

COMMAND-LINE ARGUMENTS:
  --months=<number>          Number of months to download (default: 3)
  --symbol=<string>          Trading pair symbol (default: BTC/USDT)
  --timeframes=<list>        Comma-separated timeframes (default: 5m,15m,1h,4h)
  --data-dir=<path>          Directory to save files (default: data)
  --help, -h                 Show this help message

EXAMPLES:
  npm run download-data -- --months=6
  npm run download-data -- --months=12 --symbol=ETH/USDT
  npm run download-data -- --timeframes=5m,1h,4h
  npm run download-data -- --months=3 --symbol=SOL/USDT

ENVIRONMENT VARIABLES (lower priority):
  BACKTEST_MONTHS            Same as --months
  BACKTEST_SYMBOL            Same as --symbol
  BACKTEST_TIMEFRAMES        Same as --timeframes
  BACKTEST_DATA_DIR          Same as --data-dir

OUTPUT:
  - CSV files saved to data/ directory
  - Format: <symbol>-<timeframe>.csv
  - Progress bar shows download status

NOTE: Command-line arguments override environment variables
`);
    process.exit(0);
  }
  
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      
      if (key === 'months') {
        config.months = parseInt(value);
      } else if (key === 'symbol') {
        config.symbol = value;
      } else if (key === 'timeframes') {
        config.timeframes = value.split(',');
      } else if (key === 'dataDir' || key === 'data-dir') {
        config.dataDir = value;
      }
    }
  });
  
  return config;
}

// Run if executed directly
if (require.main === module) {
  // Parse command-line arguments first (highest priority)
  const cliArgs = parseArgs();
  
  // Merge with env vars and defaults (CLI args override env vars)
  const config = {
    symbol: cliArgs.symbol || process.env.BACKTEST_SYMBOL || 'BTC/USDT',
    timeframes: cliArgs.timeframes || process.env.BACKTEST_TIMEFRAMES?.split(',') || ['5m', '15m', '1h', '4h'],
    months: cliArgs.months || parseInt(process.env.BACKTEST_MONTHS) || 3,
    dataDir: cliArgs.dataDir || process.env.BACKTEST_DATA_DIR || 'data'
  };
  
  const downloader = new HistoricalDataDownloader(config);
  
  downloader.downloadAll()
    .then(() => {
      console.log('\n✅ Download complete!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Fatal error: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = HistoricalDataDownloader;
