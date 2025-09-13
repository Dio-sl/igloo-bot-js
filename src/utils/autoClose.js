const { db } = require('../database/Database');
const { logger } = require('./logger');

async function checkInactiveTickets(client) {
    try {
        // Get tickets inactive for 72 hours
        const result = await db.query(`
      SELECT * FROM tickets 
      WHERE status = 'open' 
      AND updated_at < NOW() - INTERVAL '72 hours'
    `);

        for (const ticket of result.rows) {
            try {
                const channel = await client.channels.fetch(ticket.channel_id);
                if (channel) {
                    await channel.send({
                        content: '⚠️ This ticket has been inactive for 72 hours and will be closed automatically in 5 minutes.'
                    });

                    // Schedule closure
                    setTimeout(async () => {
                        try {
                            await channel.delete('Auto-closed due to inactivity');
                            await db.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
                            logger.info(`Auto-closed ticket ${ticket.ticket_id} due to inactivity`);
                        } catch (err) {
                            logger.error('Error auto-closing ticket:', err);
                        }
                    }, 5 * 60 * 1000); // 5 minutes
                }
            } catch (err) {
                // Channel might not exist
                await db.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
            }
        }
    } catch (error) {
        logger.error('Error checking inactive tickets:', error);
    }
}

module.exports = { checkInactiveTickets };