// src/database/migrations/004_sync_config_tables.js

/**
 * Create separate config tables for syncing
 */
module.exports = {
  name: 'Sync Config Tables',
  
  /**
   * Apply the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async up(db) {
    // Create ticket_config table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ticket_config (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        ticket_category_id VARCHAR(20),
        support_role_id VARCHAR(20),
        log_channel_id VARCHAR(20),
        auto_close_hours INTEGER DEFAULT 72,
        max_open_tickets INTEGER DEFAULT 5,
        ticket_prefix VARCHAR(20) DEFAULT 'TICKET',
        welcome_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_ticket_config_guild_id ON ticket_config(guild_id);
    `);
    
    // Create shop_config table (for future use)
    await db.query(`
      CREATE TABLE IF NOT EXISTS shop_config (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        shop_channel_id VARCHAR(20),
        customer_role_id VARCHAR(20),
        currency VARCHAR(3) DEFAULT 'USD',
        tax_rate DECIMAL(5, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_shop_config_guild_id ON shop_config(guild_id);
    `);
    
    // Populate tables from existing guild_configs
    await db.query(`
      INSERT INTO ticket_config (
        guild_id, 
        ticket_category_id, 
        support_role_id, 
        log_channel_id, 
        auto_close_hours,
        max_open_tickets
      )
      SELECT 
        guild_id,
        (config->'tickets'->>'category')::VARCHAR AS ticket_category_id,
        (config->'tickets'->>'support_role')::VARCHAR AS support_role_id,
        (config->'tickets'->>'log_channel')::VARCHAR AS log_channel_id,
        COALESCE((config->'tickets'->>'auto_close_hours')::INTEGER, 72) AS auto_close_hours,
        COALESCE((config->'tickets'->>'max_open_tickets')::INTEGER, 5) AS max_open_tickets
      FROM guild_configs
      ON CONFLICT (guild_id) DO NOTHING;
    `);
    
    await db.query(`
      INSERT INTO shop_config (
        guild_id, 
        shop_channel_id, 
        customer_role_id, 
        currency, 
        tax_rate
      )
      SELECT 
        guild_id,
        (config->'shop'->>'channel')::VARCHAR AS shop_channel_id,
        (config->'shop'->>'customer_role')::VARCHAR AS customer_role_id,
        COALESCE((config->'shop'->>'currency')::VARCHAR, 'USD') AS currency,
        COALESCE((config->'shop'->>'tax_rate')::DECIMAL, 0) AS tax_rate
      FROM guild_configs
      ON CONFLICT (guild_id) DO NOTHING;
    `);
  },
  
  /**
   * Revert the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async down(db) {
    // Drop tables
    await db.query(`
      DROP TABLE IF EXISTS shop_config;
      DROP TABLE IF EXISTS ticket_config;
    `);
  }
};