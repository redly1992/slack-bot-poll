'use strict';
const fs = require('fs');
const path = require('path');
const IndicatorCalculator = require('./indicatorCalculator');

const DEFAULT_PARAMS_PATH = path.join(__dirname, '..', 'instructions', 'strategy-v2-params.json');

// Indicator config used for prev-candle recalculation inside analyze()
const INDICATOR_CONFIG = {
  rsi:        { enabled: true, period: 14 },
  ema:        { enabled: true, fastPeriod: 9, slowPeriod: 21 },
  macd:       { enabled: true, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  bollinger:  { enabled: true, period: 20, stdDev: 2 },
  stochastic: { enabled: true, period: 14, signalPeriod: 3 },
};

class TradingStrategyV2 {
  constructor(paramsPath) {
    this.paramsPath = paramsPath || DEFAULT_PARAMS_PATH;
    this.params = this._loadParams();
  }

  _loadParams() {
    try {
      return JSON.parse(fs.readFileSync(this.paramsPath, 'utf-8'));
    } catch (err) {
      throw new Error(`Failed to load strategy params from ${this.paramsPath}: ${err.message}`);
    }
  }

  reload() {
    this.params = this._loadParams();
  }

  /**
   * Determine market regime from 4H indicators.
   * @returns {{ regime: 'BULL'|'BEAR'|'RANGING', adx: number, emaDir: string }}
   */
  getMarketRegime(ind4h) {
    const adxVal   = ind4h.adx?.adx;
    const adxMin   = this.params.marketRegime.adxTrendMinimum;

    if (adxVal !== undefined && adxVal < adxMin) {
      return { regime: 'RANGING', adx: adxVal, emaDir: 'NEUTRAL' };
    }

    const emaFast = ind4h.ema?.fast;
    const emaSlow = ind4h.ema?.slow;
    if (!emaFast || !emaSlow) {
      return { regime: 'RANGING', adx: adxVal || 0, emaDir: 'NEUTRAL' };
    }

    const ema200Trend = ind4h.ema200?.trend; // 'BULLISH' | 'BEARISH' | undefined
    const emaBull = emaFast > emaSlow;
    const emaBear = emaFast < emaSlow;

    if (emaBull) {
      // EMA direction matches EMA200 (or EMA200 not available) → confirmed BULL
      if (!ema200Trend || ema200Trend === 'BULLISH') {
        return { regime: 'BULL', adx: adxVal || 0, emaDir: 'BULLISH' };
      }
      // EMA bullish but EMA200 bearish → transitional, skip
      return { regime: 'RANGING', adx: adxVal || 0, emaDir: 'CONFLICT' };
    }

    if (emaBear) {
      if (!ema200Trend || ema200Trend === 'BEARISH') {
        return { regime: 'BEAR', adx: adxVal || 0, emaDir: 'BEARISH' };
      }
      return { regime: 'RANGING', adx: adxVal || 0, emaDir: 'CONFLICT' };
    }

    return { regime: 'RANGING', adx: adxVal || 0, emaDir: 'NEUTRAL' };
  }

  /**
   * Setup A — EMA Pullback in Trend (Freqtrade NostalgiaForInfinity style).
   * @returns {{ signal: 'LONG'|'SHORT', score: number, conditions: string[] } | null}
   */
  checkSetupA(ind15m, ind1h, regime) {
    if (!this.params.setupA.enabled) return null;

    const p     = this.params.setupA;
    const price = ind15m.price;
    let score   = 0;
    const conditions = [];

    if (regime.regime === 'BULL') {
      // RSI in long pullback range (+2)
      if (ind15m.rsi !== undefined &&
          ind15m.rsi >= p.rsiLong.min && ind15m.rsi <= p.rsiLong.max) {
        score += 2;
        conditions.push(`RSI(15m)=${ind15m.rsi.toFixed(1)} in LONG range [${p.rsiLong.min}-${p.rsiLong.max}]`);
      }
      // Price within emaPullbackPct% of 1H EMA fast (+2)
      if (ind1h.ema?.fast) {
        const pct = Math.abs(price - ind1h.ema.fast) / ind1h.ema.fast * 100;
        if (pct <= p.emaPullbackPct) {
          score += 2;
          conditions.push(`Price within ${p.emaPullbackPct}% of 1H EMA(9): ${pct.toFixed(2)}% away`);
        }
      }
      // Stochastic K < 45 and K > D (turning up) (+2)
      if (ind15m.stochastic?.k !== undefined && ind15m.stochastic?.d !== undefined) {
        if (ind15m.stochastic.k < 45 && ind15m.stochastic.k > ind15m.stochastic.d) {
          score += 2;
          conditions.push(`Stoch K=${ind15m.stochastic.k.toFixed(1)} < 45 and > D=${ind15m.stochastic.d.toFixed(1)}`);
        }
      }
      // MACD histogram negative but increasing (turning point) (+1)
      if (ind15m.macd?.histogram !== undefined && ind15m.prevMacd?.histogram !== undefined) {
        if (ind15m.macd.histogram < 0 && ind15m.macd.histogram > ind15m.prevMacd.histogram) {
          score += 1;
          conditions.push(`MACD hist turning up: ${ind15m.prevMacd.histogram.toFixed(4)} → ${ind15m.macd.histogram.toFixed(4)}`);
        }
      }
      // PSAR bullish (+1)
      if (ind15m.psar?.trend === 'BULLISH') {
        score += 1;
        conditions.push('PSAR bullish');
      }

      if (score >= p.scoreThreshold) return { signal: 'LONG', score, conditions };

    } else if (regime.regime === 'BEAR') {
      // RSI in short rally range (+2)
      if (ind15m.rsi !== undefined &&
          ind15m.rsi >= p.rsiShort.min && ind15m.rsi <= p.rsiShort.max) {
        score += 2;
        conditions.push(`RSI(15m)=${ind15m.rsi.toFixed(1)} in SHORT range [${p.rsiShort.min}-${p.rsiShort.max}]`);
      }
      // Price within emaPullbackPct% of 1H EMA fast (+2)
      if (ind1h.ema?.fast) {
        const pct = Math.abs(price - ind1h.ema.fast) / ind1h.ema.fast * 100;
        if (pct <= p.emaPullbackPct) {
          score += 2;
          conditions.push(`Price within ${p.emaPullbackPct}% of 1H EMA(9): ${pct.toFixed(2)}% away`);
        }
      }
      // Stochastic K > 55 and K < D (turning down) (+2)
      if (ind15m.stochastic?.k !== undefined && ind15m.stochastic?.d !== undefined) {
        if (ind15m.stochastic.k > 55 && ind15m.stochastic.k < ind15m.stochastic.d) {
          score += 2;
          conditions.push(`Stoch K=${ind15m.stochastic.k.toFixed(1)} > 55 and < D=${ind15m.stochastic.d.toFixed(1)}`);
        }
      }
      // MACD histogram positive but decreasing (+1)
      if (ind15m.macd?.histogram !== undefined && ind15m.prevMacd?.histogram !== undefined) {
        if (ind15m.macd.histogram > 0 && ind15m.macd.histogram < ind15m.prevMacd.histogram) {
          score += 1;
          conditions.push(`MACD hist turning down: ${ind15m.prevMacd.histogram.toFixed(4)} → ${ind15m.macd.histogram.toFixed(4)}`);
        }
      }
      // PSAR bearish (+1)
      if (ind15m.psar?.trend === 'BEARISH') {
        score += 1;
        conditions.push('PSAR bearish');
      }

      if (score >= p.scoreThreshold) return { signal: 'SHORT', score, conditions };
    }

    return null;
  }

  /**
   * Setup B — Extreme Oversold/Overbought (3Commas QFL / Freqtrade BB_RSI style).
   * @returns {{ signal: 'LONG'|'SHORT', score: number, conditions: string[] } | null}
   */
  checkSetupB(ind15m, regime) {
    if (!this.params.setupB.enabled) return null;

    const p     = this.params.setupB;
    const price = ind15m.price;
    let score   = 0;
    const conditions = [];

    if (regime.regime === 'BULL') {
      // RSI extreme oversold (+3)
      if (ind15m.rsi !== undefined && ind15m.rsi <= p.rsiLongMax) {
        score += 3;
        conditions.push(`RSI(15m)=${ind15m.rsi.toFixed(1)} <= ${p.rsiLongMax} (extreme oversold)`);
      }
      // MFI volume-confirmed selling exhaustion (+2)
      if (ind15m.mfi !== undefined && ind15m.mfi <= p.mfiLongMax) {
        score += 2;
        conditions.push(`MFI=${ind15m.mfi.toFixed(1)} <= ${p.mfiLongMax} (volume-confirmed exhaustion)`);
      }
      // Price at/below BB lower (+2)
      if (ind15m.bollinger?.lower && price <= ind15m.bollinger.lower * 1.003) {
        score += 2;
        conditions.push(`Price ${price.toFixed(2)} at/below BB lower ${ind15m.bollinger.lower.toFixed(2)}`);
      }
      // Stochastic extreme oversold (+1)
      if (ind15m.stochastic?.k !== undefined && ind15m.stochastic.k < 20) {
        score += 1;
        conditions.push(`Stoch K=${ind15m.stochastic.k.toFixed(1)} < 20 (extreme oversold)`);
      }

      if (score >= p.scoreThreshold) return { signal: 'LONG', score, conditions };

    } else if (regime.regime === 'BEAR') {
      // RSI extreme overbought (+3)
      if (ind15m.rsi !== undefined && ind15m.rsi >= p.rsiShortMin) {
        score += 3;
        conditions.push(`RSI(15m)=${ind15m.rsi.toFixed(1)} >= ${p.rsiShortMin} (extreme overbought)`);
      }
      // MFI volume-confirmed buying exhaustion (+2)
      if (ind15m.mfi !== undefined && ind15m.mfi >= p.mfiShortMin) {
        score += 2;
        conditions.push(`MFI=${ind15m.mfi.toFixed(1)} >= ${p.mfiShortMin} (volume-confirmed exhaustion)`);
      }
      // Price at/above BB upper (+2)
      if (ind15m.bollinger?.upper && price >= ind15m.bollinger.upper * 0.997) {
        score += 2;
        conditions.push(`Price ${price.toFixed(2)} at/above BB upper ${ind15m.bollinger.upper.toFixed(2)}`);
      }
      // Stochastic extreme overbought (+1)
      if (ind15m.stochastic?.k !== undefined && ind15m.stochastic.k > 80) {
        score += 1;
        conditions.push(`Stoch K=${ind15m.stochastic.k.toFixed(1)} > 80 (extreme overbought)`);
      }

      if (score >= p.scoreThreshold) return { signal: 'SHORT', score, conditions };
    }

    return null;
  }

  /**
   * Setup C — MACD Momentum Cross (Jesse framework / systematic trend trading style).
   * Hard requires ADX >= adxMinimum before scoring.
   * @returns {{ signal: 'LONG'|'SHORT', score: number, conditions: string[] } | null}
   */
  checkSetupC(ind15m, ind1h, regime) {
    if (!this.params.setupC.enabled) return null;

    const p      = this.params.setupC;
    const adxVal = ind15m.adx?.adx;

    // Hard gate: requires ADX >= adxMinimum
    if (!adxVal || adxVal < p.adxMinimum) return null;

    let score = 0;
    const conditions = [];

    if (regime.regime === 'BULL') {
      // MACD bullish cross: macd > signal AND histogram > 0 (+3)
      if (ind15m.macd?.macd !== undefined && ind15m.macd.signal !== undefined) {
        if (ind15m.macd.macd > ind15m.macd.signal && ind15m.macd.histogram > 0) {
          score += 3;
          conditions.push(`MACD bullish cross: macd=${ind15m.macd.macd.toFixed(2)} > signal=${ind15m.macd.signal.toFixed(2)}`);
        }
      }
      // 1H MACD histogram positive (+2)
      if (ind1h.macd?.histogram !== undefined && ind1h.macd.histogram > 0) {
        score += 2;
        conditions.push(`1H MACD hist positive: ${ind1h.macd.histogram.toFixed(2)}`);
      }
      // ADX bonus: >35 = +2, 28-35 = +1
      if (adxVal > 35) {
        score += 2;
        conditions.push(`ADX=${adxVal.toFixed(1)} > 35 (strong trend)`);
      } else {
        score += 1;
        conditions.push(`ADX=${adxVal.toFixed(1)} in [${p.adxMinimum}-35]`);
      }
      // 15m EMA fast > slow (+1)
      if (ind15m.ema?.fast > ind15m.ema?.slow) {
        score += 1;
        conditions.push('15m EMA fast > slow (bullish alignment)');
      }
      // PSAR bullish (+1)
      if (ind15m.psar?.trend === 'BULLISH') {
        score += 1;
        conditions.push('PSAR bullish');
      }

      if (score >= p.scoreThreshold) return { signal: 'LONG', score, conditions };

    } else if (regime.regime === 'BEAR') {
      // MACD bearish cross (+3)
      if (ind15m.macd?.macd !== undefined && ind15m.macd.signal !== undefined) {
        if (ind15m.macd.macd < ind15m.macd.signal && ind15m.macd.histogram < 0) {
          score += 3;
          conditions.push(`MACD bearish cross: macd=${ind15m.macd.macd.toFixed(2)} < signal=${ind15m.macd.signal.toFixed(2)}`);
        }
      }
      // 1H MACD histogram negative (+2)
      if (ind1h.macd?.histogram !== undefined && ind1h.macd.histogram < 0) {
        score += 2;
        conditions.push(`1H MACD hist negative: ${ind1h.macd.histogram.toFixed(2)}`);
      }
      // ADX bonus
      if (adxVal > 35) {
        score += 2;
        conditions.push(`ADX=${adxVal.toFixed(1)} > 35 (strong trend)`);
      } else {
        score += 1;
        conditions.push(`ADX=${adxVal.toFixed(1)} in [${p.adxMinimum}-35]`);
      }
      // 15m EMA fast < slow (+1)
      if (ind15m.ema?.fast < ind15m.ema?.slow) {
        score += 1;
        conditions.push('15m EMA fast < slow (bearish alignment)');
      }
      // PSAR bearish (+1)
      if (ind15m.psar?.trend === 'BEARISH') {
        score += 1;
        conditions.push('PSAR bearish');
      }

      if (score >= p.scoreThreshold) return { signal: 'SHORT', score, conditions };
    }

    return null;
  }

  /**
   * Calculate ATR-based SL/TP.
   * Validates minimum 1.5:1 R:R — returns null if not met.
   * @returns {{ stopLoss: number, takeProfit: number, rr: number } | null}
   */
  calculateSLTP(price, atr, signal, setupType) {
    const rm = this.params.riskManagement[`setup${setupType}`];
    if (!rm) return null;

    let stopLoss, takeProfit;
    if (signal === 'LONG') {
      stopLoss   = price - atr * rm.slAtr;
      takeProfit = price + atr * rm.tpAtr;
    } else if (signal === 'SHORT') {
      stopLoss   = price + atr * rm.slAtr;
      takeProfit = price - atr * rm.tpAtr;
    } else {
      return null;
    }

    const risk   = Math.abs(price - stopLoss);
    const reward = Math.abs(takeProfit - price);
    if (risk === 0) return null;
    const rr = reward / risk;

    if (rr < 1.5) return null;

    return {
      stopLoss:   parseFloat(stopLoss.toFixed(2)),
      takeProfit: parseFloat(takeProfit.toFixed(2)),
      rr:         parseFloat(rr.toFixed(2)),
    };
  }

  /**
   * Main entry point. Runs regime detection then tries setups A → B → C.
   * @returns {Object} Signal object (see module JSDoc below)
   */
  analyze(ind5m, ind15m, ind1h, ind4h, candles15m) {
    const regimeInfo = this.getMarketRegime(ind4h);

    if (regimeInfo.regime === 'RANGING') {
      const reason = regimeInfo.emaDir === 'CONFLICT'
        ? 'EMA direction conflicts with EMA200 (transitional market)'
        : `ADX too low (${(regimeInfo.adx || 0).toFixed(1)}) — ranging market`;
      return this._skip(regimeInfo, reason);
    }

    // Augment ind15m with previous-candle MACD for histogram-direction checks
    if (candles15m && candles15m.length >= 36) {
      try {
        const prevInd = IndicatorCalculator.calculateAll(candles15m.slice(0, -1), INDICATOR_CONFIG);
        ind15m.prevMacd = prevInd.macd;
      } catch (_) { /* not enough data — omit prevMacd */ }
    }

    // ATR for SL/TP sizing
    let atr = null;
    if (candles15m && candles15m.length >= 15) {
      try { atr = IndicatorCalculator.calculateATR(candles15m); } catch (_) {}
    }

    if (!atr || atr <= 0) {
      return this._skip(regimeInfo, 'ATR unavailable — cannot size SL/TP');
    }

    const price = ind15m.price;

    // Try setups in priority order
    const setups = [
      { type: 'A', result: this.checkSetupA(ind15m, ind1h, regimeInfo) },
      { type: 'B', result: this.checkSetupB(ind15m, regimeInfo) },
      { type: 'C', result: this.checkSetupC(ind15m, ind1h, regimeInfo) },
    ];

    for (const { type, result } of setups) {
      if (!result) continue;
      const sltp = this.calculateSLTP(price, atr, result.signal, type);
      if (!sltp) continue; // R:R too low — discard this setup

      return {
        signal:     result.signal,
        setupType:  type,
        score:      result.score,
        conditions: result.conditions,
        regime:     regimeInfo.regime,
        adx:        regimeInfo.adx,
        stopLoss:   sltp.stopLoss,
        takeProfit: sltp.takeProfit,
        rr:         sltp.rr,
        skipReason: null,
      };
    }

    return this._skip(regimeInfo, 'No setup conditions met');
  }

  _skip(regimeInfo, reason) {
    return {
      signal:     'SKIP',
      setupType:  null,
      score:      0,
      conditions: [],
      regime:     regimeInfo.regime,
      adx:        regimeInfo.adx || 0,
      stopLoss:   null,
      takeProfit: null,
      rr:         null,
      skipReason: reason,
    };
  }
}

module.exports = TradingStrategyV2;
