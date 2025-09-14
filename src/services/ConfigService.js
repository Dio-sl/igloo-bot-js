// src/services/ConfigService.js
const { logger } = require('../utils/logger');

/**
 * Service for managing guild configurations
 */
class ConfigService {
  /**
   * Create a new ConfigService
   * @param {Object} db - Database connection
   */
  constructor(db) {
    this.db = db;
    this.cache = new Map();
    
    // Define configuration schema
    this.schema = {
      tickets: {
        category: { type: 'string', required: true },
        support_role: { type: 'string', required: true },
        log_channel: { type: 'string', required: false },
        auto_close_hours: { type: 'number', default: 72, min: 1, max: 720 },
        max_open_tickets: { type: 'number', default: 5, min: 1, max: 50 },
        welcome_message: { type: 'string', required: false, maxLength: 2000 }
      },
      shop: {
        channel: { type: 'string', required: true },
        customer_role: { type: 'string', required: false },
        currency: { type: 'string', default: 'USD' },
        tax_rate: { type: 'number', default: 0, min: 0, max: 50 }
      },
      general: {
        prefix: { type: 'string', default: '!', maxLength: 5 },
        locale: { type: 'string', default: 'en-US' },
        timezone: { type: 'string', default: 'UTC' }
      }
    };
  }
  
  /**
   * Get a guild's configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Guild configuration
   */
  async getGuildConfig(guildId) {
    // Check cache first
    if (this.cache.has(guildId)) {
      return this.cache.get(guildId);
    }
    
    try {
      // Get config from database
      const result = await this.db.query(
        'SELECT * FROM guild_configs WHERE guild_id = $1',
        [guildId]
      );
      
      if (result.rows.length === 0) {
        // Create new config with defaults
        const defaultConfig = this.getDefaultConfig();
        await this.db.query(
          'INSERT INTO guild_configs (guild_id, config) VALUES ($1, $2)',
          [guildId, JSON.stringify(defaultConfig)]
        );
        
        this.cache.set(guildId, defaultConfig);
        return defaultConfig;
      }
      
      // Parse stored config
      const config = result.rows[0].config;
      
      // Add any missing keys from schema
      const fullConfig = this.applyDefaults(config);
      
      // Update cache
      this.cache.set(guildId, fullConfig);
      
      return fullConfig;
    } catch (error) {
      logger.error('Error getting guild config:', error);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    // Generate default config from schema
    const defaultConfig = {};
    
    for (const [section, settings] of Object.entries(this.schema)) {
      defaultConfig[section] = {};
      
      for (const [key, definition] of Object.entries(settings)) {
        if (definition.default !== undefined) {
          defaultConfig[section][key] = definition.default;
        } else {
          defaultConfig[section][key] = null;
        }
      }
    }
    
    return defaultConfig;
  }
  
  /**
   * Apply default values to any missing settings
   * @param {Object} config - Guild configuration
   * @returns {Object} Configuration with defaults applied
   */
  applyDefaults(config) {
    // Apply default values to any missing settings
    const result = { ...config };
    
    for (const [section, settings] of Object.entries(this.schema)) {
      if (!result[section]) {
        result[section] = {};
      }
      
      for (const [key, definition] of Object.entries(settings)) {
        if (result[section][key] === undefined && definition.default !== undefined) {
          result[section][key] = definition.default;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Update a guild configuration setting
   * @param {string} guildId - Guild ID
   * @param {string} section - Configuration section
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<boolean>} Success status
   */
  async updateGuildConfig(guildId, section, key, value) {
    try {
      // Validate input
      if (!this.schema[section] || !this.schema[section][key]) {
        throw new Error(`Invalid config path: ${section}.${key}`);
      }
      
      // Validate value against schema
      this.validateValue(section, key, value);
      
      // Get current config
      const config = await this.getGuildConfig(guildId);
      
      // Update value
      if (!config[section]) {
        config[section] = {};
      }
      
      config[section][key] = value;
      
      // Save to database
      await this.db.query(
        'UPDATE guild_configs SET config = $1, updated_at = NOW() WHERE guild_id = $2',
        [JSON.stringify(config), guildId]
      );
      
      // Update cache
      this.cache.set(guildId, config);
      
      return true;
    } catch (error) {
      logger.error('Error updating guild config:', error);
      throw error;
    }
  }
  
  /**
   * Update multiple guild configuration settings
   * @param {string} guildId - Guild ID
   * @param {Object} updates - Configuration updates
   * @returns {Promise<boolean>} Success status
   */
  async bulkUpdateConfig(guildId, updates) {
    try {
      // Get current config
      const config = await this.getGuildConfig(guildId);
      
      // Apply updates
      for (const [section, sectionUpdates] of Object.entries(updates)) {
        if (!config[section]) {
          config[section] = {};
        }
        
        for (const [key, value] of Object.entries(sectionUpdates)) {
          // Validate if schema exists for this path
          if (this.schema[section] && this.schema[section][key]) {
            // Validate value
            this.validateValue(section, key, value);
            config[section][key] = value;
          }
        }
      }
      
      // Save to database
      await this.db.query(
        'UPDATE guild_configs SET config = $1, updated_at = NOW() WHERE guild_id = $2',
        [JSON.stringify(config), guildId]
      );
      
      // Update cache
      this.cache.set(guildId, config);
      
      return true;
    } catch (error) {
      logger.error('Error bulk updating guild config:', error);
      throw error;
    }
  }
  
  /**
   * Validate a configuration value against schema
   * @param {string} section - Configuration section
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @throws {Error} Validation error
   */
  validateValue(section, key, value) {
    const definition = this.schema[section][key];
    
    // Check type
    if (definition.type === 'string' && typeof value !== 'string') {
      throw new Error(`${section}.${key} must be a string`);
    }
    
    if (definition.type === 'number' && typeof value !== 'number') {
      throw new Error(`${section}.${key} must be a number`);
    }
    
    // Check constraints
    if (definition.type === 'string' && definition.maxLength && value.length > definition.maxLength) {
      throw new Error(`${section}.${key} must be at most ${definition.maxLength} characters`);
    }
    
    if (definition.type === 'number') {
      if (definition.min !== undefined && value < definition.min) {
        throw new Error(`${section}.${key} must be at least ${definition.min}`);
      }
      
      if (definition.max !== undefined && value > definition.max) {
        throw new Error(`${section}.${key} must be at most ${definition.max}`);
      }
    }
    
    // Check required
    if (definition.required && (value === null || value === undefined || value === '')) {
      throw new Error(`${section}.${key} is required`);
    }
  }
  
  /**
   * Export guild configuration
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Exported configuration
   */
  async exportConfig(guildId) {
    const config = await this.getGuildConfig(guildId);
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      guild_id: guildId,
      config
    };
  }
  
  /**
   * Import guild configuration
   * @param {string} guildId - Guild ID
   * @param {Object} importData - Import data
   * @returns {Promise<boolean>} Success status
   */
  async importConfig(guildId, importData) {
    // Validate import data
    if (!importData.version || !importData.config) {
      throw new Error('Invalid import data format');
    }
    
    // Check version compatibility
    if (importData.version !== '1.0') {
      throw new Error(`Unsupported import version: ${importData.version}`);
    }
    
    // Validate all settings
    for (const [section, settings] of Object.entries(importData.config)) {
      if (!this.schema[section]) continue;
      
      for (const [key, value] of Object.entries(settings)) {
        if (!this.schema[section][key]) continue;
        
        this.validateValue(section, key, value);
      }
    }
    
    // Get current config
    const currentConfig = await this.getGuildConfig(guildId);
    
    // Merge configs
    const mergedConfig = { ...currentConfig };
    
    for (const [section, settings] of Object.entries(importData.config)) {
      if (!mergedConfig[section]) {
        mergedConfig[section] = {};
      }
      
      Object.assign(mergedConfig[section], settings);
    }
    
    // Save to database
    await this.db.query(
      'UPDATE guild_configs SET config = $1, updated_at = NOW() WHERE guild_id = $2',
      [JSON.stringify(mergedConfig), guildId]
    );
    
    // Update cache
    this.cache.set(guildId, mergedConfig);
    
    return true;
  }
  
  /**
   * Reset guild configuration to defaults
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async resetGuildConfig(guildId) {
    const defaultConfig = this.getDefaultConfig();
    
    // Save to database
    await this.db.query(
      'UPDATE guild_configs SET config = $1, updated_at = NOW() WHERE guild_id = $2',
      [JSON.stringify(defaultConfig), guildId]
    );
    
    // Update cache
    this.cache.set(guildId, defaultConfig);
    
    return true;
  }
}

// Export the class properly
module.exports = ConfigService;