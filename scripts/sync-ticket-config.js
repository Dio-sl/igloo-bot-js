// sync-ticket-config.js
/**
 * This script synchronizes the ticket configuration between the guild_configs table (used by the setup wizard)
 * and the ticket_config table (used by the ticket creation system).
 */

const { Pool } = require('pg');
require('dotenv').config();

// Create a database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'igloobot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function syncTicketConfig() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Starting ticket configuration synchronization...');
    
    // Check if both tables exist
    const guildConfigsExists = await checkTableExists(client, 'guild_configs');
    const ticketConfigExists = await checkTableExists(client, 'ticket_config');
    
    if (!guildConfigsExists) {
      console.error('Error: guild_configs table does not exist. Please run the database setup script first.');
      return;
    }
    
    if (!ticketConfigExists) {
      console.log('ticket_config table does not exist. Creating it...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS ticket_config (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) UNIQUE NOT NULL,
          ticket_category_id VARCHAR(20),
          support_role_id VARCHAR(20),
          log_channel_id VARCHAR(20),
          max_open_tickets INTEGER DEFAULT 5,
          ticket_prefix VARCHAR(20) DEFAULT 'TICKET',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_ticket_config_guild_id ON ticket_config(guild_id);
      `);
      console.log('ticket_config table created.');
    }
    
    // Get all guild configurations
    const guildConfigsResult = await client.query(`
      SELECT guild_id, config FROM guild_configs
    `);
    
    let syncCount = 0;
    
    // Process each guild configuration
    for (const row of guildConfigsResult.rows) {
      const guildId = row.guild_id;
      const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      
      // Check if this guild has ticket configuration
      if (config && config.tickets) {
        const ticketConfig = config.tickets;
        
        // Check if this guild already has a ticket_config entry
        const existingConfigResult = await client.query(
          'SELECT id FROM ticket_config WHERE guild_id = $1',
          [guildId]
        );
        
        if (existingConfigResult.rows.length > 0) {
          // Update existing config
          await client.query(`
            UPDATE ticket_config
            SET 
              ticket_category_id = $1,
              support_role_id = $2,
              log_channel_id = $3,
              max_open_tickets = $4,
              updated_at = CURRENT_TIMESTAMP
            WHERE guild_id = $5
          `, [
            ticketConfig.category || null,
            ticketConfig.support_role || null,
            ticketConfig.log_channel || null,
            ticketConfig.max_open_tickets || 5,
            guildId
          ]);
          console.log(`Updated ticket configuration for guild ${guildId}`);
        } else {
          // Insert new config
          await client.query(`
            INSERT INTO ticket_config (
              guild_id, 
              ticket_category_id, 
              support_role_id, 
              log_channel_id, 
              max_open_tickets
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            guildId,
            ticketConfig.category || null,
            ticketConfig.support_role || null,
            ticketConfig.log_channel || null,
            ticketConfig.max_open_tickets || 5
          ]);
          console.log(`Created ticket configuration for guild ${guildId}`);
        }
        
        syncCount++;
      }
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log(`Synchronization complete. Processed ${syncCount} guild configurations.`);
    
    // Add a patching function to the ticket creation file
    console.log('Creating a patch for the ticket creation code...');
    await createTicketCodePatch();
    
  } catch (error) {
    // Roll back the transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error synchronizing ticket configuration:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
    await pool.end();
  }
}

/**
 * Check if a table exists in the database
 * @param {Object} client - Database client
 * @param {string} tableName - Table name to check
 * @returns {Promise<boolean>} True if table exists
 */
async function checkTableExists(client, tableName) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  
  return result.rows[0].exists;
}

/**
 * Create a patch file for the ticket creation code
 */
async function createTicketCodePatch() {
  const fs = require('fs');
  const path = require('path');
  
  // Define the patch file
  const patchFile = path.join(process.cwd(), 'ticket-code-patch.js');
  
  // Define the patch content
  const patchContent = `// ticket-code-patch.js
/**
 * This file contains code to patch the ticket creation to use both configuration systems.
 * Copy the getTicketConfig function to your main ticket creation file, and replace the
 * existing configuration retrieval code with a call to this function.
 */

/**
 * Get ticket configuration with fallback between systems
 * @param {Object} db - Database connection
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object>} Ticket configuration
 */
async function getTicketConfig(db, guildId) {
  try {
    // First try to get config from guild_configs (new system)
    const guildConfigResult = await db.query(
      'SELECT config FROM guild_configs WHERE guild_id = $1',
      [guildId]
    );
    
    if (guildConfigResult.rows.length > 0) {
      const config = typeof guildConfigResult.rows[0].config === 'string' 
        ? JSON.parse(guildConfigResult.rows[0].config) 
        : guildConfigResult.rows[0].config;
      
      if (config && config.tickets) {
        return {
          ticket_category_id: config.tickets.category,
          support_role_id: config.tickets.support_role,
          log_channel_id: config.tickets.log_channel,
          max_open_tickets: config.tickets.max_open_tickets || 5,
          ticket_prefix: config.tickets.ticket_prefix || 'TICKET',
          // Add any other fields you need from config.tickets
        };
      }
    }
    
    // Fallback to ticket_config table (old system)
    const ticketConfigResult = await db.query(
      'SELECT * FROM ticket_config WHERE guild_id = $1',
      [guildId]
    );
    
    if (ticketConfigResult.rows.length > 0) {
      return ticketConfigResult.rows[0];
    }
    
    // If no configuration found, return default values
    return {
      ticket_category_id: null,
      support_role_id: null,
      log_channel_id: null,
      max_open_tickets: 5,
      ticket_prefix: 'TICKET'
    };
  } catch (error) {
    console.error('Error getting ticket configuration:', error);
    
    // Return default values if an error occurs
    return {
      ticket_category_id: null,
      support_role_id: null,
      log_channel_id: null,
      max_open_tickets: 5,
      ticket_prefix: 'TICKET'
    };
  }
}

// Usage in your ticket creation code:
/*
// Replace code like:
const ticketConfigResult = await db.query(
  'SELECT * FROM ticket_config WHERE guild_id = $1',
  [guildId]
);
const ticketConfig = ticketConfigResult.rows[0] || { ... };

// With:
const ticketConfig = await getTicketConfig(db, guildId);
*/
`;
  
  // Write the patch file
  fs.writeFileSync(patchFile, patchContent);
  console.log(`Patch file created: ${patchFile}`);
  console.log('Copy the getTicketConfig function to your ticket creation code and use it to retrieve configuration.');
}

// Run the sync function
syncTicketConfig().catch(err => {
  console.error('Failed to synchronize ticket configuration:', err);
  process.exit(1);
});