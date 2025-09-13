const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/Database');
const { createTranscript } = require('../../utils/transcript');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for closing')
        .setRequired(false)
    ),
  
  category: 'tickets',
  cooldown: 5,
  
  async execute(interaction) {
    // Check if in ticket channel
    const ticketResult = await db.query(
      'SELECT * FROM tickets WHERE channel_id = $1',
      [interaction.channel.id]
    );

    if (ticketResult.rows.length === 0) {
      return interaction.reply({
        content: 'This command can only be used in ticket channels!',
        ephemeral: true
      });
    }

    const ticket = ticketResult.rows[0];
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Create transcript
    const transcript = await createTranscript(interaction.channel);

    // Send transcript to user
    const user = await interaction.client.users.fetch(ticket.user_id);
    try {
      await user.send({
        content: `Your ticket ${ticket.ticket_id} has been closed.`,
        files: [transcript]
      });
    } catch (err) {
      // User DMs might be closed
    }

    // Update database
    await db.query(
      `UPDATE tickets 
       SET status = 'closed', 
           closed_by = $1,
           closed_reason = $2,
           closed_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [interaction.user.id, reason, ticket.id]
    );

    await interaction.reply('Ticket will be closed in 5 seconds...');

    setTimeout(async () => {
      await interaction.channel.delete(`Closed by ${interaction.user.tag}: ${reason}`);
    }, 5000);
  }
};