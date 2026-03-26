# 🔄 Checkpoint System Guide

## 📌 What is the Checkpoint System?

The backtest engine **automatically saves progress every 50 candles** to a checkpoint file. If the backtest exits for any reason (crash, Ctrl+C, timeout, error), you can simply run it again and it will **resume from where it left off**.

---

## ✨ Key Features

- ✅ **Auto-saves every 50 candles** - No data loss
- ✅ **Automatic resume** - Just run the command again
- ✅ **No duplicate AI calls** - Saves money on API calls
- ✅ **No duplicate database entries** - Clean data
- ✅ **Shows correct progress** - Progress bar picks up where you left off
- ✅ **Works across restarts** - Can even reboot your computer

---

## 📁 Checkpoint File

**Location:** `backtest-checkpoint.json` (in project root)

**Contents:**
```json
{
  "lastProcessedIndex": 1234,
  "lastTimestamp": 1625486400000,
  "updatedAt": "2026-03-26T07:00:00.000Z"
}
```

- `lastProcessedIndex` - Last candle index processed (0-based)
- `lastTimestamp` - Timestamp of last processed candle
- `updatedAt` - When checkpoint was saved

---

## 🎯 How It Works

### Default Behavior (Auto-Resume)

```bash
# First run - starts from beginning
npm run backtest

# ... processing ... 
# [████████░░] 45.2% | Candles: 1200 | Signals: 23
# ... exits (crash, Ctrl+C, etc.)

# Second run - automatically resumes from candle 1200!
npm run backtest

# Output shows:
# 📌 Checkpoint loaded: Resume from index 1200
# [████████░░] 45.2% | Candles: 1200 | Signals: 23
# ... continues processing ...
```

### Fresh Start (Ignore Checkpoint)

```bash
# Start from beginning (ignore checkpoint)
npm run backtest -- --fresh

# Output shows:
# 🆕 Fresh start: Ignoring checkpoint
# [░░░░░░░░░░] 0.0% | Candles: 0 | Signals: 0
# ... starts from scratch ...
```

---

## 🔧 Common Scenarios

### 1. Backtest Exits Early (Crash, Error, Timeout)

**Problem:** Backtest stops at 45% due to network error

**Solution:** Just run it again!
```bash
npm run backtest
# Automatically resumes from 45%
```

### 2. Testing Different Symbol

**Problem:** You ran BTC backtest, now want to test ETH

**Solution:** Use `--fresh` flag
```bash
# BTC backtest (saved checkpoint)
npm run backtest

# Switch to ETH (fresh start)
npm run backtest -- --symbol=ETH/USDT --fresh
```

### 3. Changed Strategy Parameters

**Problem:** You modified `instructions/strategy.md`, want to re-test

**Solution:** Delete checkpoint or use `--fresh`
```bash
# Option 1: Delete checkpoint
rm backtest-checkpoint.json
npm run backtest

# Option 2: Use --fresh flag
npm run backtest -- --fresh
```

### 4. Want to Re-run Same Data

**Problem:** Backtest completed 100%, want to run again

**Solution:** Delete checkpoint AND database
```bash
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

### 5. Accidentally Interrupted Backtest

**Problem:** Hit Ctrl+C by mistake at 80%

**Solution:** Just run again (resumes at 80%)
```bash
npm run backtest
# No --fresh needed, continues from 80%
```

---

## 🚨 Important Notes

### When Checkpoint is Ignored

Checkpoint is automatically ignored in these cases:
- ❌ Using `--fresh` flag
- ❌ Checkpoint file doesn't exist
- ❌ Checkpoint file is corrupted

### When Checkpoint is Used

Checkpoint is automatically loaded in these cases:
- ✅ Running same command again
- ✅ Checkpoint file exists and is valid
- ✅ No `--fresh` flag specified

### Checkpoint vs Database

**Checkpoint file (`backtest-checkpoint.json`):**
- Tracks processing position
- Small file (~100 bytes)
- Can be deleted safely (just restarts from beginning)

**Database file (`backtest-results.db`):**
- Contains all signals and results
- Large file (can be MBs)
- Contains your valuable backtest data!

**Best practice:** Delete both when starting a new test cycle:
```bash
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

---

## 💡 Pro Tips

### 1. Long Backtests (12 months)
For long backtests (8+ hours), checkpoint is essential:
```bash
npm run backtest -- --months=12

# If it crashes after 6 hours, just run again:
npm run backtest -- --months=12
# Resumes where it left off!
```

### 2. Testing Multiple Strategies
Use different database files for each test:
```bash
# Test 1: Original strategy
npm run backtest -- --db-path=test1.db

# Test 2: Modified strategy (fresh start)
npm run backtest -- --db-path=test2.db --fresh

# Compare results
sqlite3 test1.db "SELECT COUNT(*), AVG(confidence) FROM backtest_signals"
sqlite3 test2.db "SELECT COUNT(*), AVG(confidence) FROM backtest_signals"
```

### 3. Incremental Testing
Test progressively longer periods:
```bash
# Test 1: 1 month (fast)
npm run download-data -- --months=1
npm run backtest

# Test 2: 3 months (medium) - use --fresh
npm run download-data -- --months=3
npm run backtest -- --fresh

# Test 3: 6 months (thorough) - use --fresh
npm run download-data -- --months=6
npm run backtest -- --fresh
```

### 4. Network-Resilient Backtesting
If your network is unstable (DeepSeek API calls might fail):
```bash
# Start backtest
npm run backtest

# If network fails at 60%, just run again when network is back:
npm run backtest
# Resumes from 60%, no duplicate API calls!
```

---

## 🔍 Troubleshooting

### "Checkpoint loaded but backtest starts from 0%"

**Cause:** Database was deleted but checkpoint still exists

**Fix:**
```bash
rm backtest-checkpoint.json
npm run backtest
```

### "Backtest seems stuck at same position"

**Cause:** Checkpoint saved but error occurred before next checkpoint

**Fix:**
```bash
npm run backtest -- --fresh
```

### "Want to see checkpoint contents"

**View checkpoint:**
```bash
# Windows PowerShell
Get-Content backtest-checkpoint.json | ConvertFrom-Json

# Or open in text editor
notepad backtest-checkpoint.json
```

### "Checkpoint from wrong symbol"

**Cause:** Ran BTC backtest, now running ETH but checkpoint is for BTC

**Fix:**
```bash
npm run backtest -- --symbol=ETH/USDT --fresh
```

---

## 📊 Checkpoint Workflow Examples

### Example 1: Complete Flow with Resume

```bash
# Start backtest (gets to 30%)
npm run backtest
# ... network error at 30% ...

# Resume from 30%
npm run backtest
# ... gets to 70% ...
# ... accidentally Ctrl+C ...

# Resume from 70%
npm run backtest
# ... completes to 100% ...

# Calculate P&L
npm run calculate-pnl

# Improve strategy
npm run improve-cycle

# Start fresh with improved strategy
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

### Example 2: Testing Multiple Symbols

```bash
# Test BTC
npm run download-data -- --symbol=BTC/USDT
npm run backtest -- --symbol=BTC/USDT
# Saves: backtest-checkpoint.json

# Test ETH (use --fresh to ignore BTC checkpoint)
npm run download-data -- --symbol=ETH/USDT
npm run backtest -- --symbol=ETH/USDT --fresh
# Overwrites checkpoint with ETH progress

# Test SOL (use --fresh)
npm run download-data -- --symbol=SOL/USDT
npm run backtest -- --symbol=SOL/USDT --fresh
```

### Example 3: Continuous Improvement Cycle

```bash
# Initial test
npm run backtest
npm run improve-cycle

# Round 2 (fresh start with new strategy)
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run improve-cycle

# Round 3 (fresh start)
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run improve-cycle

# ... keep improving until target win rate reached ...
```

---

## ✅ Best Practices

1. **Always delete both files when starting new test cycle:**
   ```bash
   rm backtest-results.db backtest-checkpoint.json
   npm run backtest
   ```

2. **Use --fresh when changing symbols:**
   ```bash
   npm run backtest -- --symbol=ETH/USDT --fresh
   ```

3. **Let backtest auto-resume when interrupted:**
   ```bash
   npm run backtest  # Just run again, no flags needed
   ```

4. **Check checkpoint status:**
   ```bash
   npm run check-progress  # Shows current progress
   ```

5. **Clean up after completion:**
   ```bash
   # After successful backtest and analysis
   rm backtest-checkpoint.json  # Safe to delete when done
   ```

---

## 🎉 Summary

- ✅ **Checkpoint saves automatically** every 50 candles
- ✅ **Auto-resume by default** - just run the command again
- ✅ **Use `--fresh` flag** to ignore checkpoint and start fresh
- ✅ **Delete checkpoint file** for complete fresh start
- ✅ **No duplicate AI calls** - saves time and money
- ✅ **Resilient to interruptions** - network errors, crashes, Ctrl+C

**The checkpoint system makes backtesting reliable and cost-effective!** 🚀
