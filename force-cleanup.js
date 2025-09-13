require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function forceCleanup() {
  try {
    console.log('Force deleting ALL tickets...');
    
    // Delete ALL tickets from the database
    const deleteResult = await pool.query("DELETE FROM tickets");
    console.log(`Deleted ${deleteResult.rowCount} tickets total`);
    
    // Verify they're gone
    const checkResult = await pool.query("SELECT COUNT(*) as count FROM tickets");
    console.log(`Tickets remaining: ${checkResult.rows[0].count}`);
    
    console.log('Database cleaned!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

forceCleanup();