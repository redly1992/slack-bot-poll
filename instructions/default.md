---
# Trading Bot Instructions
# Configure your trading pairs, timeframes, and indicator rules

# Trading Pairs (symbol format: BASE/QUOTE)
pairs:
  - BTC/USDT
  - ETH/USDT
  - BNB/USDT

# Timeframe for analysis (1m, 5m, 15m, 30m, 1h, 4h, 1d)
timeframe: 15m

# Number of candles to fetch for indicator calculation
candleLimit: 100

# Indicator Settings
indicators:
  rsi:
    enabled: true
    period: 14
    overbought: 70
    oversold: 30
  
  ema:
    enabled: true
    fastPeriod: 9
    slowPeriod: 21
  
  macd:
    enabled: true
    fastPeriod: 12
    slowPeriod: 26
    signalPeriod: 9
  
  bollinger:
    enabled: true
    period: 20
    stdDev: 2
  
  stochastic:
    enabled: true
    period: 14
    signalPeriod: 3
    overbought: 80
    oversold: 20

# Trading Signal Rules
# Conditions are evaluated as AND (all must be true for signal)
signals:
  buy:
    - condition: "rsi < oversold"
      description: "RSI is oversold"
    - condition: "price < bollinger.lower"
      description: "Price below lower Bollinger Band"
    - condition: "ema.fast > ema.slow"
      description: "Fast EMA crosses above slow EMA (bullish)"
  
  sell:
    - condition: "rsi > overbought"
      description: "RSI is overbought"
    - condition: "price > bollinger.upper"
      description: "Price above upper Bollinger Band"
    - condition: "macd.histogram < 0"
      description: "MACD histogram is negative (bearish)"

# Notification Settings
notifications:
  enabled: true
  includeChart: false
  cooldownMinutes: 60  # Minimum time between notifications for same pair
  telegram: true       # Enable Telegram notifications
  instagram: false     # Enable Instagram DM notifications (requires credentials)
---
