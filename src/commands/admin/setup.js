const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const { db } = require('../../database/Database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure ticket system for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Category for ticket channels')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addRoleOption(option =>
      option
        .setName('support_role')
        .setDescription('Role that can manage tickets')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('log_channel')
        .setDescription('Channel for ticket logs')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption(option =>
      option
        .setName('max_tickets')
        .setDescription('Max open tickets per user (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),
  
  category: 'admin',
  cooldown: 5,
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    const logChannel = interaction.options.getChannel('log_channel');
    const maxTickets = interaction.options.getInteger('max_tickets') || 5;

    try {
      // Check if config exists
      const existingConfig = await db.query(
        'SELECT * FROM ticket_config WHERE guild_id = $1',
        [interaction.guild.id]
      );

      if (existingConfig.rows.length > 0) {
        // Update existing config
        await db.query(
          `UPDATE ticket_config SET
           ticket_category_id = COALESCE($2, ticket_category_id),
           support_role_id = COALESCE($3, support_role_id),
           log_channel_id = COALESCE($4, log_channel_id),
           max_open_tickets = $5,
           updated_at = CURRENT_TIMESTAMP
           WHERE guild_id = $1`,
          [
            interaction.guild.id,
            category?.id,
            supportRole?.id,
            logChannel?.id,
            maxTickets,
          ]
        );
      } else {
        // Create new config
        await db.query(
          `INSERT INTO ticket_config (
            guild_id, 
            ticket_category_id, 
            support_role_id, 
            log_channel_id, 
            max_open_tickets
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            interaction.guild.id,
            category?.id,
            supportRole?.id,
            logChannel?.id,
            maxTickets,
          ]
        );
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Ticket System Configured')
        .setColor(0x00FF00)
        .addFields(
          { name: 'Ticket Category', value: category ? `<#${category.id}>` : 'Not set', inline: true },
          { name: 'Support Role', value: supportRole ? `<@&${supportRole.id}>` : 'Not set', inline: true },
          { name: 'Log Channel', value: logChannel ? `<#${logChannel.id}>` : 'Not set', inline: true },
          { name: 'Max Tickets/User', value: maxTickets.toString(), inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in setup command:', error);
      await interaction.editReply('An error occurred while configuring the ticket system.');
    }
  }
};