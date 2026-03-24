class SignalEvaluator {
  /**
   * Evaluate trading signals based on indicator values and rules
   * @param {Object} indicators - Calculated indicator values
   * @param {Object} signalRules - Signal rules from instruction file
   * @param {Object} indicatorConfig - Indicator configuration for thresholds
   * @returns {Object} Evaluation results
   */
  static evaluate(indicators, signalRules, indicatorConfig) {
    const results = {
      buy: false,
      sell: false,
      buyReasons: [],
      sellReasons: [],
    };

    // Evaluate buy signals
    if (signalRules.buy && signalRules.buy.length > 0) {
      const buyConditionsMet = signalRules.buy.map(rule => {
        const isMet = this.evaluateCondition(rule.condition, indicators, indicatorConfig);
        if (isMet) {
          results.buyReasons.push(rule.description);
        }
        return isMet;
      });

      results.buy = buyConditionsMet.every(met => met);
    }

    // Evaluate sell signals
    if (signalRules.sell && signalRules.sell.length > 0) {
      const sellConditionsMet = signalRules.sell.map(rule => {
        const isMet = this.evaluateCondition(rule.condition, indicators, indicatorConfig);
        if (isMet) {
          results.sellReasons.push(rule.description);
        }
        return isMet;
      });

      results.sell = sellConditionsMet.every(met => met);
    }

    return results;
  }

  /**
   * Evaluate a single condition string
   * @param {string} condition - Condition string (e.g., "rsi < oversold")
   * @param {Object} indicators - Calculated indicators
   * @param {Object} indicatorConfig - Configuration with thresholds
   * @returns {boolean}
   */
  static evaluateCondition(condition, indicators, indicatorConfig) {
    try {
      // Replace named values with actual values
      let expression = condition;

      // Replace threshold names
      if (indicatorConfig.rsi) {
        expression = expression.replace(/\boversold\b/g, indicatorConfig.rsi.oversold);
        expression = expression.replace(/\boverbought\b/g, indicatorConfig.rsi.overbought);
      }

      // Replace indicator values
      expression = expression.replace(/\bprice\b/g, indicators.price || 0);
      expression = expression.replace(/\brsi\b/g, indicators.rsi || 0);

      if (indicators.ema) {
        expression = expression.replace(/\bema\.fast\b/g, indicators.ema.fast || 0);
        expression = expression.replace(/\bema\.slow\b/g, indicators.ema.slow || 0);
      }

      if (indicators.macd) {
        expression = expression.replace(/\bmacd\.histogram\b/g, indicators.macd.histogram || 0);
        expression = expression.replace(/\bmacd\.signal\b/g, indicators.macd.signal || 0);
        expression = expression.replace(/\bmacd\.macd\b/g, indicators.macd.macd || 0);
      }

      if (indicators.bollinger) {
        expression = expression.replace(/\bbollinger\.upper\b/g, indicators.bollinger.upper || 0);
        expression = expression.replace(/\bbollinger\.middle\b/g, indicators.bollinger.middle || 0);
        expression = expression.replace(/\bbollinger\.lower\b/g, indicators.bollinger.lower || 0);
      }

      if (indicators.stochastic) {
        expression = expression.replace(/\bstochastic\.k\b/g, indicators.stochastic.k || 0);
        expression = expression.replace(/\bstochastic\.d\b/g, indicators.stochastic.d || 0);
      }

      // Evaluate the expression
      // eslint-disable-next-line no-eval
      return eval(expression);
    } catch (error) {
      console.error(`Error evaluating condition "${condition}": ${error.message}`);
      return false;
    }
  }
}

module.exports = SignalEvaluator;
