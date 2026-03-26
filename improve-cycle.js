require('dotenv').config();
const fs = require('fs');
const path = require('path');
const PnLCalculator = require('./calculate-pnl.js');
const ResultsAnalyzer = require('./analyze-results.js');

/**
 * Automated Strategy Improvement
 * Analyzes results and automatically updates strategy.md
 */

class AutoImprover {
  constructor() {
    this.strategyPath = path.join('instructions', 'strategy.md');
    this.backupPath = path.join('instructions', `strategy-backup-${Date.now()}.md`);
    this.resultsDbPath = 'backtest-results.db';
    this.checkpointPath = 'backtest-checkpoint.json';
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
    console.log(`\n✅ Strategy updated with ${data.recommendations.length} recommendations\n`);
    
    return true;
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
    console.log('\n🚀 AUTOMATED STRATEGY IMPROVEMENT');
    console.log(`${'='.repeat(70)}\n`);
    
    // Step 1: Calculate P&L
    console.log('📊 Step 1/5: Calculating P&L...\n');
    try {
      const pnlCalc = new PnLCalculator();
      await pnlCalc.calculate();
    } catch (error) {
      console.error(`❌ P&L calculation failed: ${error.message}\n`);
      return;
    }
    
    // Step 2: Analyze results
    console.log('\n📈 Step 2/5: Analyzing patterns...\n');
    const data = await this.getRecommendations();
    
    if (!data) {
      console.log('❌ Analysis failed. Cannot proceed.\n');
      return;
    }
    
    // Show summary
    const winRate = ((data.analysis.wins / data.analysis.totalSignals) * 100).toFixed(1);
    console.log(`${'='.repeat(70)}`);
    console.log(`Current Performance: ${winRate}% win rate (${data.analysis.wins} wins / ${data.analysis.losses} losses)`);
    console.log(`Recommendations: ${data.recommendations.length} improvements found`);
    console.log(`${'='.repeat(70)}\n`);
    
    if (data.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:\n');
      data.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority}] ${rec.recommendation}`);
      });
      console.log('');
    }
    
    // Step 3: Backup strategy
    console.log('💾 Step 3/5: Backing up current strategy...\n');
    this.backupStrategy();
    
    // Step 4: Update strategy
    console.log('✏️  Step 4/5: Updating strategy.md...\n');
    const updated = this.updateStrategy(data);
    
    if (!updated) {
      console.log('ℹ️  Strategy was not updated (no applicable recommendations)\n');
    }
    
    // Step 5: Cleanup
    console.log('🧹 Step 5/5: Cleaning up old results...\n');
    this.cleanup();
    
    // Final summary
    console.log(`${'='.repeat(70)}`);
    console.log('✅ IMPROVEMENT CYCLE COMPLETE!');
    console.log(`${'='.repeat(70)}\n`);
    
    console.log('📝 WHAT WAS DONE:\n');
    console.log(`  ✅ Analyzed ${data.analysis.totalSignals} signals`);
    console.log(`  ✅ Found ${data.recommendations.length} recommendations`);
    console.log(`  ✅ Updated strategy.md`);
    console.log(`  ✅ Backed up old strategy to: ${path.basename(this.backupPath)}`);
    console.log(`  ✅ Cleaned up old database & checkpoint\n`);
    
    console.log('🚀 NEXT STEPS:\n');
    console.log('  1. Review the updated instructions/strategy.md');
    console.log('  2. Manually clean database (if not done):');
    console.log('     rm backtest-results.db backtest-checkpoint.json\n');
    console.log('  3. Run backtest with new strategy:');
    console.log('     npm run backtest\n');
    console.log('  4. Compare results when complete:');
    console.log('     npm run improve-cycle\n');
    console.log(`  5. If worse, restore backup:`);
    console.log(`     cp ${this.backupPath} ${this.strategyPath}\n`);
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
