// src/scripts/sync-settings.js
const { logger } = require('../utils/logger');
const { Database } = require('../database/Database');
const ConfigService = require('../services/ConfigService');
const ConfigSyncService = require('../services/ConfigSyncService');

/**
 * Synchronize all settings between config and command tables
 */
async function syncAllSettings() {
  try {
    logger.info('Starting settings synchronization...');
    
    // Initialize database connection
    const database = new Database();
    await database.connect();
    
    // Initialize services
    const configService = new ConfigService(database);
    const configSyncService = new ConfigSyncService(configService);
    
    // Get all guilds from the database
    const guildsResult = await database.query('SELECT DISTINCT guild_id FROM guild_configs');
    
    if (guildsResult.rows.length === 0) {
      logger.info('No guilds found to synchronize settings for.');
      return;
    }
    
    // Sync settings for each guild
    for (const guild of guildsResult.rows) {
      const guildId = guild.guild_id;
      logger.info(`Synchronizing settings for guild ${guildId}...`);
      
      try {
        await configSyncService.syncAll(guildId);
        logger.info(`Successfully synchronized settings for guild ${guildId}`);
      } catch (error) {
        logger.error(`Error synchronizing settings for guild ${guildId}:`, error);
      }
    }
    
    logger.info('Settings synchronization completed');
    
    // Close database connection
    await database.close();
  } catch (error) {
    logger.error('Error during settings synchronization:', error);
  }
}

// Export for direct running
if (require.main === module) {
  syncAllSettings()
    .then(() => process.exit(0))
    .catch(error => {
      logger.error('Unhandled error during settings sync:', error);
      process.exit(1);
    });
}

// Export for importing
module.exports = { syncAllSettings };
