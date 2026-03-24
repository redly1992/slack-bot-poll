const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor(config) {
    this.provider = config.provider || 'openai'; // 'openai' or 'gemini'
    this.model = config.model;
    
    if (this.provider === 'openai') {
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      this.client = new OpenAI({ apiKey: config.apiKey });
      this.model = this.model || 'gpt-4o-mini';
      console.log(`✅ AI Analyzer initialized (OpenAI ${this.model})`);
      
    } else if (this.provider === 'gemini') {
      if (!config.apiKey) {
        throw new Error('Gemini API key is required');
      }
      this.client = new GoogleGenerativeAI(config.apiKey);
      this.model = this.model || 'gemini-1.5-flash';
      console.log(`✅ AI Analyzer initialized (Gemini ${this.model})`);
      
    } else {
      throw new Error(`Unknown AI provider: ${this.provider}. Use 'openai' or 'gemini'`);
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
      if (this.provider === 'openai') {
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
          content: `You are an expert cryptocurrency trading analyst. Analyze market data and provide trading signals based on technical indicators and the user's strategy. Be concise and actionable.

Your response must be valid JSON with this structure:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "marketAnalysis": "brief market analysis",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH"
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

    return JSON.parse(response.choices[0].message.content);
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

    const systemPrompt = `You are an expert cryptocurrency trading analyst. Analyze market data and provide trading signals based on technical indicators and the user's strategy. Be concise and actionable.

Your response must be valid JSON with this structure:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "marketAnalysis": "brief market analysis",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH"
}`;

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;
    
    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();
      
      return JSON.parse(text);
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
        return JSON.parse(fallbackText);
      }
      throw error;
    }
  }

  /**
   * Build the analysis prompt for the AI.
   * strategyContent (from strategy.md) becomes the persona/system context.
   * Market data is appended so the AI can reason against it.
   */
  buildAnalysisPrompt(symbol, indicators, ohlcv, config) {
    const recentCandles = ohlcv.slice(-10);
    const priceChange = ((indicators.price - ohlcv[0].close) / ohlcv[0].close * 100).toFixed(2);

    // --- System persona from strategy.md ---
    let prompt = '';
    if (config._strategyContent) {
      prompt += config._strategyContent + '\n\n';
      prompt += '---\n\n';
    }

    // --- Live market data ---
    prompt += `=== CURRENT MARKET DATA: ${symbol} ===\n`;
    prompt += `Price: $${indicators.price.toFixed(2)}\n`;
    prompt += `Price Change: ${priceChange}% over ${ohlcv.length} candles (${config.timeframe} each)\n\n`;

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
    if (indicators.macd) {
      const macdDir = indicators.macd.histogram > 0 ? 'Bullish momentum' : 'Bearish momentum';
      prompt += `MACD: ${indicators.macd.macd.toFixed(2)} | Signal: ${indicators.macd.signal.toFixed(2)} | Histogram: ${indicators.macd.histogram.toFixed(2)} → ${macdDir}\n`;
    }
    if (indicators.bollinger) {
      prompt += `Bollinger Bands: Lower ${indicators.bollinger.lower.toFixed(2)} | Middle ${indicators.bollinger.middle.toFixed(2)} | Upper ${indicators.bollinger.upper.toFixed(2)}\n`;
      if (indicators.price < indicators.bollinger.lower) prompt += `  → Price below lower band (potential bounce)\n`;
      else if (indicators.price > indicators.bollinger.upper) prompt += `  → Price above upper band (potential pullback)\n`;
    }

    prompt += `\n=== RECENT PRICE ACTION (last 10 candles) ===\n`;
    recentCandles.forEach((candle, i) => {
      const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
      prompt += `${i + 1}. Close: $${candle.close.toFixed(2)} (${change > 0 ? '+' : ''}${change}%)\n`;
    });

    // --- JSON response instruction ---
    prompt += `\n=== RESPONSE FORMAT ===\n`;
    prompt += `Based on all the above, respond ONLY with valid JSON:\n`;
    prompt += `{\n`;
    prompt += `  "signal": "BUY" | "SELL" | "HOLD",\n`;
    prompt += `  "confidence": <0-100>,\n`;
    prompt += `  "reasoning": ["reason 1", "reason 2", "reason 3"],\n`;
    prompt += `  "marketAnalysis": "<2-3 sentence summary>",\n`;
    prompt += `  "riskLevel": "LOW" | "MEDIUM" | "HIGH"\n`;
    prompt += `}`;

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
