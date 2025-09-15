// src/scripts/sync-wizard-commands.js
const { logger } = require('../utils/logger');
const { db } = require('../database/Database');
const ConfigService = require('../services/ConfigService');
const ConfigSyncService = require('../services/ConfigSyncService');

/**
 * Sync settings between wizard and commands for a specific guild
 * 
 * @param {string} guildId - Guild ID to sync settings for
 * @returns {Promise<boolean>} - Success status
 */
async function syncWizardAndCommands(guildId) {
  try {
    // Initialize services
    const configService = new ConfigService(db);
    const configSyncService = new ConfigSyncService(configService);
    
    // Sync settings
    await configSyncService.syncAll(guildId);
    
    logger.info(`Settings synchronized for guild ${guildId}`);
    return true;
  } catch (error) {
    logger.error(`Error syncing settings for guild ${guildId}:`, error);
    return false;
  }
}

module.exports = { syncWizardAndCommands };