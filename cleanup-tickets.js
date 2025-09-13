require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanupTickets() {
  try {
    // Show all open tickets
    const result = await pool.query(`
      SELECT ticket_id, user_id, channel_id, created_at 
      FROM tickets 
      WHERE status = 'open'
    `);
    
    console.log('Open tickets in database:', result.rows);
    
    // Delete tickets for your user ID
    const yourUserId = 'YOUR_DISCORD_ID'; // Replace with your actual Discord ID
    
    const deleteResult = await pool.query(
      "DELETE FROM tickets WHERE user_id = $1 AND status = 'open'",
      [yourUserId]
    );
    
    console.log(`Deleted ${deleteResult.rowCount} tickets`);
    
    // Or delete ALL tickets to start fresh
    // const deleteAll = await pool.query("DELETE FROM tickets");
    // console.log(`Deleted all ${deleteAll.rowCount} tickets`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

cleanupTickets();