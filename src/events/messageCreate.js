const { Events } = require('discord.js');
const { db } = require('../database/Database');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in a ticket channel
    try {
      const result = await db.query(
        'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE channel_id = $1 AND status = $2',
        [message.channel.id, 'open']
      );
      
      // If a ticket was updated, log it (optional)
      if (result.rowCount > 0) {
        console.log(`Updated activity for ticket in channel ${message.channel.name}`);
      }
    } catch (error) {
      // Silently ignore - most messages won't be in ticket channels
    }
  }
};