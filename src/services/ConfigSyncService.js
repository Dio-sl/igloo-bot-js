// src/services/ConfigSyncService.js
const { logger } = require('../utils/logger');
const { db } = require('../database/Database');

/**
 * Service for syncing configuration between setup wizard and commands
 */
class ConfigSyncService {
  /**
   * Create a new ConfigSyncService
   * @param {ConfigService} configService - Configuration service
   */
  constructor(configService) {
    this.configService = configService;
    this.db = db;
  }

  /**
   * Sync ticket settings with the ticket_config table
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async syncTicketSettings(guildId) {
    try {
      // Get current guild config
      const guildConfig = await this.configService.getGuildConfig(guildId);
      const ticketConfig = guildConfig.tickets || {};

      // Check if ticket_config record exists
      const existingResult = await this.db.query(
        'SELECT * FROM ticket_config WHERE guild_id = $1',
        [guildId]
      );

      if (existingResult.rows.length === 0) {
        // Create new record
        await this.db.query(`
          INSERT INTO ticket_config (
            guild_id, 
            ticket_category_id, 
            support_role_id, 
            log_channel_id, 
            auto_close_hours,
            max_open_tickets,
            ticket_prefix
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          guildId,
          ticketConfig.category || null,
          ticketConfig.support_role || null,
          ticketConfig.log_channel || null,
          ticketConfig.auto_close_hours || 72,
          ticketConfig.max_open_tickets || 5,
          'TICKET' // Default prefix
        ]);

        logger.info(`Created ticket_config for guild ${guildId}`);
        return true;
      } else {
        // Update existing record
        await this.db.query(`
          UPDATE ticket_config SET
            ticket_category_id = $2,
            support_role_id = $3,
            log_channel_id = $4,
            auto_close_hours = $5,
            max_open_tickets = $6,
            updated_at = NOW()
          WHERE guild_id = $1
        `, [
          guildId,
          ticketConfig.category || null,
          ticketConfig.support_role || null,
          ticketConfig.log_channel || null,
          ticketConfig.auto_close_hours || 72,
          ticketConfig.max_open_tickets || 5
        ]);

        logger.info(`Updated ticket_config for guild ${guildId}`);
        return true;
      }
    } catch (error) {
      logger.error('Error syncing ticket settings:', error);
      return false;
    }
  }

  /**
   * Sync shop settings with the shop_config table
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async syncShopSettings(guildId) {
    try {
      // Get current guild config
      const guildConfig = await this.configService.getGuildConfig(guildId);
      const shopConfig = guildConfig.shop || {};

      // Check if shop_config table exists (may not be implemented yet)
      try {
        const tableExists = await this.db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'shop_config'
          )
        `);

        if (!tableExists.rows[0].exists) {
          logger.warn('shop_config table does not exist yet. Skipping shop settings sync.');
          return false;
        }
      } catch (error) {
        logger.warn('Could not check if shop_config table exists:', error.message);
        return false;
      }

      // Check if shop_config record exists
      const existingResult = await this.db.query(
        'SELECT * FROM shop_config WHERE guild_id = $1',
        [guildId]
      );

      if (existingResult.rows.length === 0) {
        // Create new record
        await this.db.query(`
          INSERT INTO shop_config (
            guild_id, 
            shop_channel_id, 
            customer_role_id, 
            currency,
            tax_rate
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          guildId,
          shopConfig.channel || null,
          shopConfig.customer_role || null,
          shopConfig.currency || 'USD',
          shopConfig.tax_rate || 0
        ]);

        logger.info(`Created shop_config for guild ${guildId}`);
        return true;
      } else {
        // Update existing record
        await this.db.query(`
          UPDATE shop_config SET
            shop_channel_id = $2,
            customer_role_id = $3,
            currency = $4,
            tax_rate = $5,
            updated_at = NOW()
          WHERE guild_id = $1
        `, [
          guildId,
          shopConfig.shop_channel || null,
          shopConfig.customer_role || null,
          shopConfig.currency || 'USD',
          shopConfig.tax_rate || 0
        ]);

        logger.info(`Updated shop_config for guild ${guildId}`);
        return true;
      }
    } catch (error) {
      logger.error('Error syncing shop settings:', error);
      return false;
    }
  }

  /**
   * Sync command settings back to the main config
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async syncCommandSettingsToConfig(guildId) {
    try {
      // Get current guild config
      const guildConfig = await this.configService.getGuildConfig(guildId);
      
      // Sync ticket_config to main config
      try {
        const ticketConfigResult = await this.db.query(
          'SELECT * FROM ticket_config WHERE guild_id = $1',
          [guildId]
        );

        if (ticketConfigResult.rows.length > 0) {
          const ticketConfig = ticketConfigResult.rows[0];
          
          // Update guild config with values from ticket_config
          await this.configService.bulkUpdateConfig(guildId, {
            tickets: {
              category: ticketConfig.ticket_category_id,
              support_role: ticketConfig.support_role_id,
              log_channel: ticketConfig.log_channel_id,
              auto_close_hours: ticketConfig.auto_close_hours,
              max_open_tickets: ticketConfig.max_open_tickets
            }
          });
          
          logger.info(`Synced ticket_config back to main config for guild ${guildId}`);
        }
      } catch (error) {
        logger.error('Error syncing ticket_config to main config:', error);
      }
      
      // Sync shop_config to main config if it exists
      try {
        const tableExists = await this.db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'shop_config'
          )
        `);

        if (tableExists.rows[0].exists) {
          const shopConfigResult = await this.db.query(
            'SELECT * FROM shop_config WHERE guild_id = $1',
            [guildId]
          );

          if (shopConfigResult.rows.length > 0) {
            const shopConfig = shopConfigResult.rows[0];
            
            // Update guild config with values from shop_config
            await this.configService.bulkUpdateConfig(guildId, {
              shop: {
                channel: shopConfig.shop_channel_id,
                customer_role: shopConfig.customer_role_id,
                currency: shopConfig.currency,
                tax_rate: shopConfig.tax_rate
              }
            });
            
            logger.info(`Synced shop_config back to main config for guild ${guildId}`);
          }
        }
      } catch (error) {
        logger.error('Error syncing shop_config to main config:', error);
      }
      
      return true;
    } catch (error) {
      logger.error('Error syncing command settings to config:', error);
      return false;
    }
  }

  /**
   * Sync all settings in both directions
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async syncAll(guildId) {
    try {
      // First sync config to command tables
      await this.syncTicketSettings(guildId);
      await this.syncShopSettings(guildId);
      
      // Then sync command tables back to config (to handle any differences)
      await this.syncCommandSettingsToConfig(guildId);
      
      logger.info(`Successfully synced all settings for guild ${guildId}`);
      return true;
    } catch (error) {
      logger.error('Error syncing all settings:', error);
      return false;
    }
  }
}

module.exports = ConfigSyncService;