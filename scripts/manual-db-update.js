// Create this as a new file: scripts/manual-db-update.js

const { Pool } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for database credentials
async function getDatabaseCredentials() {
  return new Promise((resolve) => {
    console.log("Enter your database connection details:");
    
    rl.question("Host (default: localhost): ", (host) => {
      host = host || 'localhost';
      
      rl.question("Port (default: 5432): ", (port) => {
        port = port || '5432';
        
        rl.question("Database name: ", (database) => {
          if (!database) {
            console.error("Database name is required");
            process.exit(1);
          }
          
          rl.question("Username: ", (username) => {
            if (!username) {
              console.error("Username is required");
              process.exit(1);
            }
            
            rl.question("Password: ", (password) => {
              rl.close();
              resolve({
                host,
                port,
                database,
                user: username,
                password
              });
            });
          });
        });
      });
    });
  });
}

async function createGuildConfigTable(pool) {
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
    await pool.query(query);
    console.log('guild_config table created or verified');
  } catch (error) {
    console.error('Error creating guild_config table:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log("===== Igloo Bot Database Update =====");
    const credentials = await getDatabaseCredentials();
    
    // Create a new database connection
    const pool = new Pool(credentials);
    
    // Test connection
    console.log("Testing database connection...");
    await pool.query('SELECT NOW()');
    console.log("Connection successful!");
    
    // Create tables
    console.log("Creating guild_config table...");
    await createGuildConfigTable(pool);
    
    console.log("Database update completed successfully!");
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Database update failed:", error);
    process.exit(1);
  }
}

main();