const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { db } = require('../../database/Database');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a new support ticket')
    .addStringOption(option =>
      option
        .setName('category')
        .setDescription('Category for your ticket')
        .setRequired(false)
        .addChoices(
          { name: 'General Support', value: 'general' },
          { name: 'Order Issue', value: 'order' },
          { name: 'Payment Problem', value: 'payment' },
          { name: 'Technical Support', value: 'technical' },
          { name: 'Other', value: 'other' }
        )
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Brief description of your issue')
        .setRequired(false)
        .setMaxLength(500)
    ),
  
  category: 'tickets',
  cooldown: 10,
  
  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('This command can only be used in a server!');
        return;
      }

      const userId = interaction.user.id;
      const ticketCategory = interaction.options.getString('category') || 'general';
      const description = interaction.options.getString('description') || 'No description provided';

      // Check if user has too many open tickets
      const openTicketsResult = await db.query(
        'SELECT COUNT(*) FROM tickets WHERE user_id = $1 AND guild_id = $2 AND status = $3',
        [userId, guild.id, 'open']
      );

      const openTicketCount = parseInt(openTicketsResult.rows[0].count);
      
      // Get guild config
      const configResult = await db.query(
        'SELECT * FROM ticket_config WHERE guild_id = $1',
        [guild.id]
      );

      const config = configResult.rows[0] || { max_open_tickets: 5, ticket_prefix: 'TICKET' };

      if (openTicketCount >= (config.max_open_tickets || 5)) {
        await interaction.editReply(
          `You already have ${openTicketCount} open tickets. Please close some before creating new ones.`
        );
        return;
      }

      // Generate ticket ID
      const ticketNumber = await getNextTicketNumber(guild.id);
      const ticketId = `${config.ticket_prefix}-${ticketNumber.toString().padStart(4, '0')}`;

      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: `🎫-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: config.ticket_category_id || undefined,
        topic: `Support ticket for ${interaction.user.tag} | Category: ${ticketCategory}`,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
      });

      // Add support role permissions if configured
      if (config.support_role_id) {
        await ticketChannel.permissionOverwrites.create(config.support_role_id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          ManageMessages: true,
        });
      }

      // Save ticket to database
      await db.query(
        `INSERT INTO tickets (ticket_id, guild_id, user_id, channel_id, category, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ticketId, guild.id, userId, ticketChannel.id, ticketCategory, 'open']
      );

      // Create welcome embed
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 ${ticketId}`)
        .setDescription(config.welcome_message || 'Thank you for creating a ticket! Our support team will be with you shortly.')
        .addFields(
          { name: 'Category', value: ticketCategory, inline: true },
          { name: 'Created by', value: `<@${userId}>`, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true },
          { name: 'Description', value: description }
        )
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: 'Igloo Support System' });

      // Create action buttons
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('Claim Ticket')
            .setEmoji('👋')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('ticket_delete')
            .setLabel('Delete Ticket')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
        );

      // Send welcome message to ticket channel
      await ticketChannel.send({
        content: config.support_role_id ? `<@&${config.support_role_id}>` : undefined,
        embeds: [welcomeEmbed],
        components: [actionRow],
      });

      // Send confirmation to user
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Ticket Created')
        .setDescription(`Your ticket has been created successfully!`)
        .addFields(
          { name: 'Ticket ID', value: ticketId, inline: true },
          { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed] });

      // Log ticket creation
      logger.info(`Ticket created: ${ticketId} by ${interaction.user.tag} in ${guild.name}`);

      // Send log to log channel if configured
      if (config.log_channel_id) {
        const logChannel = guild.channels.cache.get(config.log_channel_id);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📋 New Ticket Created')
            .addFields(
              { name: 'Ticket ID', value: ticketId, inline: true },
              { name: 'User', value: `<@${userId}>`, inline: true },
              { name: 'Category', value: ticketCategory, inline: true },
              { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
            )
            .setColor(0x0099FF)
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      }

    } catch (error) {
      logger.error('Error creating ticket:', error);
      await interaction.editReply(
        'An error occurred while creating your ticket. Please try again later.'
      );
    }
  }
};

async function getNextTicketNumber(guildId) {
  const result = await db.query(
    'SELECT COUNT(*) FROM tickets WHERE guild_id = $1',
    [guildId]
  );
  return parseInt(result.rows[0].count) + 1;
}
