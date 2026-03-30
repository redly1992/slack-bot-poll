const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor(config) {
    this.provider = config.provider || 'openai'; // 'openai', 'gemini', or 'deepseek'
    this.model = config.model;
    
    if (this.provider === 'openai') {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      this.client = new OpenAI({ apiKey: config.apiKey });
      this.model = this.model || 'gpt-4o-mini';
      console.log(`✅ AI Analyzer initialized (OpenAI ${this.model})`);
      
    } else if (this.provider === 'deepseek') {
      if (!config.apiKey) {
        throw new Error('DeepSeek API key is required');
      }
      this.client = new OpenAI({ 
        apiKey: config.apiKey,
        baseURL: 'https://api.deepseek.com'
      });
      this.model = this.model || 'deepseek-chat';
      console.log(`✅ AI Analyzer initialized (DeepSeek ${this.model})`);
      
    } else if (this.provider === 'gemini') {
      if (!config.apiKey) {
        throw new Error('Gemini API key is required');
      }
      this.client = new GoogleGenerativeAI(config.apiKey);
      this.model = this.model || 'gemini-1.5-flash';
      console.log(`✅ AI Analyzer initialized (Gemini ${this.model})`);
      
    } else {
      throw new Error(`Unknown AI provider: ${this.provider}. Use 'openai', 'deepseek', or 'gemini'`);
    }
  }

  /**
   * Analyze market data with AI and generate trading insights
   * @param {string} symbol - Trading pair
   * @param {Object} indicators - Calculated technical indicators
   * @param {Array} ohlcv - Recent OHLCV data
   * @param {Object} strategyInstructions - Strategy from instruction file
   * @returns {Promise<Object>} AI analysis results
   */
  async analyzeMarket(symbol, indicators, ohlcv, strategyInstructions) {
    try {
      const prompt = this.buildAnalysisPrompt(symbol, indicators, ohlcv, strategyInstructions);
      
      let analysis;
      if (this.provider === 'openai' || this.provider === 'deepseek') {
        analysis = await this.analyzeWithOpenAI(prompt);
      } else if (this.provider === 'gemini') {
        analysis = await this.analyzeWithGemini(prompt);
      }
      
      return {
        signal: analysis.signal,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning || [],
        marketAnalysis: analysis.marketAnalysis || '',
        riskLevel: analysis.riskLevel || 'MEDIUM',
        stopLoss: analysis.stopLoss || null,
        takeProfit: analysis.takeProfit || null,
        stopLossReason: analysis.stopLossReason || '',
        entryReason: analysis.entryReason || '',
        rawResponse: analysis._rawResponse || null,
        parseError: analysis._parseError || null,
        model: this.model,
        provider: this.provider,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[AI] Analysis error: ${error.message}`);
      return {
        signal: 'HOLD',
        confidence: 0,
        reasoning: ['AI analysis failed, defaulting to HOLD'],
        marketAnalysis: `Error: ${error.message}`,
        riskLevel: 'HIGH',
        error: true
      };
    }
  }

  /**
   * Analyze with OpenAI
   */
  async analyzeWithOpenAI(prompt) {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert cryptocurrency trader specializing in directional trading. You analyze 4H timeframe to determine market direction, then use lower timeframes to find optimal entry points.

CRITICAL RULES:
1. You MUST always provide either LONG or SHORT - never HOLD or neutral
2. Use 4H timeframe as primary direction indicator
3. Use entry timeframe (15m) to find precise entry points within that direction
4. Consider entry quality: pullbacks in uptrends (LONG) or rallies in downtrends (SHORT)
5. Provide specific stop loss reasoning based on market structure

Your response must be valid JSON with this structure:
{
  "signal": "LONG" | "SHORT",
  "confidence": number (0-100),
  "entryReason": "why this is a good entry point",
  "reasoning": ["direction reason", "entry timing", "setup quality"],
  "marketAnalysis": "brief 4H direction + entry analysis",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "stopLoss": number (exact price level for stop loss),
  "takeProfit": number (exact price level for take profit),
  "stopLossReason": "where and why to place stop loss"
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const rawText = response.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      return { _rawResponse: rawText, _parseError: e.message, signal: 'HOLD', confidence: 0, reasoning: ['JSON parse failed'] };
    }
    parsed._rawResponse = rawText;
    return parsed;
  }

  /**
   * Analyze with Gemini
   */
  async analyzeWithGemini(prompt) {
    const model = this.client.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    });

    const systemPrompt = `You are an expert cryptocurrency trader specializing in directional trading. You analyze 4H timeframe to determine market direction, then use lower timeframes to find optimal entry points.

CRITICAL RULES:
1. You MUST always provide either LONG or SHORT - never HOLD or neutral
2. Use 4H timeframe as primary direction indicator
3. Use entry timeframe (15m) to find precise entry points within that direction
4. Consider entry quality: pullbacks in uptrends (LONG) or rallies in downtrends (SHORT)
5. Provide specific stop loss reasoning based on market structure

Your response must be valid JSON with this structure:
{
  "signal": "LONG" | "SHORT",
  "confidence": number (0-100),
  "entryReason": "why this is a good entry point",
  "reasoning": ["direction reason", "entry timing", "setup quality"],
  "marketAnalysis": "brief 4H direction + entry analysis",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "stopLoss": number (exact price level for stop loss),
  "takeProfit": number (exact price level for take profit),
  "stopLossReason": "where and why to place stop loss"
}`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    
    let rawText = '';
    try {
      const result = await model.generateContent(fullPrompt);
      rawText = result.response.text();
      const parsed = JSON.parse(rawText);
      parsed._rawResponse = rawText;
      return parsed;
    } catch (error) {
      // If JSON parsing fails or model not found, try gemini-2.5-flash as fallback
      if (error.message.includes('not found') || error.message.includes('404')) {
        console.log(`  ⚠️  Model ${this.model} not available, trying gemini-2.5-flash...`);
        const fallbackModel = this.client.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          }
        });
        const fallbackResult = await fallbackModel.generateContent(fullPrompt);
        const fallbackText = fallbackResult.response.text();
        const fallbackParsed = JSON.parse(fallbackText);
        fallbackParsed._rawResponse = fallbackText;
        return fallbackParsed;
      }
      // JSON parse failed — return raw text with error marker
      return { _rawResponse: rawText, _parseError: error.message, signal: 'HOLD', confidence: 0, reasoning: ['JSON parse failed'] };
    }
  }

  buildAnalysisPrompt(symbol, indicators, ohlcv, config) {
    const recentCandles = ohlcv.slice(-10);
    const priceChange = ((indicators.price - ohlcv[0].close) / ohlcv[0].close * 100).toFixed(2);

    // --- System persona from strategy.md ---
    let prompt = '';
    if (config._strategyContent) {
      prompt += config._strategyContent + '\n\n';
      prompt += '---\n\n';
    }

    // --- Higher timeframe trend context (4H is primary) ---
    if (config._trendContext) {
      const { daily, h4, overallTrend } = config._trendContext;
      prompt += `=== 4H TIMEFRAME ANALYSIS (PRIMARY DIRECTION) ===\n`;
      prompt += `4H Trend: ${h4.trend}`;
      if (h4.ema21) prompt += ` | EMA21: ${h4.ema21.toFixed(2)} | EMA50: ${h4.ema50?.toFixed(2)}`;
      if (h4.price) prompt += ` | Price: ${h4.price.toFixed(2)}`;
      prompt += `\n\n`;
      
      prompt += `Daily (1D) Confirmation: ${daily.trend}`;
      if (daily.ema21) prompt += ` | EMA21: ${daily.ema21.toFixed(2)}`;
      prompt += `\n\n`;
      
      prompt += `=== TRADING RULES (MANDATORY) ===\n`;
      prompt += `1. PRIMARY DIRECTION: Use 4H trend as the main directional bias\n`;
      prompt += `2. POSITION REQUIREMENT: You MUST choose either LONG or SHORT - NO HOLD/NEUTRAL allowed\n`;
      prompt += `3. IF 4H is BULLISH → Signal MUST be LONG\n`;
      prompt += `4. IF 4H is BEARISH → Signal MUST be SHORT\n`;
      prompt += `5. IF 4H is NEUTRAL/MIXED → Use Daily trend or technical indicators to decide, but still MUST give LONG or SHORT\n`;
      prompt += `6. ENTRY TIMING: Use the entry timeframe (15m) indicators to find the best entry point within the 4H direction\n`;
      prompt += `7. NEVER give HOLD - always take a position\n\n`;
    }

    // --- Live market data ---
    prompt += `=== CURRENT MARKET DATA: ${symbol} (${config.timeframe || '15m'} entry timeframe) ===\n`;
    prompt += `Price: $${indicators.price.toFixed(2)}\n`;
    prompt += `Price Change: ${priceChange}% over ${ohlcv.length} candles\n\n`;

    prompt += `=== TECHNICAL INDICATORS ===\n`;
    if (indicators.rsi !== undefined) {
      prompt += `RSI(14): ${indicators.rsi.toFixed(2)}`;
      if (indicators.rsi < 30) prompt += ` → Oversold`;
      else if (indicators.rsi > 70) prompt += ` → Overbought`;
      else prompt += ` → Neutral`;
      prompt += '\n';
    }
    if (indicators.ema) {
      const emaTrend = indicators.ema.fast > indicators.ema.slow ? 'Bullish' : 'Bearish';
      prompt += `EMA Fast/Slow: ${indicators.ema.fast.toFixed(2)} / ${indicators.ema.slow.toFixed(2)} → ${emaTrend}\n`;
    }

    // EMA200 macro trend (gold standard filter)
    if (indicators.ema200) {
      prompt += `EMA200: ${indicators.ema200.ema200.toFixed(2)} | Macro trend: ${indicators.ema200.trend} (price ${indicators.ema200.distance}% from EMA200)\n`;
    }

    if (indicators.macd) {
      const macdCross = indicators.macd.macd > indicators.macd.signal ? 'MACD above signal (bullish)' : 'MACD below signal (bearish)';
      prompt += `MACD: ${indicators.macd.macd.toFixed(2)} | Signal: ${indicators.macd.signal.toFixed(2)} | Histogram: ${indicators.macd.histogram.toFixed(2)} → ${macdCross}\n`;
    }
    if (indicators.bollinger) {
      prompt += `Bollinger Bands: Lower ${indicators.bollinger.lower.toFixed(2)} | Middle ${indicators.bollinger.middle.toFixed(2)} | Upper ${indicators.bollinger.upper.toFixed(2)}\n`;
      if (indicators.price < indicators.bollinger.lower) prompt += `  → Price BELOW lower band (strong oversold signal)\n`;
      else if (indicators.price > indicators.bollinger.upper) prompt += `  → Price ABOVE upper band (strong overbought signal)\n`;
      else {
        const bbPct = ((indicators.price - indicators.bollinger.lower) / (indicators.bollinger.upper - indicators.bollinger.lower) * 100).toFixed(0);
        prompt += `  → Price at ${bbPct}% of BB range (0%=lower, 100%=upper)\n`;
      }
    }

    // MFI — volume-weighted momentum (3Commas QFL style, more reliable than Stochastic)
    if (indicators.mfi !== undefined) {
      prompt += `MFI(14) [Volume-weighted RSI]: ${indicators.mfi.toFixed(2)}`;
      if (indicators.mfi < 20) prompt += ` → STRONGLY oversold (volume confirms selling exhaustion)`;
      else if (indicators.mfi < 40) prompt += ` → Mildly oversold`;
      else if (indicators.mfi > 80) prompt += ` → STRONGLY overbought (volume confirms buying exhaustion)`;
      else if (indicators.mfi > 60) prompt += ` → Mildly overbought`;
      else prompt += ` → Neutral`;
      prompt += '\n';
    }

    // ADX — trend strength (Freqtrade/Jesse style)
    if (indicators.adx) {
      const adxStrength = indicators.adx.adx > 40 ? 'Very Strong trend' : indicators.adx.adx > 25 ? 'Strong trend' : indicators.adx.adx > 20 ? 'Moderate trend' : 'Weak/Ranging';
      prompt += `ADX(14) [Trend Strength]: ${indicators.adx.adx.toFixed(2)} → ${adxStrength}`;
      prompt += ` | +DI: ${indicators.adx.pdi?.toFixed(2)} / -DI: ${indicators.adx.mdi?.toFixed(2)}`;
      prompt += ` (${indicators.adx.pdi > indicators.adx.mdi ? '+DI dominant = bullish pressure' : '-DI dominant = bearish pressure'})\n`;
    }

    // Parabolic SAR — trend direction (Gunbot style)
    if (indicators.psar) {
      prompt += `Parabolic SAR: ${indicators.psar.psar?.toFixed(2)} → Price ${indicators.psar.trend === 'BULLISH' ? 'ABOVE PSAR (bullish)' : 'BELOW PSAR (bearish)'}\n`;
    }

    // OBV volume trend
    if (indicators.obv) {
      prompt += `OBV Volume Trend: ${indicators.obv.trend} (${indicators.obv.momentum === 'UP' ? '↑ buying volume' : '↓ selling volume'})\n`;
    }

    if (indicators.stochastic) {
      prompt += `Stochastic %K/%D: ${indicators.stochastic.k.toFixed(2)} / ${indicators.stochastic.d.toFixed(2)}`;
      if (indicators.stochastic.k < 20) prompt += ` → Oversold`;
      else if (indicators.stochastic.k > 80) prompt += ` → Overbought`;
      prompt += '\n';
    }

    prompt += `\n=== RECENT PRICE ACTION (last 10 candles) ===\n`;
    recentCandles.forEach((candle, i) => {
      const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
      prompt += `${i + 1}. Close: $${candle.close.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)\n`;
    });

    // --- JSON response instruction ---
    prompt += `\n=== RESPONSE FORMAT ===\n`;
    prompt += `Based on 4H timeframe direction and entry timeframe indicators, respond ONLY with valid JSON:\n`;
    prompt += `{\n`;
    prompt += `  "signal": "LONG" | "SHORT",\n`;
    prompt += `  "confidence": <0-100>,\n`;
    prompt += `  "entryReason": "Explain why THIS is a good entry point based on ${config.timeframe || '15m'} indicators",\n`;
    prompt += `  "reasoning": ["reason 1 for direction", "reason 2 for entry timing", "reason 3 for setup"],\n`;
    prompt += `  "marketAnalysis": "<2-3 sentence summary of 4H direction and entry quality>",\n`;
    prompt += `  "riskLevel": "LOW" | "MEDIUM" | "HIGH",\n`;
    prompt += `  "stopLoss": <exact numeric price for stop loss, e.g. 91500.00>,\n`;
    prompt += `  "takeProfit": <exact numeric price for take profit, e.g. 96000.00>,\n`;
    prompt += `  "stopLossReason": "Explain where stop loss should be placed and why"\n`;
    prompt += `}\n\n`;
    prompt += `STOP LOSS / TAKE PROFIT RULES:\n`;
    prompt += `- LONG: stopLoss must be BELOW current price (recent swing low or below key support)\n`;
    prompt += `- LONG: takeProfit must be ABOVE current price (near resistance, minimum 1:2 R:R ratio)\n`;
    prompt += `- SHORT: stopLoss must be ABOVE current price (recent swing high or above key resistance)\n`;
    prompt += `- SHORT: takeProfit must be BELOW current price (near support, minimum 1:2 R:R ratio)\n`;
    prompt += `CRITICAL: You MUST return either LONG or SHORT. Never return HOLD, BUY, or SELL.\n`;
    prompt += `- Use "LONG" for bullish positions\n`;
    prompt += `- Use "SHORT" for bearish positions\n`;

    return prompt;
  }

  /**
   * Combine AI analysis with technical indicator signals
   * @param {Object} aiAnalysis - AI-generated analysis
   * @param {Object} technicalSignals - Technical indicator signals
   * @returns {Object} Combined signal decision
   */
  combineSignals(aiAnalysis, technicalSignals) {
    // If AI analysis failed, fall back to technical signals
    if (aiAnalysis.error) {
      return {
        decision: technicalSignals.buy ? 'BUY' : technicalSignals.sell ? 'SELL' : 'HOLD',
        source: 'technical',
        reasons: technicalSignals.buy ? technicalSignals.buyReasons : technicalSignals.sellReasons,
        confidence: 50,
        aiAnalysis: null
      };
    }

    // Combine AI and technical signals
    const aiSignal = aiAnalysis.signal;
    const techSignal = technicalSignals.buy ? 'BUY' : technicalSignals.sell ? 'SELL' : 'HOLD';

    // Both agree - high confidence
    if (aiSignal === techSignal && techSignal !== 'HOLD') {
      return {
        decision: aiSignal,
        source: 'combined',
        reasons: [
          ...aiAnalysis.reasoning,
          `Technical indicators confirm ${techSignal} signal`
        ],
        confidence: Math.min(aiAnalysis.confidence + 15, 100),
        aiAnalysis: aiAnalysis,
        technicalSignals: technicalSignals
      };
    }

    // AI suggests action but technical says HOLD - trust AI if confidence > 70
    if (aiSignal !== 'HOLD' && techSignal === 'HOLD' && aiAnalysis.confidence > 70) {
      return {
        decision: aiSignal,
        source: 'ai-primary',
        reasons: [
          ...aiAnalysis.reasoning,
          'Technical indicators neutral, but AI sees opportunity'
        ],
        confidence: aiAnalysis.confidence - 10,
        aiAnalysis: aiAnalysis,
        technicalSignals: technicalSignals
      };
    }

    // Technical suggests action but AI says HOLD - be cautious
    if (techSignal !== 'HOLD' && aiSignal === 'HOLD') {
      return {
        decision: 'HOLD',
        source: 'ai-veto',
        reasons: [
          'AI recommends caution despite technical signals',
          ...aiAnalysis.reasoning
        ],
        confidence: 40,
        aiAnalysis: aiAnalysis,
        technicalSignals: technicalSignals
      };
    }

    // Conflicting signals (AI says BUY, technical says SELL or vice versa) - HOLD
    if ((aiSignal === 'BUY' && techSignal === 'SELL') || (aiSignal === 'SELL' && techSignal === 'BUY')) {
      return {
        decision: 'HOLD',
        source: 'conflict',
        reasons: [
          'Conflicting signals detected',
          `AI suggests ${aiSignal}`,
          `Technical indicators suggest ${techSignal}`,
          'Waiting for clearer signal'
        ],
        confidence: 20,
        aiAnalysis: aiAnalysis,
        technicalSignals: technicalSignals
      };
    }

    // Both say HOLD
    return {
      decision: 'HOLD',
      source: 'combined',
      reasons: ['No clear trading opportunity at this time'],
      confidence: 50,
      aiAnalysis: aiAnalysis,
      technicalSignals: technicalSignals
    };
  }
}

module.exports = AIAnalyzer;
