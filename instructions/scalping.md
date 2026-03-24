---
# Scalping Strategy - Short-term momentum trades
# Optimized for 5-minute timeframe

pairs:
  - BTC/USDT
  - ETH/USDT

timeframe: 5m
candleLimit: 50

indicators:
  rsi:
    enabled: true
    period: 7
    overbought: 75
    oversold: 25
  
  ema:
    enabled: true
    fastPeriod: 5
    slowPeriod: 13
  
  bollinger:
    enabled: true
    period: 10
    stdDev: 1.5

signals:
  buy:
    - condition: "rsi < oversold"
      description: "RSI oversold (quick reversal expected)"
    - condition: "price < bollinger.lower"
      description: "Price at lower Bollinger Band"
  
  sell:
    - condition: "rsi > overbought"
      description: "RSI overbought (quick reversal expected)"
    - condition: "price > bollinger.upper"
      description: "Price at upper Bollinger Band"

notifications:
  enabled: true
  cooldownMinutes: 15
---

# Scalping Strategy

Fast-paced strategy for short-term momentum trades. Uses tight RSI bands and narrow Bollinger Bands for quick entry/exit signals.

**Warning**: Scalping requires active monitoring and quick decision-making.
