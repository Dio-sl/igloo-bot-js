const { Pool } = require('pg');
const { logger } = require('../utils/logger');

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.connected = false;

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.connected = true;
      logger.info('Database connection established');

      // Initialize tables
      await this.initializeTables();
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
    this.connected = false;
    logger.info('Database connection closed');
  }

  async query(text, params) {
    // Try to reconnect if not connected
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        throw new Error('Database not connected');
      }
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn(`Slow query (${duration}ms): ${text.substring(0, 50)}...`);
      }

      return result;
    } catch (error) {
      logger.error('Query error:', { text, params, error: error.message });
      throw error;
    }
  }

  async getClient() {
    return this.pool.connect();
  }

  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initializeTables() {
    try {
      // Create tables if they don't exist
      await this.createTicketsTable();
      await this.createTicketMessagesTable();
      await this.createTicketConfigTable();
      await this.createUsersTable();
      await this.createStaffTable();

      logger.info('Database tables initialized');
    } catch (error) {
      logger.error('Failed to initialize tables:', error);
      throw error;
    }
  }

  async createTicketsTable() {
    const query = `
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
    `;

    await this.query(query);
  }

  async createTicketMessagesTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        content TEXT,
        attachments JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
    `;

    await this.query(query);
  }

  async createTicketConfigTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ticket_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        ticket_category_id VARCHAR(20),
        support_role_id VARCHAR(20),
        log_channel_id VARCHAR(20),
        auto_close_hours INTEGER DEFAULT 72,
        max_open_tickets INTEGER DEFAULT 5,
        ticket_prefix VARCHAR(10) DEFAULT 'TICKET',
        welcome_message TEXT,
        close_message TEXT,
        categories JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.query(query);
  }

  async createUsersTable() {
    const query = `
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
    `;

    await this.query(query);
  }

  async createStaffTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        tickets_handled INTEGER DEFAULT 0,
        average_response_time INTEGER, -- in minutes
        rating DECIMAL(3, 2),
        permissions JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_staff_guild_id ON staff(guild_id);
      CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
    `;

    await this.query(query);
  }
}

// Export singleton instance
const db = new Database();
module.exports = { Database, db };
