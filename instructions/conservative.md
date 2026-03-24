---
# Conservative Strategy - High-confidence signals only
# Optimized for 1-hour timeframe

pairs:
  - BTC/USDT
  - ETH/USDT

timeframe: 1h
candleLimit: 200

indicators:
  rsi:
    enabled: true
    period: 14
    overbought: 75
    oversold: 25
  
  ema:
    enabled: true
    fastPeriod: 21
    slowPeriod: 55
  
  macd:
    enabled: true
    fastPeriod: 12
    slowPeriod: 26
    signalPeriod: 9
  
  bollinger:
    enabled: true
    period: 20
    stdDev: 2

signals:
  buy:
    - condition: "rsi < oversold"
      description: "RSI deeply oversold"
    - condition: "price < bollinger.lower"
      description: "Price below lower Bollinger Band"
    - condition: "ema.fast > ema.slow"
      description: "Long-term uptrend confirmed"
    - condition: "macd.histogram > 0"
      description: "MACD momentum positive"
  
  sell:
    - condition: "rsi > overbought"
      description: "RSI deeply overbought"
    - condition: "price > bollinger.upper"
      description: "Price above upper Bollinger Band"
    - condition: "ema.fast < ema.slow"
      description: "Long-term downtrend confirmed"
    - condition: "macd.histogram < 0"
      description: "MACD momentum negative"

notifications:
  enabled: true
  cooldownMinutes: 180  # 3 hours
---

# Conservative Strategy

This strategy requires ALL conditions to be met, resulting in fewer but higher-quality signals.
Best for risk-averse traders who prefer to wait for strong confirmations.

Signals are rare but generally reliable. Expect several hours or days between signals.
