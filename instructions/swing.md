---
# Swing Trading Strategy - Medium-term trend following
# Optimized for 4-hour timeframe

pairs:
  - BTC/USDT
  - ETH/USDT
  - SOL/USDT
  - MATIC/USDT

timeframe: 4h
candleLimit: 100

indicators:
  rsi:
    enabled: true
    period: 14
    overbought: 65
    oversold: 35
  
  ema:
    enabled: true
    fastPeriod: 20
    slowPeriod: 50
  
  macd:
    enabled: true
    fastPeriod: 12
    slowPeriod: 26
    signalPeriod: 9

signals:
  buy:
    - condition: "ema.fast > ema.slow"
      description: "Uptrend confirmed (fast EMA above slow)"
    - condition: "rsi < oversold && rsi > 25"
      description: "RSI in buy zone but not extreme"
    - condition: "macd.histogram > 0"
      description: "MACD histogram positive"
  
  sell:
    - condition: "ema.fast < ema.slow"
      description: "Downtrend confirmed (fast EMA below slow)"
    - condition: "rsi > overbought && rsi < 75"
      description: "RSI in sell zone but not extreme"

notifications:
  enabled: true
  cooldownMinutes: 240  # 4 hours
---

# Swing Trading Strategy

Medium-term strategy that follows trends using EMA crossovers and MACD confirmation. 
Suitable for traders who check positions multiple times per day but don't need constant monitoring.

Hold positions for days to weeks depending on trend strength.
