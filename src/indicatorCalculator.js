const { RSI, EMA, MACD, BollingerBands } = require('technicalindicators');

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

    return results;
  }
}

module.exports = IndicatorCalculator;
