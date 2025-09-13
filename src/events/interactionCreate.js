// Fixed interaction handler for the ticket category selection with proper imports
const {
  Events,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType // Added this import which was missing
} = require('discord.js');
const { logger } = require('../utils/logger');
const { db } = require('../database/Database');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, client);
    }

    // Handle button interactions
    if (interaction.isButton()) {
      await handleButton(interaction, client);
    }

    // Handle select menu interactions (category selection for tickets)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_category_select') {
        try {
          // Defer to keep the interaction alive
          await interaction.deferUpdate();
          const selected = Array.isArray(interaction.values) && interaction.values.length
            ? interaction.values[0]
            : 'general';

          // Get category display info
          const categoryInfo = getCategoryInfo(selected);

          // We'll handle the ticket creation directly here instead of trying to reuse the command
          // This fixes the "ticketCreateCmd.execute is not a function" error
          // Pass just the category value, not the entire categoryInfo object
          await createTicket(interaction, client, selected);

        } catch (error) {
          logger.error('Error handling ticket category select:', error);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: 'Failed to create the ticket. Try /ticket manually.', ephemeral: true });
            } else {
              await interaction.followUp({ content: 'Failed to create the ticket. Try /ticket manually.', ephemeral: true });
            }
          } catch (replyError) {
            logger.error('Error sending failure message:', replyError);
          }
        }
      }
    }
  }
};

// Function to directly create a ticket from the dropdown selection
// REPLACEMENT FOR THE createTicket FUNCTION IN interactionCreate.js
// Copy this entire function and replace your existing createTicket function

// Function to directly create a ticket from the dropdown selection
// Updated createTicket function for the dropdown with clean channel names

// Function to directly create a ticket from the dropdown selection
// Updated createTicket function for the dropdown

// Function to directly create a ticket from the dropdown selection
// Updated createTicket function for the dropdown with fixed title and category

// Function to directly create a ticket from the dropdown selection
async function createTicket(interaction, client, categoryValue) {
  try {
    const guild = interaction.guild;
    const userId = interaction.user.id;
    const description = 'No description provided'; // Default for dropdown selection

    // Get category info
    const categoryInfo = getCategoryInfo(categoryValue);
    
    // Use the same blue color for all tickets
    const IGLOO_BLUE = 0x0CAFFF; // Bright cyan/blue for all tickets

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
      await interaction.followUp({
        content: `You already have ${openTicketCount} open tickets. Please close some before creating new ones.`,
        ephemeral: true
      });
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

    // Save ticket to database with the correct category
    await db.query(
      `INSERT INTO tickets (ticket_id, guild_id, user_id, channel_id, category, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ticketId, guild.id, userId, ticketChannel.id, categoryValue, 'open']
    );

    // Get category-specific welcome message
    const welcomeMessage = getCategoryWelcomeMessage(categoryValue);
    
    // Create FINAL clean welcome embed - with fixed title and category
    const timestamp = Math.floor(Date.now() / 1000);
    const welcomeEmbed = new EmbedBuilder()
      .setColor(IGLOO_BLUE) // Same blue color for all categories
      .setAuthor({ 
        name: ticketId, // Just the ticket ID without "Ticket:" prefix
        iconURL: client.user.displayAvatarURL() 
      })
      .setDescription(welcomeMessage)
      .addFields([
        {
          name: 'Ticket Information',
          value: 
            `**Category:** ${categoryInfo.emoji} ${categoryInfo.label}\n` +
            `**Created by:** <@${userId}>\n` +
            `**Status:** 🔵 Open\n` +
            `**Created:** <t:${timestamp}:R>`
        }
      ])
      // Only add description field if it's not the default
      .addFields(
        description !== 'No description provided' 
          ? [{ name: 'Description', value: description }]
          : []
      )
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

    // Send welcome message to ticket channel WITHOUT role mention
    await ticketChannel.send({
      content: null, // No role mention
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
      .setColor(0x7FFFD4) // Success color
      .setTimestamp();

    await interaction.followUp({ embeds: [confirmEmbed], ephemeral: true });

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
          .setColor(0x87CEEB) // Secondary color
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    logger.error('Error creating ticket:', error);
    await interaction.followUp({
      content: 'An error occurred while creating your ticket. Please try again later.',
      ephemeral: true
    });
  }
}

// Handle slash commands
async function handleCommand(interaction, client) {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.warn(`Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    // Check cooldowns
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Map());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        await interaction.reply({
          content: `Please wait ${timeLeft.toFixed(1)} more seconds before using \`${command.data.name}\` again.`,
          ephemeral: true,
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Execute command
    await command.execute(interaction, client);

    logger.info(
      `Command executed: ${interaction.commandName} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'
      }`
    );
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = 'There was an error executing this command!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

// Handle ticket creation
async function handleTicketCreation(interaction, client) {
  const guild = interaction.guild;
  const userId = interaction.user.id;

  try {
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
      await interaction.reply({
        content: `❌ You already have ${openTicketCount} open ticket(s). Please close some before creating new ones.`,
        ephemeral: true
      });
      return;
    }

    // Show category selection with categories matching the panel
    const categorySelect = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_category_select')
          .setPlaceholder('Select ticket category')
          .addOptions([
            {
              label: 'Buy',
              description: 'Click for making a purchase',
              value: 'buy',
              emoji: '🛒'
            },
            {
              label: 'General Support',
              description: 'General questions and help',
              value: 'general',
              emoji: '🧊'
            },
            {
              label: 'Order Issues',
              description: 'Problems with orders',
              value: 'order',
              emoji: '📦'
            },
            {
              label: 'Technical Support',
              description: 'Technical difficulties',
              value: 'technical',
              emoji: '⚙️'
            }
          ])
      );

    await interaction.reply({
      content: 'Please select a category for your ticket:',
      components: [categorySelect],
      ephemeral: true
    });
  } catch (error) {
    logger.error('Error creating ticket from panel:', error);
    await interaction.reply({
      content: 'An error occurred while creating your ticket. Please try again.',
      ephemeral: true
    });
  }
}

// Handle button interactions
async function handleButton(interaction, client) {
  const { customId } = interaction;

  try {
    // Handle ticket panel button
    if (customId === 'create_ticket') {
      await handleTicketCreation(interaction, client);
      return;
    }

    // Handle ticket-related buttons (existing code)
    if (customId.startsWith('ticket_')) {
      await handleTicketButton(interaction, client);
    }
  } catch (error) {
    logger.error(`Error handling button ${customId}:`, error);
    await interaction.reply({
      content: 'An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}

// Handle ticket-specific button interactions
async function handleTicketButton(interaction, client) {
  const { customId, guild, channel, user } = interaction;

  if (!guild || !channel) {
    await interaction.reply({
      content: 'This button can only be used in a guild channel!',
      ephemeral: true,
    });
    return;
  }

  // Get ticket info from database
  const ticketResult = await db.query(
    'SELECT * FROM tickets WHERE channel_id = $1',
    [channel.id]
  );

  if (ticketResult.rows.length === 0) {
    await interaction.reply({
      content: 'This channel is not a valid ticket channel!',
      ephemeral: true,
    });
    return;
  }

  const ticket = ticketResult.rows[0];

  switch (customId) {
    case 'ticket_claim':
      await handleClaimTicket(interaction, ticket);
      break;
    case 'ticket_close':
      await handleCloseTicket(interaction, ticket);
      break;
    case 'ticket_delete':
      await handleDeleteTicket(interaction, ticket);
      break;
  }
}

// Implementations of ticket button handlers (these are the same as your existing code)
// Updated ticket button handlers with clean channel names

// Update the handleClaimTicket function
async function handleClaimTicket(interaction, ticket) {
  // Check if user has permission to claim tickets
  const member = interaction.guild.members.cache.get(interaction.user.id);

  const configResult = await db.query(
    'SELECT support_role_id FROM ticket_config WHERE guild_id = $1',
    [interaction.guild.id]
  );

  const config = configResult.rows[0];

  if (config?.support_role_id) {
    if (!member?.roles.cache.has(config.support_role_id)) {
      await interaction.reply({
        content: 'You do not have permission to claim tickets!',
        ephemeral: true,
      });
      return;
    }
  } else if (!member?.permissions.has(PermissionFlagsBits.ManageThreads)) {
    await interaction.reply({
      content: 'You do not have permission to claim tickets!',
      ephemeral: true,
    });
    return;
  }

  if (ticket.claimed_by) {
    await interaction.reply({
      content: `This ticket is already claimed by <@${ticket.claimed_by}>`,
      ephemeral: true,
    });
    return;
  }

  // Update ticket in database
  await db.query(
    'UPDATE tickets SET claimed_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [interaction.user.id, ticket.id]
  );

  // Extract the ticket number to maintain clean channel naming
  const ticketNumber = ticket.ticket_id.split('-')[1];

  // Update channel name with clean format - claimed
  const channel = interaction.channel;
  await channel.setName(`claimed-${ticketNumber.toLowerCase()}`);

  // Send confirmation
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Claimed')
    .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
    .setColor(0x00FF00)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`Ticket ${ticket.ticket_id} claimed by ${interaction.user.tag}`);
}

// Update the handleCloseTicket function
async function handleCloseTicket(interaction, ticket) {
  // Check if user can close the ticket
  const isTicketOwner = ticket.user_id === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads);
  const isClaimer = ticket.claimed_by === interaction.user.id;

  if (!isTicketOwner && !isStaff && !isClaimer) {
    await interaction.reply({
      content: 'You do not have permission to close this ticket!',
      ephemeral: true,
    });
    return;
  }

  if (ticket.status === 'closed') {
    await interaction.reply({
      content: 'This ticket is already closed!',
      ephemeral: true,
    });
    return;
  }

  // Update ticket in database
  await db.query(
    `UPDATE tickets 
     SET status = 'closed', 
         closed_by = $1, 
         closed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [interaction.user.id, ticket.id]
  );

  // Extract the ticket number to maintain clean channel naming
  const ticketNumber = ticket.ticket_id.split('-')[1];

  // Update channel name with clean format - closed
  const channel = interaction.channel;
  await channel.setName(`closed-${ticketNumber.toLowerCase()}`);

  // Remove send messages permission for ticket owner
  await channel.permissionOverwrites.edit(ticket.user_id, {
    SendMessages: false,
  });

  // Send confirmation
  const embed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket has been closed by <@${interaction.user.id}>`)
    .setColor(0xFF0000)
    .setTimestamp()
    .setFooter({ text: 'This channel will be deleted in 5 minutes if not reopened.' });

  await interaction.reply({ embeds: [embed] });

  logger.info(`Ticket ${ticket.ticket_id} closed by ${interaction.user.tag}`);

  // Schedule deletion after 5 minutes
  setTimeout(async () => {
    // Check if ticket is still closed
    const checkResult = await db.query(
      'SELECT status FROM tickets WHERE id = $1',
      [ticket.id]
    );

    if (checkResult.rows[0]?.status === 'closed') {
      try {
        await channel.delete('Ticket closed for more than 5 minutes');
        await db.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
      } catch (error) {
        logger.error(`Failed to delete closed ticket channel: ${error}`);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

async function handleCloseTicket(interaction, ticket) {
  // Check if user can close the ticket
  const isTicketOwner = ticket.user_id === interaction.user.id;
  const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads);
  const isClaimer = ticket.claimed_by === interaction.user.id;

  if (!isTicketOwner && !isStaff && !isClaimer) {
    await interaction.reply({
      content: 'You do not have permission to close this ticket!',
      ephemeral: true,
    });
    return;
  }

  if (ticket.status === 'closed') {
    await interaction.reply({
      content: 'This ticket is already closed!',
      ephemeral: true,
    });
    return;
  }

  // Update ticket in database
  await db.query(
    `UPDATE tickets 
     SET status = 'closed', 
         closed_by = $1, 
         closed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [interaction.user.id, ticket.id]
  );

  // Update channel name and permissions
  const channel = interaction.channel;
  await channel.setName(`🔒-${ticket.ticket_id.toLowerCase()}`);

  // Remove send messages permission for ticket owner
  await channel.permissionOverwrites.edit(ticket.user_id, {
    SendMessages: false,
  });

  // Send confirmation
  const embed = new EmbedBuilder()
    .setTitle('🔒 Ticket Closed')
    .setDescription(`This ticket has been closed by <@${interaction.user.id}>`)
    .setColor(0xFF0000)
    .setTimestamp()
    .setFooter({ text: 'This channel will be deleted in 5 minutes if not reopened.' });

  await interaction.reply({ embeds: [embed] });

  logger.info(`Ticket ${ticket.ticket_id} closed by ${interaction.user.tag}`);

  // Schedule deletion after 5 minutes
  setTimeout(async () => {
    // Check if ticket is still closed
    const checkResult = await db.query(
      'SELECT status FROM tickets WHERE id = $1',
      [ticket.id]
    );

    if (checkResult.rows[0]?.status === 'closed') {
      try {
        await channel.delete('Ticket closed for more than 5 minutes');
        await db.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);
      } catch (error) {
        logger.error(`Failed to delete closed ticket channel: ${error}`);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes
}

async function handleDeleteTicket(interaction, ticket) {
  // Only staff can delete tickets
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({
      content: 'You do not have permission to delete tickets!',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: '⚠️ Deleting ticket in 3 seconds...',
    ephemeral: false,
  });

  // Delete from database FIRST
  await db.query('DELETE FROM tickets WHERE id = $1', [ticket.id]);

  // Then delete channel
  setTimeout(async () => {
    try {
      await interaction.channel.delete('Ticket deleted by staff member');
      logger.info(`Ticket ${ticket.ticket_id} deleted by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Failed to delete ticket channel: ${error}`);
    }
  }, 3000);
}

// Function to get category information
function getCategoryInfo(categoryValue) {
  const categories = {
    'buy': {
      label: 'Buy',
      emoji: '🛒',
      description: 'Click for making a purchase',
      color: 0x4CAF50 // Green
    },
    'general': {
      label: 'General Support',
      emoji: '🧊',
      description: 'General questions and help',
      color: 0x2196F3 // Blue
    },
    'order': {
      label: 'Order Issues',
      emoji: '📦',
      description: 'Problems with orders',
      color: 0xFF9800 // Orange
    },
    'technical': {
      label: 'Technical Support',
      emoji: '⚙️',
      description: 'Technical difficulties',
      color: 0x9C27B0 // Purple
    }
  };

  return categories[categoryValue] || categories['general'];
}

// Function to get category-specific welcome messages
function getCategoryWelcomeMessage(categoryValue) {
  const messages = {
    'buy': `Thank you for your interest in our products! 
    
Our sales team will be with you shortly to assist with your purchase. 

In the meantime, please provide the following details if applicable:
• Which product(s) you're interested in
• Quantity needed
• Any specific requirements or questions about the product`,

    'general': `Thank you for reaching out to our support team!

We'll be with you shortly to assist with your inquiry.

Please provide any additional details that might help us assist you better.`,

    'order': `Thank you for contacting us about your order.

Our order support team will be with you shortly to help resolve any issues.

To help us assist you faster, please provide:
• Your order number (if available)
• Date of purchase
• Description of the issue you're experiencing`,

    'technical': `Thank you for contacting technical support!

Our tech team will be with you shortly to help troubleshoot your issue.

To help us assist you faster, please provide:
• Detailed description of the technical issue
• Any error messages you're seeing
• Steps you've already taken to resolve the issue`
  };

  return messages[categoryValue] || messages['general'];
}

// Function to get next ticket number
async function getNextTicketNumber(guildId) {
  const result = await db.query(
    'SELECT COUNT(*) FROM tickets WHERE guild_id = $1',
    [guildId]
  );
  return parseInt(result.rows[0].count) + 1;
}