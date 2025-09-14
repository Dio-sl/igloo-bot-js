// Add guild_config table to the database
const { Database, db } = require('../src/database/Database');
const { logger } = require('../src/utils/logger');

async function updateDatabase() {
  try {
    // Connect to database
    if (!db.connected) {
      await db.connect();
    }

    // Create guild_config table if it doesn't exist
    await createGuildConfigTable();

    logger.info('Database update completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database update failed:', error);
    process.exit(1);
  }
}

async function createGuildConfigTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS guild_config (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(20) UNIQUE NOT NULL,
      ticket_category_id VARCHAR(20),
      support_role_id VARCHAR(20),
      log_channel_id VARCHAR(20),
      shop_channel_id VARCHAR(20),
      customer_role_id VARCHAR(20),
      announcement_channel_id VARCHAR(20),
      auto_close_hours INTEGER DEFAULT 72,
      max_open_tickets INTEGER DEFAULT 5,
      welcome_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id);
  `;

  try {
    await db.query(query);
    logger.info('guild_config table created or verified');
  } catch (error) {
    logger.error('Error creating guild_config table:', error);
    throw error;
  }
}

// Run the update
updateDatabase();