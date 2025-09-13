require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { logger } = require('./utils/logger');
const { validateEnv } = require('./utils/validateEnv');
const { Database } = require('./database/Database');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

// Validate environment variables
validateEnv();

// Create bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();

// Initialize database
const database = new Database();

// Auto-close function
async function checkInactiveTickets() {
  try {
    logger.info('Checking for inactive tickets...');
    
    // Get tickets inactive for 72 hours
    const result = await database.query(`
      SELECT * FROM tickets 
      WHERE status = 'open' 
      AND updated_at < NOW() - INTERVAL '72 hours'
    `);

    if (result.rows.length === 0) {
      logger.info('No inactive tickets found');
      return;
    }

    logger.info(`Found ${result.rows.length} inactive tickets`);

    for (const ticket of result.rows) {
      try {
        const channel = await client.channels.fetch(ticket.channel_id);
        if (channel) {
          await channel.send({
            content: '⚠️ **Auto-Close Warning**\nThis ticket has been inactive for 72 hours and will be closed automatically in 5 minutes.\nSend a message to keep it open.'
          });

          // Schedule closure after 5 minutes
          setTimeout(async () => {
            try {
              // Check if ticket is still inactive
              const checkResult = await database.query(
                'SELECT updated_at FROM tickets WHERE id = $1 AND status = $2',
                [ticket.id, 'open']
              );

              if (checkResult.rows.length > 0) {
                const lastUpdate = new Date(checkResult.rows[0].updated_at);
                const now = new Date();
                const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

                if (hoursSinceUpdate >= 72) {
                  // Still inactive, close it
                  await channel.delete('Auto-closed due to inactivity');
                  await database.query(
                    `UPDATE tickets 
                     SET status = 'closed', 
                         closed_by = $1,
                         closed_reason = 'Auto-closed due to inactivity',
                         closed_at = CURRENT_TIMESTAMP 
                     WHERE id = $2`,
                    [client.user.id, ticket.id]
                  );
                  logger.info(`Auto-closed ticket ${ticket.ticket_id} due to inactivity`);
                } else {
                  logger.info(`Ticket ${ticket.ticket_id} became active, skipping auto-close`);
                }
              }
            } catch (err) {
              logger.error('Error during auto-close execution:', err);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      } catch (err) {
        // Channel might not exist anymore
        logger.warn(`Channel for ticket ${ticket.ticket_id} not found, cleaning up database`);
        await database.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
      }
    }
  } catch (error) {
    logger.error('Error checking inactive tickets:', error);
  }
}

// Handle process events
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  client.destroy();
  await database.close();
  process.exit(0);
});

// Start the bot
async function start() {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database connected successfully');

    // Load commands and events
    await loadCommands(client);
    await loadEvents(client);

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    
    // Set up auto-close check interval (runs every hour)
    setInterval(() => {
      checkInactiveTickets();
    }, 60 * 60 * 1000); // 1 hour

    // Run initial check 30 seconds after startup
    setTimeout(() => {
      logger.info('Running initial inactive ticket check...');
      checkInactiveTickets();
    }, 30000); // 30 seconds
    
    logger.info('Auto-close check scheduled (every hour)');
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();

// === Global logging hooks ===
client.on(Events.InteractionCreate, (i) => {
  const kind = i.isChatInputCommand() ? 'slash' :
               i.isButton() ? 'button' :
               (i.isStringSelectMenu && i.isStringSelectMenu()) ? 'stringSelect' :
               'other';
  const id = i.customId || i.commandName || '(no id)';
  console.log(`[INT] ${kind} → ${id}`);
});

client.on('error', (e) => console.error('[CLIENT ERROR]', e));
client.on('shardError', (e) => console.error('[SHARD ERROR]', e));
process.on('unhandledRejection', (e) => console.error('[UNHANDLED REJECTION]', e));
process.on('uncaughtException', (e) => console.error('[UNCAUGHT EXCEPTION]', e));
