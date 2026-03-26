# 📊 COMPLETE CYCLE WITH MORE DATA

## 🎯 Full Workflow: Adding More Data & Testing

---

## 🆕 NEW! CLI Arguments Support

You can now use clean CLI arguments instead of environment variables:

```bash
# Download with CLI arguments (RECOMMENDED)
npm run download-data -- --months=6
npm run download-data -- --symbol=ETH/USDT
npm run download-data -- --months=12 --symbol=SOL/USDT

# Old way with environment variables (still works)
BACKTEST_MONTHS=6 npm run download-data
```

**Benefits:**
- ✅ Cleaner syntax
- ✅ No need to export environment variables
- ✅ Arguments override environment variables
- ✅ Works on all platforms

**See help:**
```bash
npm run download-data -- --help
```

---

## 📥 OPTION 1: Download More Historical Data (Same Symbol)

### Download 6 Months Instead of 3 Months

```bash
# ══════════════════════════════════════════════
# Step 1: Download more BTC data (6 months)
# ══════════════════════════════════════════════

# NEW WAY (CLI Arguments - Recommended):
npm run download-data -- --months=6

# OLD WAY (Environment Variables - Still works):
BACKTEST_MONTHS=6 npm run download-data

# This will download:
# - 5m: ~52,000 candles
# - 15m: ~17,000 candles  
# - 1h: ~4,300 candles
# - 4h: ~1,100 candles
```

### Download 12 Months (Full Year)

```bash
# NEW WAY:
npm run download-data -- --months=12

# OLD WAY:
BACKTEST_MONTHS=12 npm run download-data

# This will download:
# - 5m: ~105,000 candles
# - 15m: ~35,000 candles
# - 1h: ~8,700 candles
# - 4h: ~2,200 candles
```

---

## 📥 OPTION 2: Download Different Trading Pairs

### Download ETH/USDT Data

```bash
# NEW WAY (CLI Arguments):
npm run download-data -- --symbol=ETH/USDT --months=3

# OLD WAY (Environment Variables):
BACKTEST_SYMBOL=ETH/USDT BACKTEST_MONTHS=3 npm run download-data

# Files created:
# - data/eth-usdt-5m.csv
# - data/eth-usdt-15m.csv
# - data/eth-usdt-1h.csv
# - data/eth-usdt-4h.csv
```

### Test Multiple Pairs

```bash
# Download BTC (3 months)
npm run download-data -- --symbol=BTC/USDT --months=3

# Download ETH (3 months)
npm run download-data -- --symbol=ETH/USDT --months=3

# Download SOL (3 months)
npm run download-data -- --symbol=SOL/USDT --months=3
```

---

## 🔄 COMPLETE CYCLE WITH MORE DATA

### Cycle 1: Initial Test (3 Months BTC)

```bash
# ══════════════════════════════════════════════
# PHASE 1: Initial Test
# ══════════════════════════════════════════════

# 1. Download data (already done)
npm run download-data

# 2. Run backtest
npm run backtest

# 3. Analyze & improve
npm run improve-cycle

# 4. Clean & re-test
rm backtest-results.db backtest-checkpoint.json
npm run backtest

# Results: 63.2% win rate, $309.60 profit
```

---

### Cycle 2: Add More Time (6 Months BTC)

```bash
# ══════════════════════════════════════════════
# PHASE 2: More Historical Data
# ══════════════════════════════════════════════

# 1. Download 6 months of data (overwrites 3 months)
BACKTEST_MONTHS=6 npm run download-data

# 2. Clear old results
rm backtest-results.db backtest-checkpoint.json

# 3. Run backtest with MORE data
npm run backtest
# Expected: 200-300 signals (vs 68 from 3 months)

# 4. When complete, analyze
npm run improve-cycle

# 5. Clean & test improved strategy
rm backtest-results.db backtest-checkpoint.json
npm run backtest

# Results: Better statistical significance with more data!
```

---

### Cycle 3: Test on Different Symbol (ETH)

```bash
# ══════════════════════════════════════════════
# PHASE 3: Validate on Different Asset
# ══════════════════════════════════════════════

# 1. Download ETH data
BACKTEST_SYMBOL=ETH/USDT BACKTEST_MONTHS=3 npm run download-data

# 2. Update backtest.js to use ETH
# Edit backtest.js line: this.symbol = 'ETH/USDT'
# OR set environment variable

# 3. Run backtest on ETH
rm backtest-results.db backtest-checkpoint.json
BACKTEST_SYMBOL=ETH/USDT npm run backtest

# 4. Analyze ETH results
npm run calculate-pnl
npm run analyze-results

# 5. Compare BTC vs ETH performance
# Does your strategy work on both?
```

---

### Cycle 4: Test Different Time Periods

```bash
# ══════════════════════════════════════════════
# PHASE 4: Time Period Validation
# ══════════════════════════════════════════════

# Test Q1 2025 (Jan-Mar)
# Already have this data

# Test Q2 2025 (Apr-Jun)
# Download different date range
# Edit download-historical-data.js to set custom dates

# Test Q3 2025 (Jul-Sep)
# Download different date range

# Compare results across quarters
# Does strategy work in different market conditions?
```

---

## 🎯 RECOMMENDED WORKFLOW

### Stage 1: Build Strong Strategy (3 months)

```bash
# Use 3 months of data
# Iterate quickly with improve-cycle
# Get win rate to 70%+

npm run download-data  # 3 months
npm run backtest
npm run improve-cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest
# Repeat until 70%+
```

### Stage 2: Validate with More Data (6 months)

```bash
# Test on 6 months to confirm strategy holds

BACKTEST_MONTHS=6 npm run download-data
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run calculate-pnl

# If win rate drops significantly:
# - Strategy might be overfitted to 3 months
# - Need to adjust based on 6-month data

npm run improve-cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

### Stage 3: Cross-Asset Validation (ETH, SOL, etc.)

```bash
# Test if strategy works on other coins

BACKTEST_SYMBOL=ETH/USDT npm run download-data
rm backtest-results.db backtest-checkpoint.json
# Edit backtest.js or set BACKTEST_SYMBOL
npm run backtest
npm run calculate-pnl

# If works on multiple assets:
# - Strategy is robust
# - Can trade multiple pairs

# If fails on other assets:
# - Strategy is BTC-specific
# - Need separate strategies per asset
```

### Stage 4: Live Testing (Continuous Monitor)

```bash
# Once backtest win rate is 70%+
# Deploy to live monitoring

npm run monitor

# Let it run for 1-2 weeks
# Compare live results vs backtest
# Adjust if needed
```

---

## 📊 DATA MANAGEMENT

### Check Current Data

```bash
# See what data you have
ls -lh data/*.csv

# Example output:
# btc-usdt-5m.csv   (2.04 MB - 3 months)
# btc-usdt-15m.csv  (0.68 MB - 3 months)
# btc-usdt-1h.csv   (0.17 MB - 3 months)
# btc-usdt-4h.csv   (0.04 MB - 3 months)
```

### Backup Data

```bash
# Before downloading new data, backup old
mkdir data-backup-3months
cp data/*.csv data-backup-3months/

# Download new data (overwrites old)
BACKTEST_MONTHS=6 npm run download-data

# If needed, restore old data
cp data-backup-3months/*.csv data/
```

---

## 💡 TESTING STRATEGIES

### Strategy A: Quick Iteration (3 months)

```bash
# Pros: Fast, cheap API calls, quick results
# Cons: Smaller dataset, might overfit

npm run download-data  # 3 months default
npm run backtest       # ~150-200 signals
npm run improve-cycle  # Quick feedback
```

### Strategy B: Robust Testing (6 months)

```bash
# Pros: More signals, better statistics
# Cons: Takes longer, more API calls

BACKTEST_MONTHS=6 npm run download-data
npm run backtest  # ~300-400 signals
npm run improve-cycle
```

### Strategy C: Conservative (12 months)

```bash
# Pros: Most comprehensive, tests all market conditions
# Cons: Very slow (6-8 hours), expensive API calls

BACKTEST_MONTHS=12 npm run download-data
npm run backtest  # ~600-800 signals
npm run improve-cycle
```

---

## 🔥 POWER WORKFLOW (RECOMMENDED)

```bash
# ══════════════════════════════════════════════
# ITERATION LOOP (Run 5-10 times)
# ══════════════════════════════════════════════

# 1. Start with 3 months for quick iteration
npm run download-data

# 2. Improve until 70%+ win rate
npm run backtest
npm run improve-cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest
# Repeat until satisfied

# 3. Validate with 6 months
BACKTEST_MONTHS=6 npm run download-data
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run calculate-pnl

# 4. If still good, test on ETH
BACKTEST_SYMBOL=ETH/USDT BACKTEST_MONTHS=3 npm run download-data
# Edit backtest.js or set env var
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run calculate-pnl

# 5. Deploy live!
npm run monitor
```

---

## 📈 EXPECTED RESULTS BY DATA SIZE

| Data Size | Signals | Time | Win Rate Target | Confidence |
|-----------|---------|------|-----------------|------------|
| 3 months | ~150-200 | 2-3h | 65-70% | Medium |
| 6 months | ~300-400 | 4-6h | 70-75% | High |
| 12 months | ~600-800 | 8-12h | 75%+ | Very High |

**More data = More confidence in results!**

---

## ⚡ QUICK REFERENCE CHEAT SHEET

```bash
# Download more data
BACKTEST_MONTHS=6 npm run download-data

# Download different symbol
BACKTEST_SYMBOL=ETH/USDT npm run download-data

# Full cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run improve-cycle

# Check progress anytime
npm run check-progress

# Compare results
npm run calculate-pnl
npm run analyze-results
```

---

## 🎯 YOUR NEXT STEPS

1. **Now:** Let current backtest finish (68 signals, 63.2% win rate)

2. **Then:** Choose your path:
   - **Path A:** Keep iterating with 3 months until 70%+
   - **Path B:** Download 6 months and get more data now
   - **Path C:** Test on ETH to validate strategy

3. **Finally:** Deploy to live monitoring when confident!

```bash
# Path A (Recommended for now)
npm run improve-cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest

# Path B (If want more data)
BACKTEST_MONTHS=6 npm run download-data
rm backtest-results.db backtest-checkpoint.json
npm run backtest

# Path C (Validate on ETH)
BACKTEST_SYMBOL=ETH/USDT npm run download-data
# Edit backtest.js: symbol = 'ETH/USDT'
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

**You're at 63.2% win rate! Keep going! 🚀**
