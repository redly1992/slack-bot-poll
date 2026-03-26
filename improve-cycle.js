require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai');
const PnLCalculator = require('./calculate-pnl.js');
const ResultsAnalyzer = require('./analyze-results.js');

/**
 * Automated Strategy Improvement
 * Uses AI to analyze trade history and generate smarter strategy improvements
 */

class AutoImprover {
  constructor() {
    this.strategyPath = path.join('instructions', 'strategy.md');
    this.backupPath = path.join('instructions', `strategy-backup-${Date.now()}.md`);
    this.resultsDbPath = 'backtest-results.db';
    this.checkpointPath = 'backtest-checkpoint.json';
    
    // Initialize AI client
    const provider = process.env.AI_PROVIDER || 'deepseek';
    const apiKey = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.GEMINI_API_KEY;
    const baseURL = provider === 'deepseek' ? 'https://api.deepseek.com' : undefined;
    this.aiModel = provider === 'deepseek'
      ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat')
      : (process.env.GEMINI_MODEL || 'gemini-1.5-flash');
    
    this.ai = new OpenAI({ apiKey, baseURL });
  }
  
  /**
   * Backup current strategy
   */
  backupStrategy() {
    if (fs.existsSync(this.strategyPath)) {
      fs.copyFileSync(this.strategyPath, this.backupPath);
      console.log(`✅ Strategy backed up to: ${this.backupPath}\n`);
      return true;
    }
    return false;
  }
  
  /**
   * Get analysis recommendations
   */
  async getRecommendations() {
    const analyzer = new ResultsAnalyzer();
    await analyzer.initDatabase();
    const signals = await analyzer.getCompletedSignals();
    
    if (signals.length === 0) {
      console.log('❌ No completed signals found!\n');
      await analyzer.close();
      return null;
    }
    
    // Get analysis data
    const confidenceAnalysis = analyzer.analyzeConfidence(signals);
    const directionAnalysis = analyzer.analyzeDirection(signals);
    const marketAnalysis = analyzer.analyzeMarketConditions(signals);
    const indicatorAnalysis = analyzer.analyzeIndicators(signals);
    
    const analysis = {
      totalSignals: signals.length,
      wins: signals.filter(s => s.result === 'WIN').length,
      losses: signals.filter(s => s.result === 'LOSS').length,
      confidence: confidenceAnalysis,
      direction: directionAnalysis,
      marketConditions: marketAnalysis,
      indicators: indicatorAnalysis
    };
    
    const recommendations = analyzer.generateRecommendations(analysis);
    await analyzer.close();
    
    return { analysis, recommendations };
  }
  
  /**
   * Update strategy.md with recommendations
   */
  updateStrategy(data) {
    if (!data || !data.recommendations || data.recommendations.length === 0) {
      console.log('ℹ️  No recommendations to apply. Strategy unchanged.\n');
      return false;
    }
    
    let strategy = fs.readFileSync(this.strategyPath, 'utf-8');
    
    // Add improvement section at the top
    const timestamp = new Date().toISOString().split('T')[0];
    const improvementNote = `
<!-- AUTO-UPDATED: ${timestamp} -->
<!-- Based on ${data.analysis.totalSignals} signals: ${data.analysis.wins} wins / ${data.analysis.losses} losses -->

`;
    
    // Find best confidence threshold
    const confRec = data.recommendations.find(r => r.category === 'CONFIDENCE');
    if (confRec) {
      const match = confRec.recommendation.match(/(\d+)%/);
      if (match) {
        const newThreshold = match[1];
        // Update confidence mentions in strategy
        strategy = strategy.replace(
          /confidence levels? of (\d+)% or higher/gi,
          `confidence levels of ${newThreshold}% or higher`
        );
        strategy = strategy.replace(
          /minimum confidence.{0,20}(\d+)%/gi,
          `minimum confidence of ${newThreshold}%`
        );
        console.log(`✅ Updated confidence threshold to ${newThreshold}%`);
      }
    }
    
    // Add direction warnings
    const dirRecs = data.recommendations.filter(r => r.category === 'DIRECTION');
    if (dirRecs.length > 0) {
      const avoidPatterns = dirRecs.filter(r => r.recommendation.includes('Avoid'));
      if (avoidPatterns.length > 0) {
        const warningSection = '\n## ⚠️ Avoid These Patterns (Data-Driven)\n\n';
        let warnings = '';
        avoidPatterns.forEach(rec => {
          const pattern = rec.recommendation.replace('Avoid or reduce weight for: ', '');
          warnings += `- **${pattern}**: ${rec.reason}\n`;
        });
        
        // Insert after multi-timeframe section or at the end
        if (!strategy.includes('⚠️ Avoid These Patterns')) {
          strategy = strategy.replace(
            /## Multi-Timeframe Analysis/i,
            warningSection + warnings + '\n## Multi-Timeframe Analysis'
          );
          console.log('✅ Added direction warnings');
        }
      }
    }
    
    // Add indicator priority
    const indRecs = data.recommendations.filter(r => r.category === 'INDICATORS');
    if (indRecs.length > 0) {
      const priorityRec = indRecs.find(r => r.priority === 'HIGH' && r.recommendation.includes('Prioritize'));
      if (priorityRec) {
        const pattern = priorityRec.recommendation.match(/with (.+?) alignment/)?.[1];
        if (pattern && !strategy.includes('Priority Indicator')) {
          const indicatorNote = `\n### Priority Indicator: ${pattern}\n\nData shows ${pattern} alignment has the highest win rate (${priorityRec.reason}). Require this indicator to agree for strongest signals.\n\n`;
          
          strategy = strategy.replace(
            /## Technical Indicators/i,
            '## Technical Indicators\n' + indicatorNote
          );
          console.log(`✅ Added ${pattern} as priority indicator`);
        }
      }
    }
    
    // Add market condition preferences
    const marketRec = data.recommendations.find(r => r.category === 'MARKET_CONDITION');
    if (marketRec) {
      const preferred = marketRec.recommendation.match(/in (\w+) markets/)?.[1];
      if (preferred && !strategy.includes('Preferred Market Condition')) {
        const marketNote = `\n### Preferred Market Condition: ${preferred}\n\nBacktest data shows ${preferred} markets perform significantly better. ${marketRec.reason}\n\n`;
        
        strategy = strategy.replace(
          /## Risk Management/i,
          marketNote + '## Risk Management'
        );
        console.log(`✅ Added ${preferred} market preference`);
      }
    }
    
    // Prepend improvement note
    strategy = improvementNote + strategy;
    
    // Save updated strategy
    fs.writeFileSync(this.strategyPath, strategy);
    console.log(`\n✅ Strategy updated with ${data.recommendations.length} statistical recommendations\n`);
    
    return true;
  }

  /**
   * Load all completed trades with full context from DB
   */
  loadTradeContext() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.resultsDbPath, (err) => {
        if (err) return reject(err);
      });

      const query = `
        SELECT 
          id, date, pair, direction, market_condition,
          ai_signal, ai_confidence, ai_reasoning,
          indicators_15m, indicators_4h,
          signal_5m, signal_15m, signal_1h, alignment,
          entry_price, exit_price, pnl_percent, pnl_usd, result
        FROM backtest_signals
        WHERE result IS NOT NULL AND result != ''
        ORDER BY timestamp ASC
      `;

      db.all(query, [], (err, rows) => {
        db.close();
        if (err) return reject(err);
        resolve(rows.map(r => ({
          ...r,
          indicators_15m: this.safeJson(r.indicators_15m),
          indicators_4h: this.safeJson(r.indicators_4h),
          ai_reasoning: this.safeJson(r.ai_reasoning)
        })));
      });
    });
  }

  safeJson(str) {
    try { return JSON.parse(str); } catch { return str; }
  }

  /**
   * Build compact trade summary for AI prompt
   */
  buildTradeSummary(trades) {
    const wins = trades.filter(t => t.result === 'WIN');
    const losses = trades.filter(t => t.result === 'LOSS');
    const winRate = ((wins.length / trades.length) * 100).toFixed(1);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0).toFixed(2);

    const formatTrade = (t) => {
      const ind = t.indicators_15m || {};
      const ind4h = t.indicators_4h || {};
      return {
        date: t.date,
        direction: t.direction,
        confidence: t.ai_confidence,
        market: t.market_condition,
        result: t.result,
        pnl_usd: t.pnl_usd?.toFixed(2),
        pnl_pct: t.pnl_percent?.toFixed(2),
        entry: t.entry_price,
        exit: t.exit_price,
        indicators_15m: {
          rsi: ind.rsi?.value?.toFixed(1),
          macd_hist: ind.macd?.histogram?.toFixed(4),
          ema_fast: ind.ema?.fast?.toFixed(2),
          ema_slow: ind.ema?.slow?.toFixed(2),
          ema_aligned: ind.ema?.fast > ind.ema?.slow ? 'bullish' : 'bearish',
          bb_position: ind.bollingerBands?.position
        },
        indicators_4h: {
          rsi: ind4h.rsi?.value?.toFixed(1),
          ema_aligned: ind4h.ema?.fast > ind4h.ema?.slow ? 'bullish' : 'bearish',
          macd_hist: ind4h.macd?.histogram?.toFixed(4)
        },
        timeframe_signals: `5m:${t.signal_5m} 15m:${t.signal_15m} 1h:${t.signal_1h}`
      };
    };

    // Pick representative samples (max 15 wins + 15 losses to keep prompt size reasonable)
    const sampleWins = wins.slice(0, 15).map(formatTrade);
    const sampleLosses = losses.slice(0, 15).map(formatTrade);

    return { winRate, totalPnl, totalTrades: trades.length, wins: wins.length, losses: losses.length, sampleWins, sampleLosses };
  }

  /**
   * Send trade data to AI and get strategy improvement feedback
   */
  async getAIStrategyFeedback(summary, currentStrategy) {
    console.log(`  📡 Sending ${summary.totalTrades} trades to AI for analysis...`);

    const prompt = `You are an expert crypto trading strategy analyst. I have backtest results from a trading bot and need you to improve the trading strategy.

## BACKTEST PERFORMANCE SUMMARY
- Total trades: ${summary.totalTrades}
- Win rate: ${summary.winRate}%
- Wins: ${summary.wins}, Losses: ${summary.losses}
- Total P&L: $${summary.totalPnl}

## SAMPLE WINNING TRADES (${summary.sampleWins.length} shown)
${JSON.stringify(summary.sampleWins, null, 2)}

## SAMPLE LOSING TRADES (${summary.sampleLosses.length} shown)
${JSON.stringify(summary.sampleLosses, null, 2)}

## CURRENT STRATEGY FILE (instructions/strategy.md)
${currentStrategy}

## YOUR TASK
Analyze the winning vs losing trades carefully. Look for:
1. What RSI values, EMA alignments, MACD conditions appear in winning trades vs losing trades
2. Which market conditions (BULLISH/BEARISH) perform best for LONG vs SHORT
3. What confidence levels correlate with wins
4. Any patterns that consistently lead to losses (to avoid)
5. Entry conditions that need to be tightened or relaxed

Then produce an **updated version of the full strategy.md** that incorporates your findings.

## OUTPUT FORMAT
Return ONLY the complete updated strategy.md content. Start with the markdown content directly - no explanation before or after. The file should:
- Keep all existing sections
- Update indicator thresholds based on what the data shows
- Add a "## 📊 Data-Driven Rules" section near the top with specific rules learned from the backtest
- Add min/max RSI values that worked best
- Specify which EMA alignment conditions to require
- Update confidence thresholds
- Add any "AVOID" rules for losing patterns

Make the strategy smarter and more precise based on actual trade data.`;

    const response = await this.ai.chat.completions.create({
      model: this.aiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || null;
  }

  /**
   * Clean up old results
   */
  cleanup() {
    let cleaned = 0;
    
    try {
      if (fs.existsSync(this.resultsDbPath)) {
        fs.unlinkSync(this.resultsDbPath);
        console.log(`🗑️  Removed: ${this.resultsDbPath}`);
        cleaned++;
      }
    } catch (error) {
      console.log(`⚠️  Could not remove ${this.resultsDbPath} (file in use)`);
      console.log(`   Run manually: rm backtest-results.db`);
    }
    
    try {
      if (fs.existsSync(this.checkpointPath)) {
        fs.unlinkSync(this.checkpointPath);
        console.log(`🗑️  Removed: ${this.checkpointPath}`);
        cleaned++;
      }
    } catch (error) {
      console.log(`⚠️  Could not remove ${this.checkpointPath}`);
    }
    
    if (cleaned > 0) {
      console.log('');
    }
    
    return cleaned > 0;
  }
  
  /**
   * Run complete improvement cycle
   */
  async run() {
    console.log('\n🚀 AI-POWERED STRATEGY IMPROVEMENT');
    console.log(`${'='.repeat(70)}\n`);
    
    // Step 1: Calculate P&L
    console.log('📊 Step 1/6: Calculating P&L for all signals...\n');
    try {
      const pnlCalc = new PnLCalculator();
      await pnlCalc.calculate();
    } catch (error) {
      console.error(`❌ P&L calculation failed: ${error.message}\n`);
      return;
    }
    
    // Step 2: Statistical analysis
    console.log('\n📈 Step 2/6: Statistical pattern analysis...\n');
    const data = await this.getRecommendations();
    
    if (!data) {
      console.log('❌ Analysis failed. Cannot proceed.\n');
      return;
    }
    
    const winRate = ((data.analysis.wins / data.analysis.totalSignals) * 100).toFixed(1);
    console.log(`${'='.repeat(70)}`);
    console.log(`Performance: ${winRate}% win rate | ${data.analysis.wins} wins / ${data.analysis.losses} losses | ${data.analysis.totalSignals} total`);
    console.log(`${'='.repeat(70)}\n`);
    
    if (data.recommendations.length > 0) {
      console.log('💡 Statistical Recommendations:\n');
      data.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.priority}] ${rec.recommendation}`);
      });
      console.log('');
    }

    // Step 3: Load trade context and get AI feedback
    console.log('🤖 Step 3/6: Sending trade data to AI for deep analysis...\n');
    let aiUpdatedStrategy = null;
    try {
      const trades = await this.loadTradeContext();
      if (trades.length === 0) {
        console.log('  ⚠️  No completed trades found for AI analysis\n');
      } else {
        const summary = this.buildTradeSummary(trades);
        const currentStrategy = fs.readFileSync(this.strategyPath, 'utf-8');

        console.log(`  📊 ${trades.length} trades loaded (${summary.wins} wins, ${summary.losses} losses)`);
        aiUpdatedStrategy = await this.getAIStrategyFeedback(summary, currentStrategy);

        if (aiUpdatedStrategy) {
          console.log('  ✅ AI analysis complete!\n');
        } else {
          console.log('  ⚠️  AI returned empty response, falling back to statistical update\n');
        }
      }
    } catch (error) {
      console.log(`  ⚠️  AI analysis failed: ${error.message}\n  Falling back to statistical update only.\n`);
    }

    // Step 4: Backup current strategy
    console.log('💾 Step 4/5: Backing up current strategy...\n');
    this.backupStrategy();
    
    // Step 5: Update strategy (AI-generated or statistical)
    console.log('✏️  Step 5/5: Writing updated strategy.md...\n');

    if (aiUpdatedStrategy) {
      // Strip any accidental code fences the AI might add
      const cleaned = aiUpdatedStrategy
        .replace(/^```(?:markdown)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      // Prepend metadata
      const meta = `<!-- AI-IMPROVED: ${new Date().toISOString().split('T')[0]} -->\n<!-- Based on ${data.analysis.totalSignals} signals: ${data.analysis.wins} wins / ${data.analysis.losses} losses (${winRate}% win rate) -->\n\n`;
      fs.writeFileSync(this.strategyPath, meta + cleaned);
      console.log('  ✅ Strategy fully rewritten by AI with data-driven rules\n');
    } else {
      const updated = this.updateStrategy(data);
      if (!updated) {
        console.log('  ℹ️  No applicable changes found\n');
      }
    }

    // Final summary
    console.log(`${'='.repeat(70)}`);
    console.log('✅ AI IMPROVEMENT CYCLE COMPLETE!');
    console.log(`${'='.repeat(70)}\n`);
    console.log(`  📊 Signals analyzed: ${data.analysis.totalSignals}`);
    console.log(`  🏆 Win rate: ${winRate}%`);
    console.log(`  🤖 Strategy: ${aiUpdatedStrategy ? 'AI-rewritten with data-driven rules' : 'Statistically updated'}`);
    console.log(`  💾 Backup: ${path.basename(this.backupPath)}\n`);
    console.log('🚀 NEXT STEPS:\n');
    console.log('  1. Review updated instructions/strategy.md');
    console.log('  2. Clean up and start fresh backtest:');
    console.log('     npm run cleanup');
    console.log('     npm run backtest');
    console.log('  3. Repeat: npm run improve-cycle');
    console.log(`  4. Restore if worse: copy instructions\\${path.basename(this.backupPath)} instructions\\strategy.md\n`);
  }
}

// Run if executed directly
if (require.main === module) {
  const improver = new AutoImprover();
  
  improver.run()
    .then(() => {
      console.log('✅ Done!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Improvement cycle failed: ${error.message}\n`);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = AutoImprover;
