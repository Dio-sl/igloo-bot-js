// Enhanced interactionCreate.js with improved dropdown handling
const {
  Events,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  ComponentType
} = require('discord.js');
const { logger } = require('../utils/logger');
const { db } = require('../database/Database');

// Keep track of which interactions we've handled
// This prevents double-handling the same interaction
const handledInteractions = new Set();

// Clean up old interactions periodically to prevent memory leaks
setInterval(() => {
  console.log(`Cleaning up interaction tracking cache (size: ${handledInteractions.size})`);
  handledInteractions.clear();
}, 1000 * 60 * 30); // Clear every 30 minutes

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Skip any interaction we've already handled
    if (handledInteractions.has(interaction.id)) {
      console.log(`Skipping already handled interaction: ${interaction.id}`);
      return;
    }

    // Debug logging for ALL interactions
    console.log(`[INT] ${interaction.type} → ${interaction.customId || 'no-id'} (${interaction.componentType || 'no-component-type'})`);
    
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        handledInteractions.add(interaction.id);
        await handleCommand(interaction, client);
        return;
      }

      // Handle button interactions
      if (interaction.isButton()) {
        handledInteractions.add(interaction.id);
        await handleButton(interaction, client);
        return;
      }

      // CRITICAL: Check for select menus
      // Using multiple detection methods for maximum compatibility
      const isSelectMenu = 
        (interaction.componentType === 3) || 
        (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) ||
        interaction.isStringSelectMenu;

      if (isSelectMenu) {
        // Handle ticket category dropdown specifically
        if (interaction.customId === 'ticket_category_select') {
          handledInteractions.add(interaction.id);
          try {
            // Always defer first to prevent interaction failures
            await interaction.deferUpdate().catch(e => console.warn('Could not defer ticket_category_select:', e));
            const selected = Array.isArray(interaction.values) && interaction.values.length
              ? interaction.values[0]
              : 'general';
            await createTicket(interaction, client, selected);
          } catch (error) {
            console.error('Error handling ticket category select:', error);
            logger.error('Error handling ticket category select:', error);
          }
          return;
        }

        // IMPORTANT: For all setup-related dropdowns
        // Immediately defer the update to prevent "interaction failed" errors
        if (interaction.customId?.includes('setup_') || 
            interaction.customId?.includes('channel_select')) {
          
          console.log(`Detected setup dropdown: ${interaction.customId} - Deferring then delegating to collector`);
          
          try {
            // CRITICAL FIX: Immediately defer the update before delegating
            // This prevents the "interaction failed" error
            await interaction.deferUpdate().catch(e => console.warn(`Could not defer ${interaction.customId}:`, e));
            
            // Mark as handled after successful defer
            handledInteractions.add(interaction.id);
            
            // The collector will now handle the rest of the interaction
            console.log(`Successfully deferred and delegated: ${interaction.customId}`);
          } catch (error) {
            console.error(`Error deferring setup dropdown (${interaction.customId}):`, error);
          }
          
          return;
        }
        
        // Fallback for any other select menu
        handledInteractions.add(interaction.id);
        console.log(`Handling unspecified select menu: ${interaction.customId}`);
        try {
          await interaction.deferUpdate();
        } catch (error) {
          console.error(`Error in unspecified select menu:`, error);
        }
      }
    } catch (error) {
      console.error('Error in interaction handler:', error);
      logger.error('Error in interaction handler:', error);
      
      try {
        // Only try to reply if not already replied
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'An error occurred while processing this interaction. Please try again.',
            ephemeral: true
          }).catch(err => console.error('Error sending error reply:', err));
        }
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
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

    // Send the dropdown to the user
    await interaction.reply({
      content: 'Please select a category for your ticket:',
      components: [categorySelect],
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Error showing ticket category selector:', error);
    await interaction.reply({
      content: 'An error occurred while creating your ticket. Please try again later.',
      ephemeral: true,
    });
  }
}

// Handle ticket creation from category selection
async function createTicket(interaction, client, category) {
  try {
    // Get guild configuration
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    
    // Get ticket configuration
    const configResult = await db.query(
      'SELECT * FROM ticket_config WHERE guild_id = $1',
      [guildId]
    );
    
    const config = configResult.rows[0] || {};
    
    // Check if ticket system is enabled
    if (config.enabled === false) {
      await interaction.followUp({
        content: '❌ The ticket system is currently disabled in this server.',
        ephemeral: true,
      });
      return;
    }
    
    // Check if user has reached max tickets
    const userTicketsResult = await db.query(
      "SELECT COUNT(*) FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'",
      [guildId, userId]
    );
    
    const maxTickets = config.max_open_tickets || 5;
    if (parseInt(userTicketsResult.rows[0].count) >= maxTickets) {
      await interaction.followUp({
        content: `❌ You already have ${userTicketsResult.rows[0].count} open tickets. Please close some before creating more.`,
        ephemeral: true,
      });
      return;
    }
    
    // Get category information
    const categoryInfo = getCategoryInfo(category);
    
    // Generate ticket ID
    const ticketNumber = await getNextTicketNumber(guildId);
    const ticketId = `${config.ticket_prefix || 'TICKET'}-${ticketNumber.toString().padStart(4, '0')}`;
    
    // Create ticket channel
    const guild = interaction.guild;
    const user = interaction.user;
    
    // Get parent category
    let parentId = null;
    if (config.ticket_category_id) {
      parentId = config.ticket_category_id;
    }
    
    // Create the channel with proper permissions
    const everyoneRole = guild.roles.everyone;
    const supportRoleId = config.support_role_id;
    
    const permissionOverwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
        ],
      },
    ];
    
    // Add support role if it exists
    if (supportRoleId) {
      permissionOverwrites.push({
        id: supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }
    
    // Create ticket channel
    const ticketChannel = await guild.channels.create({
      name: `${category.toLowerCase()}-${ticketNumber}`,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: permissionOverwrites,
      topic: `Ticket: ${ticketId} | User: ${user.tag} | Category: ${categoryInfo.label}`,
      reason: `Ticket created by ${user.tag}`,
    });
    
    // Insert ticket into database
    await db.query(
      `INSERT INTO tickets (
        ticket_id, guild_id, user_id, channel_id, category, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [ticketId, guildId, userId, ticketChannel.id, category, 'open']
    );
    
    // Increment user's ticket count
    await db.query(
      `INSERT INTO users (discord_id, username, total_tickets, created_at, updated_at, last_seen)
      VALUES ($1, $2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (discord_id) 
      DO UPDATE SET 
        total_tickets = users.total_tickets + 1,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [userId, user.tag]
    );
    
    // Create welcome embed with ice theme
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`${categoryInfo.emoji} ${categoryInfo.label} Ticket`)
      .setDescription(
        `**Ticket ID:** ${ticketId}\n` +
        `**Created by:** <@${userId}>\n` +
        `**Category:** ${categoryInfo.label}\n\n` +
        getCategoryWelcomeMessage(category)
      )
      .setColor(categoryInfo.color)
      .setTimestamp()
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

// Function to handle claiming a ticket
async function handleClaimTicket(interaction, ticket) {
  // Only staff can claim tickets
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({
      content: 'You do not have permission to claim tickets!',
      ephemeral: true,
    });
    return;
  }

  if (ticket.claimed_by) {
    await interaction.reply({
      content: `This ticket is already claimed by <@${ticket.claimed_by}>!`,
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
    .setColor(0x00FF00)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`Ticket ${ticket.ticket_id} claimed by ${interaction.user.tag}`);
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