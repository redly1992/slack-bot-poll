# 🔬 Backtesting & Strategy Optimization System

## 🎯 Objective

Use 1 year of historical BTC data to:
1. Test the current strategy
2. Record AI predictions vs actual results
3. Analyze what works and what doesn't
4. Improve `strategy.md` based on real data

---

## 📋 System Overview

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Data Collection                                │
├─────────────────────────────────────────────────────────┤
│ Download 1 year BTC/USDT historical data               │
│ Timeframes: 5m, 15m, 1h, 4h                            │
│ Save to: data/btc-5m.csv, data/btc-15m.csv, etc.      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: Backtesting Engine                            │
├─────────────────────────────────────────────────────────┤
│ Simulate continuous monitoring on historical data      │
│ Detect when 5m + 15m + 1h ALL align (BUY or SELL)     │
│ For each alignment → Ask AI for prediction             │
│ Record: signal, confidence, reasoning, context         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: P&L Calculation                               │
├─────────────────────────────────────────────────────────┤
│ For each signal, check price 24 hours later            │
│ Calculate profit/loss %                                 │
│ Record: win/loss, pnl_percent, exit_price              │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 4: Analysis & Insights                           │
├─────────────────────────────────────────────────────────┤
│ Overall statistics (win rate, avg profit/loss)         │
│ Pattern analysis (what indicators predicted best)      │
│ Confidence correlation (does high confidence = wins?)  │
│ Market condition analysis (bull/bear/sideways)         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 5: Strategy Improvement                          │
├─────────────────────────────────────────────────────────┤
│ Identify weak points in current strategy               │
│ Adjust indicator thresholds based on data              │
│ Update confidence scoring rules                        │
│ Add filters for low-probability setups                 │
│ Generate improved strategy.md                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🗂️ Data Structure

### Historical Data Files (CSV)
```
data/
├── btc-5m.csv   (365 days × 288 candles/day = ~105,120 rows)
├── btc-15m.csv  (365 days × 96 candles/day = ~35,040 rows)
├── btc-1h.csv   (365 days × 24 candles/day = ~8,760 rows)
└── btc-4h.csv   (365 days × 6 candles/day = ~2,190 rows)

Format: timestamp,open,high,low,close,volume
```

### Backtest Results Database (SQLite)
```sql
-- Signal records
CREATE TABLE backtest_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    date TEXT,
    pair TEXT,
    
    -- Timeframe indicators at signal time
    indicators_5m TEXT,  -- JSON: {rsi, ema, macd, etc.}
    indicators_15m TEXT,
    indicators_1h TEXT,
    signal_5m TEXT,      -- BUY/SELL/NEUTRAL
    signal_15m TEXT,
    signal_1h TEXT,
    alignment TEXT,      -- BUY/SELL
    
    -- AI prediction
    ai_signal TEXT,           -- LONG/SHORT
    ai_confidence INTEGER,    -- 0-100
    ai_reasoning TEXT,        -- JSON array
    ai_entry_reason TEXT,
    ai_stop_loss_reason TEXT,
    ai_risk_level TEXT,       -- LOW/MEDIUM/HIGH
    
    -- Entry data
    entry_price REAL,
    direction TEXT,           -- LONG/SHORT
    
    -- Exit data (filled 24h later)
    exit_timestamp INTEGER,
    exit_price REAL,
    pnl_percent REAL,
    pnl_usd REAL,             -- Based on $1000 position
    result TEXT,              -- WIN/LOSS
    
    -- Analysis
    market_condition TEXT,    -- BULL/BEAR/SIDEWAYS (based on 4h trend)
    was_correct BOOLEAN       -- Did AI prediction match result?
);

-- Summary statistics
CREATE TABLE backtest_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_signals INTEGER,
    total_wins INTEGER,
    total_losses INTEGER,
    win_rate REAL,
    avg_profit REAL,
    avg_loss REAL,
    total_pnl_percent REAL,
    total_pnl_usd REAL,
    best_trade_pnl REAL,
    worst_trade_pnl REAL,
    avg_confidence_win REAL,
    avg_confidence_loss REAL,
    generated_at TEXT
);
```

---

## 🛠️ Tools to Build

### 1. `download-historical-data.js`
```javascript
// Downloads 1 year of BTC data for all timeframes
// Saves to CSV files in data/ folder
// Usage: node download-historical-data.js
```

### 2. `backtest.js`
```javascript
// Main backtesting engine
// Reads historical data
// Simulates monitoring (step through time)
// Detects alignments
// Calls AI for predictions
// Records everything to database
// Usage: node backtest.js [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]
```

### 3. `calculate-pnl.js`
```javascript
// For each signal in database
// Check price 24h later
// Calculate profit/loss
// Update database with results
// Usage: node calculate-pnl.js
```

### 4. `analyze-results.js`
```javascript
// Generate comprehensive report
// Statistics, charts, insights
// Pattern analysis
// Usage: node analyze-results.js
```

### 5. `improve-strategy.js`
```javascript
// AI-assisted strategy improvement
// Analyzes backtest results
// Identifies patterns
// Suggests improvements
// Generates new strategy.md
// Usage: node improve-strategy.js
```

---

## 📊 Expected Results

### Example Signal Record:
```json
{
  "id": 1,
  "timestamp": 1672531200000,
  "date": "2023-01-01 00:00:00",
  "pair": "BTC/USDT",
  
  "indicators_5m": {"rsi": 35.2, "ema": {...}, "macd": {...}},
  "indicators_15m": {"rsi": 38.1, "ema": {...}, "macd": {...}},
  "indicators_1h": {"rsi": 42.3, "ema": {...}, "macd": {...}},
  
  "signal_5m": "BUY",
  "signal_15m": "BUY",
  "signal_1h": "BUY",
  "alignment": "BUY",
  
  "ai_signal": "LONG",
  "ai_confidence": 75,
  "ai_reasoning": ["Multi-timeframe alignment", "RSI oversold", ...],
  "ai_entry_reason": "Pullback in uptrend with oversold conditions",
  "ai_risk_level": "MEDIUM",
  
  "entry_price": 16500.00,
  "direction": "LONG",
  
  "exit_price": 16980.00,
  "pnl_percent": 2.91,
  "pnl_usd": 29.10,
  "result": "WIN",
  
  "market_condition": "BULL",
  "was_correct": true
}
```

### Example Summary Statistics:
```
📊 BACKTEST RESULTS (1 Year)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Signals:        342
Wins:                 234  (68.4%)
Losses:               108  (31.6%)

Average Profit:       +3.2%
Average Loss:         -1.8%
Total P&L:            +412.5% (on $1000 = $4,125)

Best Trade:           +15.3%
Worst Trade:          -5.2%

By Confidence Level:
  80-100%: 156 signals, 78.2% win rate ⭐
  70-79%:  98 signals,  65.3% win rate
  60-69%:  88 signals,  52.3% win rate

By Market Condition:
  BULL:     145 signals, 75.2% win rate ⭐
  BEAR:     102 signals, 58.8% win rate
  SIDEWAYS: 95 signals,  62.1% win rate

By Timeframe Strength:
  5/5 indicators: 45 signals, 82.2% win rate ⭐
  4/5 indicators: 134 signals, 71.6% win rate
  3/5 indicators: 163 signals, 60.7% win rate
```

---

## 🔍 Analysis Questions to Answer

### 1. **Confidence Accuracy**
- Does AI confidence correlate with success?
- What confidence threshold gives best results?
- Should we raise min confidence from 70%?

### 2. **Indicator Effectiveness**
- Which indicators predict best?
- Are any indicators misleading?
- Should we weight indicators differently?

### 3. **Market Conditions**
- Does strategy work better in bull/bear/sideways?
- Should we filter out certain market conditions?
- Do we need condition-specific rules?

### 4. **Timeframe Analysis**
- Is 4H trend important for success?
- Do we need tighter timeframe alignment?
- Should we add more timeframes?

### 5. **Entry Quality**
- What makes a good vs bad entry?
- Are pullbacks better than breakouts?
- Optimal RSI/Stochastic levels?

### 6. **Risk Management**
- Is 1.5x ATR stop loss optimal?
- Should stop loss vary by market condition?
- Better take profit strategies?

---

## 🎯 Expected Improvements to Strategy

Based on backtest results, we might discover:

### Finding 1: High confidence signals work best
```markdown
**Updated Rule:**
Minimum confidence: 75% (was 70%)
Confidence 80%+ = highest priority
```

### Finding 2: Bull markets have better win rate
```markdown
**New Filter:**
In BEAR markets, require 4/5 indicators (instead of 3/5)
In BULL markets, 3/5 is sufficient
```

### Finding 3: RSI + Bollinger combo is strongest
```markdown
**New Entry Criteria:**
For LONG: Require both RSI < 40 AND price < lower BB
For SHORT: Require both RSI > 60 AND price > upper BB
```

### Finding 4: Pullbacks outperform breakouts
```markdown
**Updated Strategy:**
Prefer counter-trend entries (pullbacks in trends)
Avoid chasing momentum (breakouts)
```

---

## ⚙️ Implementation Plan

### Phase 1: Data Collection (2-3 hours)
- [x] Create `download-historical-data.js`
- [ ] Download 1 year BTC data
- [ ] Validate data quality
- [ ] Save to CSV files

### Phase 2: Backtest Engine (4-6 hours)
- [ ] Create `backtest.js`
- [ ] Implement time simulation
- [ ] Add alignment detection
- [ ] Integrate AI analyzer
- [ ] Record signals to database

### Phase 3: P&L Calculation (1-2 hours)
- [ ] Create `calculate-pnl.js`
- [ ] Calculate 24h returns
- [ ] Update database with results

### Phase 4: Analysis (2-3 hours)
- [ ] Create `analyze-results.js`
- [ ] Generate statistics
- [ ] Create visualizations
- [ ] Identify patterns

### Phase 5: Strategy Improvement (3-4 hours)
- [ ] Review analysis results
- [ ] Identify weak points
- [ ] Update strategy.md
- [ ] Document changes

**Total Estimated Time: 12-18 hours**

---

## 💡 Key Benefits

1. **Data-Driven:** Decisions based on actual results, not assumptions
2. **Risk-Free:** Test with historical data before real money
3. **Optimization:** Find best parameters through iteration
4. **Confidence:** Know expected win rate before deploying
5. **Learning:** Understand what works and why

---

## 🚀 Next Steps

**Option 1: Start Now** (Recommended)
I can start building the system immediately. We'll build it step by step:
1. First: Data downloader
2. Then: Backtest engine  
3. Then: Analysis tools
4. Finally: Strategy improvements

**Option 2: Review Plan First**
Review this plan, ask questions, make adjustments, then proceed.

**Option 3: Partial Implementation**
Start with a smaller dataset (e.g., 3 months) to validate approach faster.

---

## 📝 Questions for You

Before I start building:

1. **Dataset size:** 1 year or start smaller (3-6 months)?
2. **Position size:** Simulate with $1000 per trade?
3. **Stop loss:** Use 1.5x ATR or fixed %?
4. **Take profit:** When to exit winners? (TP levels or trailing stop?)
5. **AI model:** Use DeepSeek for backtesting too? (will cost API fees)
6. **Output:** Text reports or also generate charts/graphs?

---

**Ready to build this system?** This will significantly improve your trading strategy! 🎯📊

Should I proceed with Phase 1 (Data Download)?
