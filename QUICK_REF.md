# ⚡ SUPER QUICK REFERENCE

## 🎯 ALL COMMANDS NOW SUPPORT CLI ARGUMENTS!

### Quick Syntax
```bash
# Download data
npm run download-data -- --months=6 --symbol=ETH/USDT

# Run backtest
npm run backtest -- --symbol=ETH/USDT

# Calculate P/L
npm run calculate-pnl -- --symbol=ETH/USDT

# Get help for any command
npm run download-data -- --help
npm run backtest -- --help
npm run calculate-pnl -- --help
```

---

## 🔄 THE BASIC CYCLE (3 Months Data)

```bash
# 1. Improve strategy automatically
npm run improve-cycle

# 2. Clean database
rm backtest-results.db backtest-checkpoint.json
id
# 3. Test new strategy
npm run backtest

# 4. Repeat!
```

---

## 📥 DOWNLOAD DATA (NEW! CLI Arguments Support)

### Quick Downloads
```bash
# Default: 3 months BTC/USDT
npm run download-data

# 6 months of data
npm run download-data -- --months=6

# 12 months (full year)
npm run download-data -- --months=12

# Different symbol
npm run download-data -- --symbol=ETH/USDT

# Multiple options
npm run download-data -- --months=6 --symbol=SOL/USDT

# Show help
npm run download-data -- --help
```

### Environment Variables (Still Supported)
```bash
# Old way still works
BACKTEST_MONTHS=6 npm run download-data
BACKTEST_SYMBOL=ETH/USDT npm run download-data
```

**Note:** CLI arguments override environment variables!

---

## 🧪 RUN BACKTEST (NEW! Symbol Selection)

```bash
# Default BTC/USDT
npm run backtest

# Test ETH/USDT
npm run backtest -- --symbol=ETH/USDT

# Test SOL/USDT
npm run backtest -- --symbol=SOL/USDT

# Custom position size
npm run backtest -- --symbol=ETH/USDT --position-size=500

# Show help
npm run backtest -- --help
```

---

## 💰 CALCULATE P/L (NEW! Symbol Selection)

```bash
# Calculate for default symbol
npm run calculate-pnl

# Calculate for ETH
npm run calculate-pnl -- --symbol=ETH/USDT

# Show help
npm run calculate-pnl -- --help
```

---

## 📥 ADD MORE DATA CYCLE (6 Months)

```bash
# 1. Download 6 months of data (NEW SYNTAX!)
npm run download-data -- --months=6

# 2. Clear old results
rm backtest-results.db backtest-checkpoint.json

# 3. Run full backtest
npm run backtest

# 4. Analyze & improve
npm run improve-cycle

# 5. Clean & re-test
rm backtest-results.db backtest-checkpoint.json
npm run backtest

# 6. Repeat cycle from step 4
```

---

## 🔄 TEST DIFFERENT SYMBOL (ETH)

```bash
# 1. Download ETH data (NEW SYNTAX!)
npm run download-data -- --symbol=ETH/USDT --months=3

# 2. Clear old results
rm backtest-results.db backtest-checkpoint.json

# 3. Run backtest on ETH (NEW SYNTAX!)
npm run backtest -- --symbol=ETH/USDT

# 4. Calculate P/L for ETH (NEW SYNTAX!)
npm run calculate-pnl -- --symbol=ETH/USDT

# 5. Analyze results
npm run analyze-results
```

---

## 📊 DATA SIZE OPTIONS

| Command | Data | Signals | Time |
|---------|------|---------|------|
| `npm run download-data` | 3 mo | ~150-200 | 2-3h |
| `npm run download-data -- --months=6` | 6 mo | ~300-400 | 4-6h |
| `npm run download-data -- --months=12` | 12 mo | ~600-800 | 8-12h |

---

## ⚡ ULTRA-FAST COMMANDS

```bash
# Check progress
npm run check-progress

# Improve strategy
npm run improve-cycle

# Clean & test
rm backtest-results.db backtest-checkpoint.json && npm run backtest

# Get more data (NEW SYNTAX!)
npm run download-data -- --months=6

# Test ETH (NEW SYNTAX!)
npm run download-data -- --symbol=ETH/USDT
npm run backtest -- --symbol=ETH/USDT
npm run calculate-pnl -- --symbol=ETH/USDT
```

---

## 🎯 YOUR CURRENT STATUS

**You have:**
- ✅ 3 months BTC/USDT data
- ✅ 68 signals analyzed
- ✅ 63.2% win rate (+8.7% from baseline!)
- ✅ $309.60 total profit
- ✅ Strategy auto-improved

**Next step:**
```bash
# Option A: Keep improving with current data
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run improve-cycle

# Option B: Get more data for better results
BACKTEST_MONTHS=6 npm run download-data
rm backtest-results.db backtest-checkpoint.json
npm run backtest
```

---

## 🚀 RECOMMENDED PATH

### Week 1: Rapid Iteration (3 months)
```bash
npm run improve-cycle
rm backtest-results.db backtest-checkpoint.json
npm run backtest
# Repeat 5-10 times until 70%+ win rate
```

### Week 2: Validation (6 months)
```bash
BACKTEST_MONTHS=6 npm run download-data
rm backtest-results.db backtest-checkpoint.json
npm run backtest
npm run calculate-pnl
# Confirm strategy holds with more data
```

### Week 3: Cross-Asset (ETH, SOL)
```bash
BACKTEST_SYMBOL=ETH/USDT npm run download-data
# Edit backtest.js symbol
rm backtest-results.db backtest-checkpoint.json
npm run backtest
# See if strategy works on other coins
```

### Week 4: Live Deploy
```bash
npm run monitor
# Let it run and compare live vs backtest results
```

---

## 💾 BACKUP YOUR WORK

```bash
# Before downloading new data
mkdir data-backup-$(date +%Y%m%d)
cp data/*.csv data-backup-*/

# Before big changes
cp instructions/strategy.md instructions/strategy-$(date +%Y%m%d).md
```

---

**You're at 63.2% win rate. Target: 70%+. Keep going! 🚀**
