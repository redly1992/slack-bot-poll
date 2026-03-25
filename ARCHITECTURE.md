# 🔗 Relationship: aiAnalyzer.js ↔ predict-price.js

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    predict-price.js                         │
│                   (MAIN ORCHESTRATOR)                       │
│                                                             │
│  1. Fetches market data (OHLCV, indicators)                │
│  2. Calculates technical indicators                        │
│  3. Gets 4H + Daily trend context                          │
│  4. Calls aiAnalyzer to get trading signal                 │
│  5. Formats and displays results                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Uses
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                   aiAnalyzer.js                             │
│                    (AI BRAIN)                               │
│                                                             │
│  1. Receives market data + indicators                      │
│  2. Builds analysis prompt                                 │
│  3. Sends to AI (DeepSeek/Gemini/OpenAI)                  │
│  4. Returns LONG or SHORT signal                           │
│  5. Provides reasoning and analysis                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### Step-by-Step Interaction

```
┌──────────────┐
│ USER RUNS    │
│ npm run      │
│ predict      │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│ predict-price.js (PricePredictionTool class)                 │
└──────────────────────────────────────────────────────────────┘
       │
       │ Step 1: Initialize
       ├────────────────────────────────────────────────┐
       │                                                │
       │  new AIAnalyzer({                             │
       │    provider: 'deepseek',                      │
       │    apiKey: process.env.DEEPSEEK_API_KEY,      │
       │    model: 'deepseek-chat'                     │
       │  })                                            │
       └────────────────────────────────────────────────┘
       │
       │ Step 2: Fetch Market Data
       ├────────────────────────────────────────────────┐
       │                                                │
       │  • Get 4H OHLCV data (60 candles)             │
       │  • Get Daily OHLCV data (60 candles)          │
       │  • Get 15m OHLCV data (100 candles)           │
       │  • Calculate indicators (RSI, EMA, etc.)      │
       │  • Calculate ATR for stop loss                │
       └────────────────────────────────────────────────┘
       │
       │ Step 3: Prepare Context
       ├────────────────────────────────────────────────┐
       │                                                │
       │  const config = {                             │
       │    _strategyContent: strategy.md,             │
       │    _trendContext: {                           │
       │      h4: { trend: 'BULLISH', ema21, ema50 },  │
       │      daily: { trend: 'BULLISH', ema21 }       │
       │    },                                          │
       │    timeframe: '15m'                           │
       │  }                                             │
       └────────────────────────────────────────────────┘
       │
       │ Step 4: Call AI Analyzer
       ↓
┌──────────────────────────────────────────────────────────────┐
│ aiAnalyzer.analyzeMarket(pair, indicators, ohlcv, config)    │
└──────────────────────────────────────────────────────────────┘
       │
       │ Inside aiAnalyzer.js:
       ├────────────────────────────────────────────────┐
       │                                                │
       │  a) buildAnalysisPrompt()                     │
       │     - Combines strategy.md content            │
       │     - Adds 4H trend context                   │
       │     - Adds current indicators                 │
       │     - Adds trading rules                      │
       │                                                │
       │  b) Send to AI Provider                       │
       │     - DeepSeek: analyzeWithOpenAI()           │
       │     - Gemini: analyzeWithGemini()             │
       │                                                │
       │  c) AI Returns JSON:                          │
       │     {                                          │
       │       signal: "LONG" or "SHORT",              │
       │       confidence: 75,                         │
       │       entryReason: "...",                     │
       │       reasoning: [...],                       │
       │       stopLossReason: "..."                   │
       │     }                                          │
       └────────────────────────────────────────────────┘
       │
       │ Step 5: Return to predict-price.js
       ↓
┌──────────────────────────────────────────────────────────────┐
│ predict-price.js receives aiAnalysis                         │
└──────────────────────────────────────────────────────────────┘
       │
       │ Step 6: Process Results
       ├────────────────────────────────────────────────┐
       │                                                │
       │  • Normalize signal (LONG/SHORT)              │
       │  • Calculate entry price                      │
       │  • Calculate stop loss (using ATR)            │
       │  • Calculate take profits (TP1, TP2, TP3)     │
       │  • Format output with reasoning               │
       └────────────────────────────────────────────────┘
       │
       │ Step 7: Display to User
       ↓
┌──────────────────────────────────────────────────────────────┐
│ Console Output:                                              │
│                                                              │
│ 📌 Trading Pair:  BTC/USDT                                  │
│ 🎯 Position:      🟢 LONG                                   │
│ 💰 Entry Price:   $67,234.50                                │
│ 🛑 Stop Loss:     $66,890.20                                │
│ 💡 Entry Reason:  [from AI]                                 │
│ 🛑 Stop Loss Reasoning: [from AI]                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 💻 Code Relationship

### predict-price.js (USES aiAnalyzer)

```javascript
class PricePredictionTool {
  constructor() {
    // CREATES an instance of AIAnalyzer
    this.aiAnalyzer = new AIAnalyzer({
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat'
    });
  }
  
  async predictPair(pair) {
    // 1. Get market data
    const ohlcv = await this.marketData.fetchOHLCV(pair, '15m', 100);
    const indicators = IndicatorCalculator.calculateAll(ohlcv);
    const trendContext = await this.getHigherTimeframeTrend(pair);
    
    // 2. Prepare config with strategy and trend
    const config = {
      _strategyContent: this.parser.getStrategyContent(),
      _trendContext: trendContext,
      timeframe: '15m'
    };
    
    // 3. CALLS aiAnalyzer to get signal
    const aiAnalysis = await this.aiAnalyzer.analyzeMarket(
      pair,
      indicators,
      ohlcv,
      config
    );
    
    // 4. Process AI response
    let signal = aiAnalysis.signal; // LONG or SHORT
    let entry = indicators.price;
    let stopLoss = calculateStopLoss(entry, atr, signal);
    
    // 5. Display results
    console.log(`Position: ${signal}`);
    console.log(`Entry Reason: ${aiAnalysis.entryReason}`);
    console.log(`Stop Loss Reason: ${aiAnalysis.stopLossReason}`);
  }
}
```

### aiAnalyzer.js (PROVIDES analysis)

```javascript
class AIAnalyzer {
  constructor(config) {
    this.provider = config.provider; // 'deepseek'
    this.client = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com'
    });
  }
  
  // MAIN METHOD called by predict-price.js
  async analyzeMarket(symbol, indicators, ohlcv, config) {
    // 1. Build comprehensive prompt
    const prompt = this.buildAnalysisPrompt(
      symbol,
      indicators,
      ohlcv,
      config
    );
    
    // 2. Send to AI
    const analysis = await this.analyzeWithOpenAI(prompt);
    
    // 3. RETURNS structured response
    return {
      signal: analysis.signal,           // LONG or SHORT
      confidence: analysis.confidence,    // 0-100
      entryReason: analysis.entryReason, // Why this entry
      stopLossReason: analysis.stopLossReason, // Why this SL
      reasoning: analysis.reasoning,
      marketAnalysis: analysis.marketAnalysis,
      riskLevel: analysis.riskLevel
    };
  }
  
  buildAnalysisPrompt(symbol, indicators, ohlcv, config) {
    let prompt = '';
    
    // Add strategy.md content
    if (config._strategyContent) {
      prompt += config._strategyContent + '\n\n';
    }
    
    // Add 4H trend context
    if (config._trendContext) {
      prompt += `4H Trend: ${config._trendContext.h4.trend}\n`;
      prompt += `Daily Trend: ${config._trendContext.daily.trend}\n`;
      prompt += `YOU MUST CHOOSE LONG OR SHORT\n\n`;
    }
    
    // Add current market data
    prompt += `Price: $${indicators.price}\n`;
    prompt += `RSI: ${indicators.rsi}\n`;
    prompt += `EMA: ${indicators.ema.fast} / ${indicators.ema.slow}\n`;
    
    // Add response format requirement
    prompt += `Return JSON: { signal: "LONG"|"SHORT", ... }`;
    
    return prompt;
  }
  
  async analyzeWithOpenAI(prompt) {
    // Sends prompt to DeepSeek API
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You must return LONG or SHORT...' },
        { role: 'user', content: prompt }
      ]
    });
    
    return JSON.parse(response.choices[0].message.content);
  }
}
```

---

## 📦 Responsibilities

### predict-price.js (Orchestrator)
**Job:** Run the prediction process

**Responsibilities:**
- ✅ Initialize components (AI, market data, indicators)
- ✅ Fetch OHLCV data (4H, Daily, 15m)
- ✅ Calculate technical indicators (RSI, EMA, MACD, etc.)
- ✅ Determine trend context (4H + Daily)
- ✅ Call AI analyzer with all data
- ✅ Process AI response
- ✅ Calculate stop loss and take profits (ATR-based)
- ✅ Format and display output
- ✅ Handle multiple pairs

**Does NOT:**
- ❌ Talk to AI directly
- ❌ Build AI prompts
- ❌ Make trading decisions

### aiAnalyzer.js (AI Brain)
**Job:** Analyze data and provide trading signals

**Responsibilities:**
- ✅ Build comprehensive AI prompts
- ✅ Include strategy.md guidance
- ✅ Add 4H trend context
- ✅ Add current market indicators
- ✅ Communicate with AI provider (DeepSeek/Gemini/OpenAI)
- ✅ Parse AI response
- ✅ Return structured analysis

**Does NOT:**
- ❌ Fetch market data
- ❌ Calculate indicators
- ❌ Calculate stop loss (numeric)
- ❌ Display output
- ❌ Make final decisions

---

## 🎯 Who Does What?

| Task | predict-price.js | aiAnalyzer.js |
|------|------------------|---------------|
| Fetch OHLCV data | ✅ | ❌ |
| Calculate RSI, EMA, MACD | ✅ | ❌ |
| Determine 4H trend | ✅ | ❌ |
| Build AI prompt | ❌ | ✅ |
| Talk to DeepSeek API | ❌ | ✅ |
| Parse AI response | ❌ | ✅ |
| Decide LONG/SHORT | ❌ | ✅ (via AI) |
| Calculate ATR stop loss | ✅ | ❌ |
| Calculate take profits | ✅ | ❌ |
| Display output | ✅ | ❌ |

---

## 🔄 Analogy

Think of it like a **restaurant**:

### predict-price.js = **Head Chef**
- Gathers all ingredients (market data)
- Prepares ingredients (calculates indicators)
- Knows what to cook (prediction flow)
- Asks specialist for advice
- Plates the final dish (displays results)

### aiAnalyzer.js = **Specialist Consultant**
- Expert in one thing: analyzing market conditions
- Gets ingredients from head chef
- Provides expert opinion (LONG or SHORT)
- Explains reasoning
- Returns advice to head chef

---

## 📝 Example Flow

```javascript
// 1. User runs: npm run predict

// 2. predict-price.js starts
const predictor = new PricePredictionTool();
  // └─> Creates: this.aiAnalyzer = new AIAnalyzer()

// 3. For BTC/USDT:
predictor.predictPair('BTC/USDT');
  // ├─> Fetches 4H data → trend: BULLISH
  // ├─> Fetches 15m data → 100 candles
  // ├─> Calculates indicators → RSI: 45, EMA: 67,100/66,890
  // └─> Builds config with strategy + trend

// 4. Calls AI analyzer
const aiAnalysis = await this.aiAnalyzer.analyzeMarket(
  'BTC/USDT',
  { price: 67234, rsi: 45, ema: {...} },
  ohlcv,
  { _trendContext: {...}, _strategyContent: '...' }
);

// 5. Inside aiAnalyzer.js:
  // ├─> Builds prompt: "4H is BULLISH, RSI 45, EMA bullish..."
  // ├─> Sends to DeepSeek
  // └─> DeepSeek returns: { signal: "LONG", entryReason: "..." }

// 6. Back in predict-price.js:
  // ├─> Gets signal: LONG
  // ├─> Calculates SL: $66,890 (1.5x ATR below entry)
  // ├─> Calculates TP1, TP2, TP3
  // └─> Displays formatted output

// 7. User sees:
  // 🎯 Position: LONG
  // 💰 Entry: $67,234
  // 🛑 Stop Loss: $66,890
  // 💡 Entry Reason: [from AI]
```

---

## 🎓 Summary

**Simple Explanation:**

1. **predict-price.js** = Main program
   - Gets market data
   - Calls AI for analysis
   - Shows results

2. **aiAnalyzer.js** = AI helper
   - Talks to DeepSeek/Gemini/OpenAI
   - Analyzes market conditions
   - Returns LONG or SHORT

**Relationship:**
```
predict-price.js  →  uses  →  aiAnalyzer.js  →  uses  →  DeepSeek API
     (Boss)                      (Helper)                  (Brain)
```

**Data Flow:**
```
Market Data  →  predict-price.js  →  aiAnalyzer.js  →  AI  →  Response
                      ↓                                         ↓
                Display ←─────────────────────────────────────┘
```

That's the relationship! 🎯
