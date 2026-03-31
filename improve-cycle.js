require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createAIClient } = require('./src/aiClient');
const PnLCalculator = require('./calculate-pnl.js');
const ResultsAnalyzer = require('./analyze-results.js');

/**
 * Automated Strategy Improvement
 * Uses AI to analyze trade history and generate smarter strategy improvements
 */

class AutoImprover {
  constructor() {
    this.learnedStrategyPath = path.join('instructions', 'learned-strategy.md');
    this.baseStrategyPath    = path.join('instructions', 'strategy-english.md');
    this.strategyPath        = this.learnedStrategyPath; // alias used for backup path building
    this.backupPath          = null; // set later with cycle number + win-rate in filename
    this.resultsDbPath       = 'backtest-results.db';
    this.checkpointPath      = 'backtest-checkpoint.json';

    // Seed learned-strategy.md from strategy-english.md if it doesn't exist yet
    if (!fs.existsSync(this.learnedStrategyPath) && fs.existsSync(this.baseStrategyPath)) {
      fs.copyFileSync(this.baseStrategyPath, this.learnedStrategyPath);
      console.log(`📖 Seeded learned-strategy.md from strategy-english.md`);
    }

    // Read cycle number from auto-cycle state file
    this.cycleNumber = 1;
    try {
      const stateFile = 'cycle-state.json';
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        this.cycleNumber = state.cycleNumber || 1;
      }
    } catch (_) {}
    
    // Initialize AI client via shared factory (set AI_PROVIDER in .env)
    const { client, model } = createAIClient();
    this.ai      = client;
    this.aiModel = model;
  }
  
  /**
   * Backup current learned strategy
   */
  backupStrategy() {
    if (fs.existsSync(this.learnedStrategyPath)) {
      fs.copyFileSync(this.learnedStrategyPath, this.backupPath);
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
          ai_entry_reason, ai_stop_loss_reason, ai_risk_level,
          indicators_15m, indicators_4h,
          signal_5m, signal_15m, signal_1h, alignment,
          entry_price, exit_price, stop_loss_price, take_profit_price,
          pnl_percent, pnl_usd, result, exit_type
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
   * Uses random sampling to avoid bias toward early trades
   */
  buildTradeSummary(trades) {
    const wins   = trades.filter(t => t.result === 'WIN');
    const losses = trades.filter(t => t.result === 'LOSS');
    const winRate  = ((wins.length / trades.length) * 100).toFixed(1);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl_usd || 0), 0).toFixed(2);

    // Random shuffle helper
    const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);

    const formatTrade = (t) => {
      const ind  = t.indicators_15m || {};
      const ind4h = t.indicators_4h  || {};
      const slDist = t.stop_loss_price && t.entry_price
        ? Math.abs(((t.stop_loss_price - t.entry_price) / t.entry_price) * 100).toFixed(2)
        : null;
      const tpDist = t.take_profit_price && t.entry_price
        ? Math.abs(((t.take_profit_price - t.entry_price) / t.entry_price) * 100).toFixed(2)
        : null;
      return {
        date:       t.date,
        direction:  t.direction,
        confidence: t.ai_confidence,
        market:     t.market_condition,
        result:     t.result,
        exit_type:  t.exit_type || 'TIME',
        pnl_usd:    t.pnl_usd?.toFixed(2),
        pnl_pct:    t.pnl_percent?.toFixed(2),
        entry:      t.entry_price,
        stop_loss:  t.stop_loss_price,
        take_profit: t.take_profit_price,
        sl_dist_pct: slDist ? `${slDist}%` : null,   // how far SL was from entry
        tp_dist_pct: tpDist ? `${tpDist}%` : null,   // how far TP was from entry
        rr_ratio:   slDist && tpDist ? (parseFloat(tpDist) / parseFloat(slDist)).toFixed(2) : null,
        entry_reason:    t.ai_entry_reason,
        sl_reason:       t.ai_stop_loss_reason,
        indicators_15m: {
          rsi:        ind.rsi?.toFixed ? ind.rsi.toFixed(1) : null,
          macd_hist:  ind.macd?.histogram?.toFixed(4),
          ema_fast:   ind.ema?.fast?.toFixed(2),
          ema_slow:   ind.ema?.slow?.toFixed(2),
          ema_aligned: ind.ema?.fast > ind.ema?.slow ? 'bullish' : 'bearish',
          // bb_pos: 0%=at lower band, 100%=at upper band
          bb_pos: (ind.bollinger?.upper && ind.bollinger?.lower && ind.price)
            ? (((ind.price - ind.bollinger.lower) / (ind.bollinger.upper - ind.bollinger.lower)) * 100).toFixed(1) + '%'
            : null
        },
        indicators_4h: {
          rsi:        ind4h.rsi?.toFixed ? ind4h.rsi.toFixed(1) : null,
          ema_aligned: ind4h.ema?.fast > ind4h.ema?.slow ? 'bullish' : 'bearish',
          macd_hist:  ind4h.macd?.histogram?.toFixed(4)
        }
      };
    };

    // Random sample: 20 wins + 20 losses for richer AI context
    const sampleWins   = shuffle(wins).slice(0, 20).map(formatTrade);
    const sampleLosses = shuffle(losses).slice(0, 20).map(formatTrade);

    return { winRate, totalPnl, totalTrades: trades.length, wins: wins.length, losses: losses.length, sampleWins, sampleLosses };
  }

  /**
   * Send trade data to AI and get improved learned-strategy.md
   * Base strategy (strategy-english.md) is the immutable reference.
   * Current learned strategy is what gets updated each cycle.
   */
  async getAIStrategyFeedback(summary, learnedStrategy) {
    console.log(`  📡 Sending ${summary.totalTrades} trades (${summary.sampleWins.length}W + ${summary.sampleLosses.length}L samples) to AI...`);

    // Load base strategy as immutable reference
    const baseStrategy = fs.existsSync(this.baseStrategyPath)
      ? fs.readFileSync(this.baseStrategyPath, 'utf-8')
      : '';

    const prompt = `You are an expert crypto trading strategy analyst improving a live trading bot.

## IMMUTABLE BASE STRATEGY (do NOT remove core rules from here)
${baseStrategy}

## CURRENT LEARNED STRATEGY (this is what you must improve)
${learnedStrategy}

## BACKTEST PERFORMANCE THIS CYCLE
- Total trades: ${summary.totalTrades}
- Win rate: ${summary.winRate}%  (target: >50%)
- Wins: ${summary.wins} | Losses: ${summary.losses}
- Total P&L: $${summary.totalPnl}

## SAMPLE WINNING TRADES (${summary.sampleWins.length} random samples)
${JSON.stringify(summary.sampleWins, null, 2)}

## SAMPLE LOSING TRADES (${summary.sampleLosses.length} random samples)
${JSON.stringify(summary.sampleLosses, null, 2)}

## YOUR TASK
Analyze the winning vs losing trades. Pay special attention to:
1. **SL/TP placement**: Look at sl_dist_pct, tp_dist_pct, rr_ratio — are the winning trades using a better R:R?
2. **Exit type**: Were wins mostly TP hits or TIME exits? Were losses mostly SL hits?
3. **EMA alignment**: Does 15m ema_aligned matching direction (LONG+bullish, SHORT+bearish) improve win rate?
4. **Market condition**: Which direction (LONG/SHORT) works in BULLISH vs BEARISH 4H market?
5. **Confidence**: What confidence level separates winners from losers?
6. **Entry quality**: What indicator combinations appear in wins but NOT in losses?

Then produce a **single improved learned-strategy.md** that:
- Keeps ALL sections from the base strategy (it is the foundation)
- Adds or updates a "## 📊 Learned Rules (Cycle ${this.cycleNumber})" section with SPECIFIC, ACTIONABLE rules
- Each rule must be concrete: "REQUIRE X when Y" or "AVOID when Z"
- Specifies recommended SL distance % and TP distance % based on what worked
- Specifies which indicator combinations to REQUIRE vs AVOID
- Removes or replaces any rules that clearly did NOT work

## OUTPUT FORMAT
Return ONLY the complete learned-strategy.md content. No explanation before or after. Start directly with markdown.`;

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
    
    const winRate = data.analysis.totalSignals > 0
      ? ((data.analysis.wins / data.analysis.totalSignals) * 100).toFixed(1)
      : '0.0';
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
        // Pass the LEARNED strategy (not the corrupted strategy.md)
        const learnedStrategy = fs.existsSync(this.learnedStrategyPath)
          ? fs.readFileSync(this.learnedStrategyPath, 'utf-8')
          : fs.readFileSync(this.baseStrategyPath, 'utf-8');

        console.log(`  📊 ${trades.length} trades loaded (${summary.wins} wins, ${summary.losses} losses)`);
        aiUpdatedStrategy = await this.getAIStrategyFeedback(summary, learnedStrategy);

        if (aiUpdatedStrategy) {
          console.log('  ✅ AI analysis complete!\n');
        } else {
          console.log('  ⚠️  AI returned empty response, falling back to statistical update\n');
        }
      }
    } catch (error) {
      console.log(`  ⚠️  AI analysis failed: ${error.message}\n  Falling back to statistical update only.\n`);
    }

    // Step 4: Backup current learned-strategy (filename: [date][cycle-N][pct-XX.X])
    console.log('💾 Step 4/5: Backing up current learned strategy...\n');
    const dateStr = new Date().toISOString().split('T')[0];
    this.backupPath = path.join(
      'instructions',
      `strategy-backup[${dateStr}][cycle-${this.cycleNumber}][pct-${winRate}].md`
    );
    this.backupStrategy();
    
    // Step 5: Write updated learned-strategy.md (AI-generated or statistical fallback)
    console.log('✏️  Step 5/5: Writing updated learned-strategy.md...\n');

    if (aiUpdatedStrategy) {
      // Strip any accidental code fences the AI might add
      const cleaned = aiUpdatedStrategy
        .replace(/^```(?:markdown)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      // Prepend metadata header
      const meta = `<!-- AI-IMPROVED: ${new Date().toISOString().split('T')[0]} | Cycle ${this.cycleNumber} -->\n<!-- Based on ${data.analysis.totalSignals} signals: ${data.analysis.wins} wins / ${data.analysis.losses} losses (${winRate}% win rate) -->\n\n`;
      fs.writeFileSync(this.learnedStrategyPath, meta + cleaned);
      console.log('  ✅ learned-strategy.md updated with AI data-driven rules\n');
    } else {
      // Statistical fallback: update the learned strategy
      this.strategyPath = this.learnedStrategyPath;
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
    console.log(`  🤖 Strategy: ${aiUpdatedStrategy ? 'AI-rewritten (learned-strategy.md)' : 'Statistically updated'}`);
    console.log(`  💾 Backup: ${path.basename(this.backupPath)}\n`);
    console.log('🚀 NEXT STEPS:\n');
    console.log('  1. Review updated instructions/learned-strategy.md');
    console.log('  2. npm run auto-cycle  (or: npm run cleanup && npm run backtest && npm run improve-cycle)');
    console.log(`  3. Restore if worse: cp ${this.backupPath} ${this.learnedStrategyPath}\n`);
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
