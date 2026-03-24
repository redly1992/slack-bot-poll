const { RSI, EMA, MACD, BollingerBands, Stochastic, ATR } = require('technicalindicators');

class IndicatorCalculator {
  /**
   * Calculate RSI (Relative Strength Index)
   * @param {Array} closes - Array of closing prices
   * @param {number} period - RSI period (default: 14)
   * @returns {number} Current RSI value
   */
  static calculateRSI(closes, period = 14) {
    if (closes.length < period) {
      throw new Error(`Not enough data for RSI calculation. Need ${period}, got ${closes.length}`);
    }

    const rsiValues = RSI.calculate({
      values: closes,
      period: period,
    });

    return rsiValues[rsiValues.length - 1];
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   * @param {Array} closes - Array of closing prices
   * @param {number} period - EMA period
   * @returns {number} Current EMA value
   */
  static calculateEMA(closes, period) {
    if (closes.length < period) {
      throw new Error(`Not enough data for EMA calculation. Need ${period}, got ${closes.length}`);
    }

    const emaValues = EMA.calculate({
      values: closes,
      period: period,
    });

    return emaValues[emaValues.length - 1];
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param {Array} closes - Array of closing prices
   * @param {Object} config - MACD configuration
   * @returns {Object} MACD line, signal line, and histogram
   */
  static calculateMACD(closes, config = {}) {
    const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = config;

    if (closes.length < slowPeriod + signalPeriod) {
      throw new Error(`Not enough data for MACD calculation`);
    }

    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: fastPeriod,
      slowPeriod: slowPeriod,
      signalPeriod: signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const current = macdValues[macdValues.length - 1];
    return {
      macd: current.MACD,
      signal: current.signal,
      histogram: current.histogram,
    };
  }

  /**
   * Calculate Bollinger Bands
   * @param {Array} closes - Array of closing prices
   * @param {Object} config - Bollinger Bands configuration
   * @returns {Object} Upper, middle, and lower bands
   */
  static calculateBollingerBands(closes, config = {}) {
    const { period = 20, stdDev = 2 } = config;

    if (closes.length < period) {
      throw new Error(`Not enough data for Bollinger Bands calculation`);
    }

    const bbValues = BollingerBands.calculate({
      values: closes,
      period: period,
      stdDev: stdDev,
    });

    const current = bbValues[bbValues.length - 1];
    return {
      upper: current.upper,
      middle: current.middle,
      lower: current.lower,
    };
  }

  /**
   * Calculate Stochastic Oscillator
   * @param {Array} ohlcv - OHLCV data
   * @param {Object} config - Stochastic configuration
   * @returns {Object} %K and %D values
   */
  static calculateStochastic(ohlcv, config = {}) {
    const { period = 14, signalPeriod = 3 } = config;

    if (ohlcv.length < period + signalPeriod) {
      throw new Error(`Not enough data for Stochastic calculation`);
    }

    const highs = ohlcv.map(c => c.high);
    const lows = ohlcv.map(c => c.low);
    const closes = ohlcv.map(c => c.close);

    const stochValues = Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: period,
      signalPeriod: signalPeriod,
    });

    const current = stochValues[stochValues.length - 1];
    return {
      k: current.k,
      d: current.d,
    };
  }

  /**
   * Calculate all indicators based on config
   * @param {Array} ohlcv - OHLCV data
   * @param {Object} indicatorConfig - Indicator configuration
   * @returns {Object} All calculated indicators
   */
  static calculateAll(ohlcv, indicatorConfig) {
    const closes = ohlcv.map(candle => candle.close);
    const currentPrice = closes[closes.length - 1];
    
    const results = {
      price: currentPrice,
    };

    // RSI
    if (indicatorConfig.rsi?.enabled) {
      try {
        results.rsi = this.calculateRSI(closes, indicatorConfig.rsi.period);
      } catch (error) {
        console.error(`RSI calculation error: ${error.message}`);
      }
    }

    // EMA
    if (indicatorConfig.ema?.enabled) {
      try {
        results.ema = {
          fast: this.calculateEMA(closes, indicatorConfig.ema.fastPeriod),
          slow: this.calculateEMA(closes, indicatorConfig.ema.slowPeriod),
        };
      } catch (error) {
        console.error(`EMA calculation error: ${error.message}`);
      }
    }

    // MACD
    if (indicatorConfig.macd?.enabled) {
      try {
        results.macd = this.calculateMACD(closes, {
          fastPeriod: indicatorConfig.macd.fastPeriod,
          slowPeriod: indicatorConfig.macd.slowPeriod,
          signalPeriod: indicatorConfig.macd.signalPeriod,
        });
      } catch (error) {
        console.error(`MACD calculation error: ${error.message}`);
      }
    }

    // Bollinger Bands
    if (indicatorConfig.bollinger?.enabled) {
      try {
        results.bollinger = this.calculateBollingerBands(closes, {
          period: indicatorConfig.bollinger.period,
          stdDev: indicatorConfig.bollinger.stdDev,
        });
      } catch (error) {
        console.error(`Bollinger Bands calculation error: ${error.message}`);
      }
    }

    // Stochastic
    if (indicatorConfig.stochastic?.enabled) {
      try {
        results.stochastic = this.calculateStochastic(ohlcv, {
          period: indicatorConfig.stochastic.period,
          signalPeriod: indicatorConfig.stochastic.signalPeriod,
        });
      } catch (error) {
        console.error(`Stochastic calculation error: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Calculate ATR (Average True Range) for stop-loss sizing
   * @param {Array} ohlcv - OHLCV data
   * @param {number} period - ATR period (default: 14)
   * @returns {number} Current ATR value
   */
  static calculateATR(ohlcv, period = 14) {
    if (ohlcv.length < period + 1) {
      throw new Error(`Not enough data for ATR calculation. Need ${period + 1}, got ${ohlcv.length}`);
    }

    const atrValues = ATR.calculate({
      high: ohlcv.map(c => c.high),
      low: ohlcv.map(c => c.low),
      close: ohlcv.map(c => c.close),
      period,
    });

    return atrValues[atrValues.length - 1];
  }

  /**
   * Determine trend direction from OHLCV data using EMA crossover + price position
   * @param {Array} ohlcv - OHLCV data (at least 50 candles recommended)
   * @returns {{ trend: 'BULLISH'|'BEARISH'|'NEUTRAL', ema21: number, ema50: number }}
   */
  static determineTrend(ohlcv) {
    const closes = ohlcv.map(c => c.close);
    const price = closes[closes.length - 1];

    try {
      const ema21Values = EMA.calculate({ values: closes, period: 21 });
      const ema50Values = EMA.calculate({ values: closes, period: 50 });

      const ema21 = ema21Values[ema21Values.length - 1];
      const ema50 = ema50Values[ema50Values.length - 1];

      let trend = 'NEUTRAL';
      if (price > ema21 && ema21 > ema50) trend = 'BULLISH';
      else if (price < ema21 && ema21 < ema50) trend = 'BEARISH';

      return { trend, ema21, ema50, price };
    } catch {
      return { trend: 'NEUTRAL', ema21: null, ema50: null, price };
    }
  }

  /**
   * Calculate stop-loss price using ATR multiplier
   * @param {number} entryPrice
   * @param {number} atr
   * @param {'BUY'|'SELL'} signal
   * @param {number} multiplier - ATR multiplier (1.5 for scalping per strategy)
   * @returns {number}
   */
  static calculateStopLoss(entryPrice, atr, signal, multiplier = 1.5) {
    if (signal === 'BUY') return entryPrice - atr * multiplier;
    if (signal === 'SELL') return entryPrice + atr * multiplier;
    return null;
  }

  /**
   * Calculate take-profit levels following the strategy's 1:1.5 / 1:2.5 / 1:4 RR framework
   * @param {number} entryPrice
   * @param {number} stopLoss
   * @param {'BUY'|'SELL'} signal
   * @returns {{ tp1: number, tp2: number, tp3: number, riskAmount: number }}
   */
  static calculateTakeProfits(entryPrice, stopLoss, signal) {
    const riskAmount = Math.abs(entryPrice - stopLoss);
    const direction = signal === 'BUY' ? 1 : -1;

    return {
      riskAmount,
      tp1: entryPrice + direction * riskAmount * 1.5,
      tp2: entryPrice + direction * riskAmount * 2.5,
      tp3: entryPrice + direction * riskAmount * 4.0,
    };
  }
}

module.exports = IndicatorCalculator;
