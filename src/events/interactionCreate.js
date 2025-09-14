// Fixed interactionCreate.js with proper handling for channel selection dropdown
const {
  Events,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const { logger } = require('../utils/logger');
const { db } = require('../database/Database');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, client);
      }

      // Handle button interactions
      if (interaction.isButton()) {
        await handleButton(interaction, client);
      }

      // Handle ALL select menu interactions
      // Using isSelectMenu() or checking componentType to catch all select menu types
      if (interaction.isStringSelectMenu() || (interaction.componentType === 3)) {
        // Handle channel selection for setup
        if (interaction.customId === 'setup_channel_select') {
          // This is called when a channel is selected from the dropdown
          // The processing logic is already in the setup.js file
          // We don't need to do anything here because the collector in setup.js handles it
          return;
        }
        // Handle ticket category selection
        else if (interaction.customId === 'ticket_category_select') {
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
    } catch (error) {
      logger.error('Error in interaction handler:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'An error occurred while processing this interaction. Please try again.', 
            ephemeral: true 
          });
        }
      } catch (replyError) {
        logger.error('Error sending error message:', replyError);
      }
    }
  }
};

// Function to handle slash commands
async function handleCommand(interaction, client) {
  const { commandName } = interaction;
  const command = client.commands.get(commandName);

  if (!command) {
    logger.warn(`Command ${commandName} not found`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Error executing command ${commandName}:`, error);
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: 'An error occurred while executing this command.',
          ephemeral: true,
        });
      }
    } catch (replyError) {
      logger.error('Error sending error message:', replyError);
    }
  }
}

// Function to handle ticket creation from a command
async function handleTicketCreation(interaction, client) {
  const category = interaction.options.getString('category') || 'general';
  const description = interaction.options.getString('description') || 'No description provided';
  
  // Create ticket with the selected category
  await createTicket(interaction, client, category, description);
}

// Function to handle button interactions
async function handleButton(interaction, client) {
  try {
    const { customId } = interaction;
    
    // Create ticket button
    if (customId === 'create_ticket') {
      await handleTicketButton(interaction, client);
    }
    
    // Ticket management buttons
    else if (customId === 'ticket_claim' || customId === 'ticket_close' || customId === 'ticket_delete') {
      try {
        // Get ticket info from database
        const channelId = interaction.channel.id;
        const ticketResult = await db.query(
          'SELECT * FROM tickets WHERE channel_id = $1',
          [channelId]
        );
        
        if (ticketResult.rows.length === 0) {
          await interaction.reply({
            content: 'This channel is not a valid ticket!',
            ephemeral: true,
          });
          return;
        }
        
        const ticket = ticketResult.rows[0];
        
        // Handle ticket actions
        if (customId === 'ticket_claim') {
          await handleClaimTicket(interaction, ticket);
        } else if (customId === 'ticket_close') {
          await handleCloseTicket(interaction, ticket);
        } else if (customId === 'ticket_delete') {
          await handleDeleteTicket(interaction, ticket);
        }
      } catch (error) {
        logger.error('Error handling ticket button:', error);
        await interaction.reply({
          content: 'An error occurred while processing the ticket action. Please try again.',
          ephemeral: true,
        });
      }
    }
  } catch (error) {
    logger.error('Error handling button interaction:', error);
    await interaction.reply({
      content: 'An error occurred while processing this button. Please try again.',
      ephemeral: true,
    });
  }
}

// Function to handle the initial ticket creation button
async function handleTicketButton(interaction, client) {
  try {
    // Create a dropdown for selecting ticket category
    const categorySelect = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_category_select')
          .setPlaceholder('Select ticket category')
          .addOptions([
            {
              label: 'Buy',
              value: 'buy',
              description: 'Click for making a purchase',
              emoji: '🛒',
            },
            {
              label: 'General Support',
              value: 'general',
              description: 'General questions and help',
              emoji: '🧊',
            },
            {
              label: 'Order Issues',
              value: 'order',
              description: 'Problems with orders',
              emoji: '📦',
            },
            {
              label: 'Technical Support',
              value: 'technical',
              description: 'Technical difficulties',
              emoji: '⚙️',
            },
          ])
      );
    
    await interaction.reply({
      content: 'Please select a category for your ticket:',
      components: [categorySelect],
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error handling ticket button:', error);
    await interaction.reply({
      content: 'An error occurred while creating your ticket. Please try again.',
      ephemeral: true,
    });
  }
}

// Function to handle ticket claim button
async function handleClaimTicket(interaction, ticket) {
  // Check if ticket is already claimed
  if (ticket.claimed_by) {
    const claimer = await interaction.guild.members.fetch(ticket.claimed_by).catch(() => null);
    await interaction.reply({
      content: `This ticket is already claimed by ${claimer ? claimer.user.tag : 'a staff member'}!`,
      ephemeral: true,
    });
    return;
  }
  
  // Update ticket in database
  await db.query(
    `UPDATE tickets 
     SET claimed_by = $1, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [interaction.user.id, ticket.id]
  );
  
  // Send confirmation
  const embed = new EmbedBuilder()
    .setTitle('👋 Ticket Claimed')
    .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
    .setColor(0x3498DB) // Blue
    .setTimestamp();
  
  await interaction.reply({ embeds: [embed] });
  
  logger.info(`Ticket ${ticket.ticket_id} claimed by ${interaction.user.tag}`);
}

// Function to directly create a ticket from the dropdown selection
async function createTicket(interaction, client, categoryValue, description = 'No description provided') {
  try {
    const guild = interaction.guild;
    const userId = interaction.user.id;

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
    logger.info(`Ticket ${ticketId} created by ${interaction.user.tag}`);

  } catch (error) {
    logger.error('Error creating ticket:', error);
    await interaction.followUp({
      content: 'An error occurred while creating your ticket. Please try again or contact an administrator.',
      ephemeral: true
    });
  }
}

// Function to handle closing a ticket
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

// Function to handle deleting a ticket
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