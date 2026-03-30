require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

/**
 * Analyze Backtest Results
 * Find patterns and generate recommendations for strategy improvement
 */

class ResultsAnalyzer {
  constructor(config = {}) {
    this.dbPath = config.dbPath || 'backtest-results.db';
    this.db = null;
  }
  
  /**
   * Initialize database
   */
  initDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  /**
   * Get all completed signals
   */
  getCompletedSignals() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM backtest_signals 
        WHERE result IS NOT NULL
        ORDER BY timestamp
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  
  /**
   * Analyze confidence vs performance
   */
  analyzeConfidence(signals) {
    const ranges = [
      { min: 70, max: 100, label: '70-100%' },
      { min: 65, max: 70, label: '65-70%' },
      { min: 60, max: 65, label: '60-65%' },
      { min: 55, max: 60, label: '55-60%' },
      { min: 0, max: 55, label: '0-55%' }
    ];
    
    const results = ranges.map(range => {
      const inRange = signals.filter(s => 
        s.ai_confidence >= range.min && s.ai_confidence < range.max
      );
      
      if (inRange.length === 0) return null;
      
      const wins = inRange.filter(s => s.result === 'WIN').length;
      const losses = inRange.filter(s => s.result === 'LOSS').length;
      const winRate = (wins / inRange.length) * 100;
      const avgPnl = inRange.reduce((sum, s) => sum + s.pnl_percent, 0) / inRange.length;
      
      return {
        range: range.label,
        total: inRange.length,
        wins,
        losses,
        winRate: winRate.toFixed(1),
        avgPnl: avgPnl.toFixed(2)
      };
    }).filter(r => r !== null);
    
    return results;
  }
  
  /**
   * Analyze direction performance
   */
  analyzeDirection(signals) {
    const conditions = ['BULLISH', 'BEARISH'];
    const directions = ['LONG', 'SHORT'];
    
    const results = [];
    
    conditions.forEach(condition => {
      directions.forEach(direction => {
        const filtered = signals.filter(s => 
          s.direction === direction && s.market_condition === condition
        );
        
        if (filtered.length === 0) return;
        
        const wins = filtered.filter(s => s.result === 'WIN').length;
        const winRate = (wins / filtered.length) * 100;
        const avgPnl = filtered.reduce((sum, s) => sum + s.pnl_percent, 0) / filtered.length;
        
        results.push({
          combo: `${direction} in ${condition}`,
          total: filtered.length,
          wins,
          losses: filtered.length - wins,
          winRate: winRate.toFixed(1),
          avgPnl: avgPnl.toFixed(2),
          rating: winRate >= 60 ? '✅' : winRate >= 50 ? '⚖️' : '❌'
        });
      });
    });
    
    return results.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
  }
  
  /**
   * Analyze market conditions
   */
  analyzeMarketConditions(signals) {
    const conditions = {};
    
    signals.forEach(s => {
      if (!conditions[s.market_condition]) {
        conditions[s.market_condition] = {
          total: 0,
          wins: 0,
          losses: 0,
          totalPnl: 0
        };
      }
      
      conditions[s.market_condition].total++;
      if (s.result === 'WIN') conditions[s.market_condition].wins++;
      if (s.result === 'LOSS') conditions[s.market_condition].losses++;
      conditions[s.market_condition].totalPnl += s.pnl_percent;
    });
    
    return Object.entries(conditions).map(([condition, stats]) => ({
      condition,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
      avgPnl: (stats.totalPnl / stats.total).toFixed(2)
    }));
  }
  
  /**
   * Analyze indicator patterns
   */
  analyzeIndicators(signals) {
    // Parse indicator data and find winning patterns
    const patterns = {};
    
    signals.forEach(s => {
      try {
        const ind15m = JSON.parse(s.indicators_15m);
        const alignment = s.signal_15m;
        
        // Check which indicators agreed with the signal
        const agreeing = [];
        
        if (ind15m.rsi < 45 && alignment === 'BUY') agreeing.push('RSI');
        if (ind15m.rsi > 55 && alignment === 'SELL') agreeing.push('RSI');
        
        if (ind15m.ema?.fast > ind15m.ema?.slow && alignment === 'BUY') agreeing.push('EMA');
        if (ind15m.ema?.fast < ind15m.ema?.slow && alignment === 'SELL') agreeing.push('EMA');
        
        if (ind15m.macd?.histogram > 0 && alignment === 'BUY') agreeing.push('MACD');
        if (ind15m.macd?.histogram < 0 && alignment === 'SELL') agreeing.push('MACD');
        
        const key = agreeing.sort().join('+') || 'NONE';
        
        if (!patterns[key]) {
          patterns[key] = { total: 0, wins: 0, losses: 0 };
        }
        
        patterns[key].total++;
        if (s.result === 'WIN') patterns[key].wins++;
        if (s.result === 'LOSS') patterns[key].losses++;
        
      } catch (e) {
        // Skip if can't parse
      }
    });
    
    return Object.entries(patterns)
      .map(([pattern, stats]) => ({
        pattern,
        total: stats.total,
        wins: stats.wins,
        losses: stats.losses,
        winRate: ((stats.wins / stats.total) * 100).toFixed(1)
      }))
      .filter(p => p.total >= 3) // Only show patterns with 3+ occurrences
      .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
  }
  
  /**
   * Generate recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Confidence recommendations
    const bestConfidence = analysis.confidence.filter(c => parseFloat(c.winRate) >= 60);
    if (bestConfidence.length > 0) {
      const minConfidence = Math.min(...bestConfidence.map(c => parseInt(c.range.split('-')[0])));
      recommendations.push({
        category: 'CONFIDENCE',
        priority: 'HIGH',
        recommendation: `Increase MIN_CONFIDENCE threshold to ${minConfidence}%`,
        reason: `Win rate drops below 60% for confidence <${minConfidence}%`,
        impact: `May reduce signals but improve win rate by ${(parseFloat(bestConfidence[0].winRate) - 50).toFixed(1)}%`
      });
    }
    
    // Direction recommendations
    const bestDirections = analysis.direction.filter(d => parseFloat(d.winRate) >= 60);
    const worstDirections = analysis.direction.filter(d => parseFloat(d.winRate) < 45);
    
    if (worstDirections.length > 0) {
      worstDirections.forEach(d => {
        recommendations.push({
          category: 'DIRECTION',
          priority: 'HIGH',
          recommendation: `Avoid or reduce weight for: ${d.combo}`,
          reason: `Only ${d.winRate}% win rate (${d.wins} wins / ${d.losses} losses)`,
          impact: `Could eliminate ${d.losses} losing trades`
        });
      });
    }
    
    if (bestDirections.length > 0) {
      recommendations.push({
        category: 'DIRECTION',
        priority: 'MEDIUM',
        recommendation: `Emphasize trend alignment: ${bestDirections.map(d => d.combo).join(', ')}`,
        reason: `These combinations have ${bestDirections[0].winRate}%+ win rate`,
        impact: `Focus on high-probability setups`
      });
    }
    
    // Market condition recommendations
    const bullishPerf = analysis.marketConditions.find(c => c.condition === 'BULLISH');
    const bearishPerf = analysis.marketConditions.find(c => c.condition === 'BEARISH');
    
    if (bullishPerf && bearishPerf) {
      const diff = Math.abs(parseFloat(bullishPerf.winRate) - parseFloat(bearishPerf.winRate));
      if (diff > 10) {
        const better = parseFloat(bullishPerf.winRate) > parseFloat(bearishPerf.winRate) ? 'BULLISH' : 'BEARISH';
        recommendations.push({
          category: 'MARKET_CONDITION',
          priority: 'MEDIUM',
          recommendation: `Prioritize trading in ${better} markets`,
          reason: `${diff.toFixed(1)}% win rate difference between market conditions`,
          impact: `May improve overall win rate by ${(diff / 2).toFixed(1)}%`
        });
      }
    }
    
    // Indicator recommendations
    if (analysis.indicators.length > 0) {
      const bestPattern = analysis.indicators[0];
      const worstPattern = analysis.indicators[analysis.indicators.length - 1];
      
      if (parseFloat(bestPattern.winRate) >= 65) {
        recommendations.push({
          category: 'INDICATORS',
          priority: 'HIGH',
          recommendation: `Prioritize signals with ${bestPattern.pattern} alignment`,
          reason: `${bestPattern.winRate}% win rate (best performing pattern)`,
          impact: `${bestPattern.wins} wins / ${bestPattern.losses} losses in ${bestPattern.total} trades`
        });
      }
      
      if (parseFloat(worstPattern.winRate) < 40) {
        recommendations.push({
          category: 'INDICATORS',
          priority: 'MEDIUM',
          recommendation: `Filter out or reduce weight for ${worstPattern.pattern} only signals`,
          reason: `Only ${worstPattern.winRate}% win rate`,
          impact: `Could avoid ${worstPattern.losses} losing trades`
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Run complete analysis
   */
  async analyze() {
    console.log('\n📊 BACKTEST RESULTS ANALYSIS');
    console.log(`${'='.repeat(70)}\n`);
    
    await this.initDatabase();
    const signals = await this.getCompletedSignals();
    
    if (signals.length === 0) {
      console.log('❌ No completed signals found. Run backtest first!\n');
      await this.close();
      return;
    }
    
    console.log(`Analyzing ${signals.length} completed signals...\n`);
    
    // Overall stats
    const wins = signals.filter(s => s.result === 'WIN').length;
    const losses = signals.filter(s => s.result === 'LOSS').length;
    const winRate = (wins / signals.length) * 100;
    const totalPnl = signals.reduce((sum, s) => sum + s.pnl_usd, 0);
    const avgPnl = signals.reduce((sum, s) => sum + s.pnl_percent, 0) / signals.length;
    
    console.log('📈 OVERALL PERFORMANCE');
    console.log(`${'─'.repeat(70)}`);
    console.log(`Total Signals:     ${signals.length}`);
    console.log(`Win Rate:          ${winRate.toFixed(1)}% (${wins} wins / ${losses} losses)`);
    console.log(`Total P/L:         $${totalPnl > 0 ? '+' : ''}${totalPnl.toFixed(2)}`);
    console.log(`Avg P/L:           ${avgPnl > 0 ? '+' : ''}${avgPnl.toFixed(2)}%`);
    console.log('');
    
    // Confidence analysis
    console.log('🎯 CONFIDENCE ANALYSIS');
    console.log(`${'─'.repeat(70)}`);
    const confidenceAnalysis = this.analyzeConfidence(signals);
    confidenceAnalysis.forEach(c => {
      const status = parseFloat(c.winRate) >= 60 ? '✅' : parseFloat(c.winRate) >= 50 ? '⚖️' : '❌';
      console.log(`  ${status} ${c.range.padEnd(10)} Win Rate: ${c.winRate.padStart(5)}%  (${c.wins} wins / ${c.losses} losses)  Avg: ${c.avgPnl > 0 ? '+' : ''}${c.avgPnl}%`);
    });
    console.log('');
    
    // Direction analysis
    console.log('📊 DIRECTION & MARKET CONDITION ANALYSIS');
    console.log(`${'─'.repeat(70)}`);
    const directionAnalysis = this.analyzeDirection(signals);
    directionAnalysis.forEach(d => {
      console.log(`  ${d.rating} ${d.combo.padEnd(20)} Win Rate: ${d.winRate.padStart(5)}%  (${d.wins} wins / ${d.losses} losses)  Avg: ${d.avgPnl > 0 ? '+' : ''}${d.avgPnl}%`);
    });
    console.log('');
    
    // Market conditions
    console.log('🌍 MARKET CONDITIONS');
    console.log(`${'─'.repeat(70)}`);
    const marketAnalysis = this.analyzeMarketConditions(signals);
    marketAnalysis.forEach(m => {
      const status = parseFloat(m.winRate) >= 55 ? '✅' : '⚖️';
      console.log(`  ${status} ${m.condition.padEnd(10)} Win Rate: ${m.winRate.padStart(5)}%  (${m.wins} wins / ${m.losses} losses)  Avg: ${m.avgPnl > 0 ? '+' : ''}${m.avgPnl}%`);
    });
    console.log('');
    
    // Indicator patterns
    console.log('🔧 INDICATOR PATTERNS');
    console.log(`${'─'.repeat(70)}`);
    const indicatorAnalysis = this.analyzeIndicators(signals);
    if (indicatorAnalysis.length > 0) {
      indicatorAnalysis.forEach(i => {
        const status = parseFloat(i.winRate) >= 65 ? '✅' : parseFloat(i.winRate) >= 50 ? '⚖️' : '❌';
        console.log(`  ${status} ${i.pattern.padEnd(25)} Win Rate: ${i.winRate.padStart(5)}%  (${i.wins}/${i.total})`);
      });
    } else {
      console.log('  Not enough data for pattern analysis');
    }
    console.log('');
    
    // Generate recommendations
    const analysis = {
      confidence: confidenceAnalysis,
      direction: directionAnalysis,
      marketConditions: marketAnalysis,
      indicators: indicatorAnalysis
    };
    
    const recommendations = this.generateRecommendations(analysis);
    
    console.log('💡 RECOMMENDATIONS FOR STRATEGY IMPROVEMENT');
    console.log(`${'='.repeat(70)}`);
    
    if (recommendations.length === 0) {
      console.log('\n✅ Strategy is performing well! No major changes needed.\n');
      console.log('Consider collecting more data for deeper analysis.\n');
    } else {
      recommendations.forEach((rec, i) => {
        console.log(`\n${i + 1}. [${rec.priority}] ${rec.category}`);
        console.log(`   📝 ${rec.recommendation}`);
        console.log(`   💭 Reason: ${rec.reason}`);
        console.log(`   ⚡ Impact: ${rec.impact}`);
      });
      console.log('');
    }
    
    console.log(`${'='.repeat(70)}`);
    console.log('\n📝 NEXT STEPS:\n');
    console.log('1. Review the recommendations above');
    console.log('2. Update instructions/learned-strategy.md with changes');
    console.log('3. Re-run backtest to verify improvements:');
    console.log('   rm backtest-results.db backtest-checkpoint.json');
    console.log('   npm run backtest');
    console.log('4. Compare results to see if win rate improved\n');
    
    await this.close();
  }
  
  /**
   * Close database
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new ResultsAnalyzer();
  
  analyzer.analyze()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Analysis failed: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = ResultsAnalyzer;
