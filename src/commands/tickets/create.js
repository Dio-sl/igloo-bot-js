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

// Ice theme colors
const IGLOO_COLORS = {
  PRIMARY: 0x0CAFFF,    // Bright cyan blue - primary color
  SECONDARY: 0x87CEEB,  // Sky blue - secondary color
  SUCCESS: 0x7FFFD4,    // Aquamarine - success indicators
  DANGER: 0xE91E63,     // Pink-ish - danger/warning color
  DARK: 0x0A5C7A,       // Dark blue - background/text color
};

// Category-specific colors
const CATEGORY_COLORS = {
  'Buy': 0x4CAF50,           // Green
  'General Support': 0x2196F3, // Blue
  'Order Issues': 0xFF9800,    // Orange
  'Technical Support': 0x9C27B0 // Purple
};

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
          { name: '🛒 Buy', value: 'buy' },
          { name: '🧊 General Support', value: 'general' },
          { name: '📦 Order Issues', value: 'order' },
          { name: '⚙️ Technical Support', value: 'technical' }
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

      // Get category display info
      const categoryInfo = getCategoryInfo(ticketCategory);
      const categoryColor = CATEGORY_COLORS[categoryInfo.label] || IGLOO_COLORS.PRIMARY;

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
      
      // Create clean channel name without emoji prefix
      const channelName = `ticket-${ticketNumber.toString().padStart(4, '0')}`.toLowerCase();

      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName, // Clean channel name without emoji
        type: ChannelType.GuildText,
        parent: config.ticket_category_id || null,
        topic: `Support ticket for ${interaction.user.tag} | Category: ${categoryInfo.label}`,
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
        [ticketId, guild.id, userId, ticketChannel.id, categoryInfo.label, 'open']
      );

      // Create IMPROVED welcome embed
      const timestamp = Math.floor(Date.now() / 1000);
      const welcomeEmbed = new EmbedBuilder()
        .setAuthor({ 
          name: ticketId, 
          iconURL: client.user.displayAvatarURL() 
        })
        .setTitle(`${categoryInfo.emoji} ${categoryInfo.label} Support`)
        .setDescription(
          config.welcome_message || 
          `Thank you for creating a ticket! Our support team will be with you shortly.\n\n` +
          `Please provide any additional details that might help us assist you better.`
        )
        .setColor(categoryColor)
        .addFields([
          {
            name: 'Ticket Information',
            value: 
              `**Category:** ${categoryInfo.label}\n` +
              `**Created by:** <@${userId}>\n` +
              `**Status:** 🔵 Open\n` +
              `**Created:** <t:${timestamp}:R>`
          },
          {
            name: 'Description',
            value: description
          }
        ])
        .setFooter({ 
          text: 'Igloo Support System',
          iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();

      // Create action buttons with ice theme styling
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

      // Send confirmation to user with ice theme
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Ticket Created')
        .setDescription(`Your ticket has been created successfully!`)
        .addFields(
          { name: 'Ticket ID', value: ticketId, inline: true },
          { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
        )
        .setColor(IGLOO_COLORS.SUCCESS)
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed] });

      // Log ticket creation
      logger.info(`Ticket created: ${ticketId} by ${interaction.user.tag} in ${guild.name}`);

      // Send log to log channel if configured
      if (config.log_channel_id) {
        const logChannel = guild.channels.cache.get(config.log_channel_id);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('❄️ New Ticket Created')
            .addFields(
              { name: 'Ticket ID', value: ticketId, inline: true },
              { name: 'User', value: `<@${userId}>`, inline: true },
              { name: 'Category', value: categoryInfo.label, inline: true },
              { name: 'Channel', value: `<#${ticketChannel.id}>`, inline: true }
            )
            .setColor(IGLOO_COLORS.SECONDARY)
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

// Function to get category information
function getCategoryInfo(categoryValue) {
  const categories = {
    'buy': { 
      label: 'Buy', 
      emoji: '🛒', 
      description: 'Click for making a purchase'
    },
    'general': { 
      label: 'General Support', 
      emoji: '🧊', 
      description: 'General questions and help'
    },
    'order': { 
      label: 'Order Issues', 
      emoji: '📦', 
      description: 'Problems with orders'
    },
    'technical': { 
      label: 'Technical Support', 
      emoji: '⚙️', 
      description: 'Technical difficulties'
    }
  };
  
  return categories[categoryValue] || categories['general'];
}

async function getNextTicketNumber(guildId) {
  const result = await db.query(
    'SELECT COUNT(*) FROM tickets WHERE guild_id = $1',
    [guildId]
  );
  return parseInt(result.rows[0].count) + 1;
}