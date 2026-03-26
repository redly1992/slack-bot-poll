# 🚀 CLI ARGUMENTS - Complete Guide

## ✨ NEW FEATURE: All Commands Support CLI Arguments!

You can now pass arguments directly to all backtest commands without environment variables!

---

## 📥 DOWNLOAD-DATA

### Syntax
```bash
npm run download-data -- [options]
```

### Options
| Argument | Description | Default | Example |
|----------|-------------|---------|---------|
| `--months=<n>` | Number of months | 3 | `--months=6` |
| `--symbol=<pair>` | Trading pair | BTC/USDT | `--symbol=ETH/USDT` |
| `--timeframes=<list>` | Timeframes (comma-separated) | 5m,15m,1h,4h | `--timeframes=5m,1h` |
| `--data-dir=<path>` | Output directory | data | `--data-dir=mydata` |
| `--help`, `-h` | Show help | - | `--help` |

### Examples
```bash
# Default (3 months BTC/USDT)
npm run download-data

# 6 months of BTC
npm run download-data -- --months=6

# 3 months of ETH
npm run download-data -- --symbol=ETH/USDT

# 12 months of SOL with custom timeframes
npm run download-data -- --months=12 --symbol=SOL/USDT --timeframes=5m,1h,4h

# Show help
npm run download-data -- --help
```

### Output
- ✅ Progress bar with live stats
- ✅ CSV files: `data/<symbol>-<timeframe>.csv`
- ✅ File size and candle counts

---

## 🧪 BACKTEST

### Syntax
```bash
npm run backtest -- [options]
```

### Options
| Argument | Description | Default | Example |
|----------|-------------|---------|---------|
| `--symbol=<pair>` | Trading pair | BTC/USDT | `--symbol=ETH/USDT` |
| `--data-dir=<path>` | CSV directory | data | `--data-dir=mydata` |
| `--db-path=<file>` | Database file | backtest-results.db | `--db-path=eth-test.db` |
| `--position-size=<n>` | Position size USD | 1000 | `--position-size=500` |
| `--hold-hours=<n>` | Hold duration | 24 | `--hold-hours=48` |
| **`--fresh`** | **Start fresh (ignore checkpoint)** | - | `--fresh` |
| **`--resume`** | **Resume from checkpoint (default)** | - | `--resume` |
| `--help`, `-h` | Show help | - | `--help` |

### 🔄 Checkpoint System (Auto-Resume)

**By default, backtest automatically resumes from where it left off!**

- ✅ Checkpoint saves every 50 candles to `backtest-checkpoint.json`
- ✅ If backtest crashes or exits, just run again to resume
- ✅ No duplicate AI calls or database entries
- ✅ Progress bar shows correct position

**To start fresh (ignore checkpoint):**
```bash
# Option 1: Use --fresh flag
npm run backtest -- --fresh

# Option 2: Delete checkpoint file
rm backtest-checkpoint.json && npm run backtest
```

**When to use --fresh:**
- ✅ Testing different symbol: `npm run backtest -- --symbol=ETH/USDT --fresh`
- ✅ Changed strategy parameters
- ✅ Want to restart from beginning
- ✅ Testing after code changes

**When backtest auto-resumes:**
- 🔄 Process was interrupted (Ctrl+C, crash, timeout)
- 🔄 Running same symbol again without --fresh flag
- 🔄 Checkpoint file exists

### Examples
```bash
# Default (BTC/USDT) - resumes if checkpoint exists
npm run backtest

# Start fresh (ignore any existing checkpoint)
npm run backtest -- --fresh

# Test ETH (auto-resumes if ETH checkpoint exists)
npm run backtest -- --symbol=ETH/USDT

# Test ETH fresh start
npm run backtest -- --symbol=ETH/USDT --fresh

# Test SOL with $500 positions, fresh start
npm run backtest -- --symbol=SOL/USDT --position-size=500 --fresh

# Test with 48-hour hold period
npm run backtest -- --hold-hours=48

# Show help
npm run backtest -- --help
```

### Output
- ✅ Progress bar with checkpoint resume
- ✅ SQLite database with signals
- ✅ Stats: candles, alignments, signals, AI calls
- ✅ Checkpoint file for auto-resume

---

## 💰 CALCULATE-PNL

### Syntax
```bash
npm run calculate-pnl -- [options]
```

### Options
| Argument | Description | Default | Example |
|----------|-------------|---------|---------|
| `--symbol=<pair>` | Trading pair | BTC/USDT | `--symbol=ETH/USDT` |
| `--db-path=<file>` | Database file | backtest-results.db | `--db-path=eth-test.db` |
| `--data-dir=<path>` | CSV directory | data | `--data-dir=mydata` |
| `--position-size=<n>` | Position size USD | 1000 | `--position-size=500` |
| `--hold-hours=<n>` | Hold duration | 24 | `--hold-hours=48` |
| `--help`, `-h` | Show help | - | `--help` |

### Examples
```bash
# Default (BTC/USDT)
npm run calculate-pnl

# Calculate for ETH
npm run calculate-pnl -- --symbol=ETH/USDT

# Calculate for SOL with custom position size
npm run calculate-pnl -- --symbol=SOL/USDT --position-size=500

# Show help
npm run calculate-pnl -- --help
```

### Output
- ✅ Win rate and profit/loss
- ✅ Best and worst trades
- ✅ Performance by direction (LONG/SHORT)
- ✅ Updates database with results

---

## 🔄 COMPLETE WORKFLOW WITH ETH

```bash
# ══════════════════════════════════════════════
# Step 1: Download ETH data (3 months)
# ══════════════════════════════════════════════
npm run download-data -- --symbol=ETH/USDT --months=3

# ══════════════════════════════════════════════
# Step 2: Clean previous results
# ══════════════════════════════════════════════
rm backtest-results.db backtest-checkpoint.json

# ══════════════════════════════════════════════
# Step 3: Run backtest on ETH
# ══════════════════════════════════════════════
npm run backtest -- --symbol=ETH/USDT

# ══════════════════════════════════════════════
# Step 4: Calculate P/L for ETH
# ══════════════════════════════════════════════
npm run calculate-pnl -- --symbol=ETH/USDT

# ══════════════════════════════════════════════
# Step 5: Analyze results
# ══════════════════════════════════════════════
npm run analyze-results

# ══════════════════════════════════════════════
# Step 6: Improve strategy
# ══════════════════════════════════════════════
npm run improve-cycle
```

---

## 🌟 COMPARE MULTIPLE SYMBOLS

```bash
# Test BTC
npm run download-data -- --symbol=BTC/USDT
rm backtest-results.db backtest-checkpoint.json
npm run backtest -- --symbol=BTC/USDT
npm run calculate-pnl -- --symbol=BTC/USDT

# Test ETH
npm run download-data -- --symbol=ETH/USDT
rm backtest-results.db backtest-checkpoint.json
npm run backtest -- --symbol=ETH/USDT
npm run calculate-pnl -- --symbol=ETH/USDT

# Test SOL
npm run download-data -- --symbol=SOL/USDT
rm backtest-results.db backtest-checkpoint.json
npm run backtest -- --symbol=SOL/USDT
npm run calculate-pnl -- --symbol=SOL/USDT
```

---

## 🆚 CLI vs Environment Variables

### NEW WAY (Recommended)
```bash
# Clean, explicit, easy to read
npm run backtest -- --symbol=ETH/USDT
```

### OLD WAY (Still Works)
```bash
# Environment variables
BACKTEST_SYMBOL=ETH/USDT npm run backtest
```

### Priority
**CLI Arguments > Environment Variables > Defaults**

If you set both, CLI arguments win!

---

## 📋 QUICK REFERENCE TABLE

| Command | Default Symbol | Change Symbol | Help |
|---------|---------------|---------------|------|
| `download-data` | BTC/USDT | `-- --symbol=ETH/USDT` | `-- --help` |
| `backtest` | BTC/USDT | `-- --symbol=ETH/USDT` | `-- --help` |
| `calculate-pnl` | BTC/USDT | `-- --symbol=ETH/USDT` | `-- --help` |
| `analyze-results` | N/A (uses DB) | N/A | N/A |
| `improve-cycle` | N/A (uses DB) | N/A | N/A |

---

## 🎯 COMMON USE CASES

### 1. Quick Test Different Symbol
```bash
npm run download-data -- --symbol=ETH/USDT
npm run backtest -- --symbol=ETH/USDT
npm run calculate-pnl -- --symbol=ETH/USDT
```

### 2. More Data for Better Stats
```bash
npm run download-data -- --months=12
npm run backtest
npm run calculate-pnl
```

### 3. Smaller Position Sizes
```bash
npm run backtest -- --position-size=500
npm run calculate-pnl -- --position-size=500
```

### 4. Longer Hold Periods
```bash
npm run backtest -- --hold-hours=48
npm run calculate-pnl -- --hold-hours=48
```

---

## ✅ BENEFITS

- ✅ **Cleaner syntax** - No more environment variables
- ✅ **Platform independent** - Works on Windows, Linux, macOS
- ✅ **Self-documenting** - `--help` shows all options
- ✅ **Composable** - Mix multiple options easily
- ✅ **Backwards compatible** - Old env vars still work
- ✅ **Explicit** - Clear what you're testing

---

## 🚨 IMPORTANT NOTES

1. **Double dash required**: `npm run` needs `--` before arguments
   ```bash
   npm run backtest -- --symbol=ETH/USDT
   #                 ^^ needed for npm
   ```

2. **Symbol format**: Must match downloaded files
   ```bash
   # Download creates: eth-usdt-5m.csv
   # Backtest expects: ETH/USDT (converts to eth-usdt)
   ```

3. **CSV files must exist**: Download data first!
   ```bash
   npm run download-data -- --symbol=ETH/USDT
   # THEN
   npm run backtest -- --symbol=ETH/USDT
   ```

4. **Database consistency**: Use same symbol for entire workflow
   ```bash
   # ✅ GOOD
   npm run backtest -- --symbol=ETH/USDT
   npm run calculate-pnl -- --symbol=ETH/USDT
   
   # ❌ BAD (mismatched symbols)
   npm run backtest -- --symbol=ETH/USDT
   npm run calculate-pnl -- --symbol=BTC/USDT
   ```

---

## 🎉 SUCCESS!

You now have full CLI control over:
- ✅ Data downloads with progress bars
- ✅ Backtesting with symbol selection
- ✅ P/L calculation with symbol selection
- ✅ Help commands for all tools
- ✅ Backwards compatibility with env vars

**Start testing different symbols and timeframes today!** 🚀
