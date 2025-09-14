// src/database/migrations/001_initial_schema.js

/**
 * Initial database schema migration
 */
module.exports = {
  name: 'Initial Schema',
  
  /**
   * Apply the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async up(db) {
    // Create guild_configs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_configs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_guild_configs_guild_id ON guild_configs(guild_id);
    `);
    
    // Create tickets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        ticket_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) UNIQUE NOT NULL,
        category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'open',
        claimed_by VARCHAR(20),
        closed_by VARCHAR(20),
        closed_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP,
        priority VARCHAR(20) DEFAULT 'normal',
        auto_close_at TIMESTAMP,
        transcript_url TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON tickets(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
    `);
    
    // Create ticket_messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        content TEXT,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
    `);
    
    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(100),
        email VARCHAR(255),
        total_tickets INTEGER DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        total_spent DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        banned BOOLEAN DEFAULT false,
        ban_reason TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
    `);
    
    // Create staff table
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        tickets_handled INTEGER DEFAULT 0,
        average_response_time INTEGER,
        rating DECIMAL(3, 2),
        permissions JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_staff_guild_id ON staff(guild_id);
      CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
    `);
  },
  
  /**
   * Revert the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async down(db) {
    // Drop tables in reverse order to avoid foreign key conflicts
    await db.query(`
      DROP TABLE IF EXISTS staff;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS ticket_messages;
      DROP TABLE IF EXISTS tickets;
      DROP TABLE IF EXISTS guild_configs;
    `);
  }
};