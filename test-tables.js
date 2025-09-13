require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTables() {
  try {
    console.log('Checking database tables...\n');
    
    // Check what tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables found:', result.rows.map(r => r.table_name));
    
    // Check if tickets table exists and has data
    try {
      const tickets = await pool.query('SELECT COUNT(*) FROM tickets');
      console.log('Tickets table exists with', tickets.rows[0].count, 'records');
    } catch (e) {
      console.log('Tickets table error:', e.message);
    }
    
    // Check ticket_config
    try {
      const config = await pool.query('SELECT COUNT(*) FROM ticket_config');
      console.log('Ticket config table exists with', config.rows[0].count, 'records');
    } catch (e) {
      console.log('Ticket config table error:', e.message);
    }
    
  } catch (error) {
    console.log('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();