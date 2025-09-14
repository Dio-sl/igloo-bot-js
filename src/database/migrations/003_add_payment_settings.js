// src/database/migrations/003_add_payment_settings.js

/**
 * Add payment settings migration
 */
module.exports = {
  name: 'Add Payment Settings',
  
  /**
   * Apply the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async up(db) {
    // Create payment_providers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_providers (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT false,
        credentials JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_payment_providers_guild_id ON payment_providers(guild_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_providers_guild_provider ON payment_providers(guild_id, provider);
    `);
    
    // Create payment_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        order_id VARCHAR(20),
        provider VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) NOT NULL,
        payment_id VARCHAR(100),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_payment_logs_guild_id ON payment_logs(guild_id);
      CREATE INDEX IF NOT EXISTS idx_payment_logs_order_id ON payment_logs(order_id);
    `);
    
    // Add payment settings to guild_configs
    await db.query(`
      UPDATE guild_configs
      SET config = config || '{"payment":{"currency":"USD","tax_rate":0,"business_name":"","business_address":"","receipt_footer":"","stripe_enabled":false,"paypal_enabled":false}}'::jsonb
      WHERE (config->'payment') IS NULL;
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
      DROP TABLE IF EXISTS payment_logs;
      DROP TABLE IF EXISTS payment_providers;
    `);
    
    // Remove payment settings from guild_configs
    await db.query(`
      UPDATE guild_configs
      SET config = config - 'payment'
      WHERE (config->'payment') IS NOT NULL;
    `);
  }
};