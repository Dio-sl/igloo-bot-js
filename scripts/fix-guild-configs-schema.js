// fix-guild-configs-schema.js
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

async function fixGuildConfigsSchema() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Check if the guild_configs table exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'guild_configs'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      // Create the guild_configs table if it doesn't exist
      console.log('Creating guild_configs table...');
      await client.query(`
        CREATE TABLE guild_configs (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(20) NOT NULL UNIQUE,
          config JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_guild_configs_guild_id ON guild_configs(guild_id);
      `);
      console.log('guild_configs table created successfully!');
    } else {
      // Table exists, check if config column exists
      const columnCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'guild_configs' 
          AND column_name = 'config'
        );
      `);
      
      const configColumnExists = columnCheckResult.rows[0].exists;
      
      if (!configColumnExists) {
        // Check if there's a "configuration" or "settings" column (possible misnaming)
        const altColumnCheckResult = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'guild_configs' 
          AND column_name IN ('configuration', 'settings', 'data');
        `);
        
        if (altColumnCheckResult.rows.length > 0) {
          // There's an alternatively named column, rename it to config
          const altColumnName = altColumnCheckResult.rows[0].column_name;
          console.log(`Found alternative column "${altColumnName}", renaming to "config"...`);
          await client.query(`ALTER TABLE guild_configs RENAME COLUMN ${altColumnName} TO config;`);
          console.log('Column renamed successfully!');
        } else {
          // Add the config column
          console.log('Adding config column to guild_configs table...');
          await client.query(`ALTER TABLE guild_configs ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::jsonb;`);
          console.log('Config column added successfully!');
        }
      } else {
        console.log('The config column already exists in the guild_configs table.');
      }
    }
    
    // Ensure created_at and updated_at columns exist
    const timeColumnsCheckResult = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'guild_configs' 
      AND column_name IN ('created_at', 'updated_at');
    `);
    
    const existingTimeColumns = timeColumnsCheckResult.rows.map(row => row.column_name);
    
    if (!existingTimeColumns.includes('created_at')) {
      console.log('Adding created_at column...');
      await client.query(`ALTER TABLE guild_configs ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    }
    
    if (!existingTimeColumns.includes('updated_at')) {
      console.log('Adding updated_at column...');
      await client.query(`ALTER TABLE guild_configs ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Database schema fixed successfully!');
    
  } catch (error) {
    // Roll back the transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error fixing database schema:', error);
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
    await pool.end();
  }
}

// Run the fix
fixGuildConfigsSchema().catch(err => {
  console.error('Failed to fix database schema:', err);
  process.exit(1);
});