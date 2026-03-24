const ccxt = require('ccxt');

// Exchanges with known geo-restrictions on cloud IPs (e.g. GitHub Actions / Azure)
const GEO_RESTRICTED = ['binance', 'binanceus'];

class MarketDataFetcher {
  constructor(exchangeName = 'bybit') {
    // Fallback to bybit if a geo-restricted exchange is requested in CI
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const resolved = (isCI && GEO_RESTRICTED.includes(exchangeName)) ? 'bybit' : exchangeName;

    if (resolved !== exchangeName) {
      console.log(`⚠️  ${exchangeName} is geo-restricted on cloud runners. Using ${resolved} instead.`);
    }

    this.exchangeName = resolved;
    this.exchange = new ccxt[resolved]({
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
      },
    });
  }

  /**
   * Fetch OHLCV (candlestick) data for a trading pair
   * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
   * @param {string} timeframe - Timeframe (e.g., '1m', '5m', '15m', '1h', '4h', '1d')
   * @param {number} limit - Number of candles to fetch
   * @returns {Promise<Array>} Array of OHLCV data
   */
  async fetchOHLCV(symbol, timeframe, limit = 100) {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      
      // Transform to readable format
      return ohlcv.map(candle => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      throw new Error(`Failed to fetch OHLCV for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Fetch current ticker price
   * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
   * @returns {Promise<Object>} Ticker data with current price
   */
  async fetchTicker(symbol) {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      return {
        symbol: ticker.symbol,
        last: ticker.last,
        bid: ticker.bid,
        ask: ticker.ask,
        high: ticker.high,
        low: ticker.low,
        volume: ticker.quoteVolume,
        timestamp: ticker.timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to fetch ticker for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Check if exchange supports a trading pair
   * @param {string} symbol - Trading pair
   * @returns {Promise<boolean>}
   */
  async isSymbolSupported(symbol) {
    try {
      await this.exchange.loadMarkets();
      return symbol in this.exchange.markets;
    } catch (error) {
      console.error(`Error checking symbol support: ${error.message}`);
      return false;
    }
  }
}

module.exports = MarketDataFetcher;
