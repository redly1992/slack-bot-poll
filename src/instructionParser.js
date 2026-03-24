const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

class InstructionParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.config = null;
    // Strategy file lives alongside the instruction file
    this.strategyPath = path.join(path.dirname(filePath), 'strategy.md');
  }

  /**
   * Parse the markdown instruction file
   * @returns {Object} Parsed configuration
   */
  parse() {
    try {
      const fileContent = fs.readFileSync(this.filePath, 'utf8');
      
      // Extract YAML frontmatter between --- delimiters
      const frontmatterMatch = fileContent.match(/^---\s*\n([\s\S]*?)\n---/m);
      
      if (!frontmatterMatch) {
        throw new Error('No YAML frontmatter found in instruction file');
      }

      const yamlContent = frontmatterMatch[1];
      this.config = yaml.load(yamlContent);

      return this.config;
    } catch (error) {
      throw new Error(`Failed to parse instruction file: ${error.message}`);
    }
  }

  /**
   * Get trading pairs
   * @returns {Array<string>}
   */
  getPairs() {
    if (!this.config) this.parse();
    return this.config.pairs || [];
  }

  /**
   * Get timeframe
   * @returns {string}
   */
  getTimeframe() {
    if (!this.config) this.parse();
    return this.config.timeframe || '15m';
  }

  /**
   * Get candle limit
   * @returns {number}
   */
  getCandleLimit() {
    if (!this.config) this.parse();
    return this.config.candleLimit || 100;
  }

  /**
   * Get indicator settings
   * @returns {Object}
   */
  getIndicators() {
    if (!this.config) this.parse();
    return this.config.indicators || {};
  }

  /**
   * Get signal rules
   * @returns {Object}
   */
  getSignals() {
    if (!this.config) this.parse();
    return this.config.signals || { buy: [], sell: [] };
  }

  /**
   * Get notification settings
   * @returns {Object}
   */
  getNotificationSettings() {
    if (!this.config) this.parse();
    return this.config.notifications || { enabled: true, cooldownMinutes: 60 };
  }

  /**
   * Get the full strategy prompt from strategy.md
   * @returns {string}
   */
  getStrategyContent() {
    try {
      if (fs.existsSync(this.strategyPath)) {
        return fs.readFileSync(this.strategyPath, 'utf8').trim();
      }
      return '';
    } catch (error) {
      return '';
    }
  }
}

module.exports = InstructionParser;
