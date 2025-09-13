const {
  Events,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
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

    // Handle select menu interactions (category selection for tickets)
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_category_select') {
        try {
          // Defer to keep the interaction alive (ephemeral)
          await interaction.deferReply({ ephemeral: true });
          const selected = Array.isArray(interaction.values) && interaction.values.length
            ? interaction.values[0]
            : 'general';

          // Reuse the /ticket create command logic by adapting the interaction
          const ticketCreateCmd = require('../commands/tickets/create.js');
          // Create a shallow adapter for options
          const fakeInteraction = Object.create(interaction);
          fakeInteraction.options = {
            getString: (name) => {
              if (name === 'category') return selected;
              if (name === 'description') return null;
              return null;
            }
          };
          // Avoid double defer: the command calls deferReply, so override to no-op
          fakeInteraction.deferReply = async () => {};
          // Ensure editReply is available
          fakeInteraction.editReply = interaction.editReply.bind(interaction);

          await ticketCreateCmd.execute(fakeInteraction, client);
        } catch (error) {
          const { logger } = require('../utils/logger');
          logger.error('Error handling ticket category select:', error);
          if (!interaction.replied) {
            await interaction.reply({ content: 'Failed to create the ticket. Try /ticket manually.', ephemeral: true });
          } else {
            await interaction.followUp({ content: 'Failed to create the ticket. Try /ticket manually.', ephemeral: true });
          }
        }
        return;
      }
    }
      await handleButton(interaction, client);
    }
  }
};

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

    // Show category selection
    const categorySelect = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_category_select')
          .setPlaceholder('Select ticket category')
          .addOptions([
            {
              label: 'General Support',
              description: 'General questions and help',
              value: 'general',
              emoji: '🛍️'
            },
            {
              label: 'Order Issue',
              description: 'Problems with orders',
              value: 'order',
              emoji: '📦'
            },
            {
              label: 'Payment Problem',
              description: 'Billing and payment issues',
              value: 'payment',
              emoji: '💳'
            },
            {
              label: 'Technical Support',
              description: 'Technical difficulties',
              value: 'technical',
              emoji: '⚙️'
            },
            {
              label: 'Other',
              description: 'Everything else',
              value: 'other',
              emoji: '❓'
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

  // Update channel name
  const channel = interaction.channel;
  await channel.setName(`👤-${ticket.ticket_id.toLowerCase()}`);

  // Send confirmation
  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket Claimed')
    .setDescription(`This ticket has been claimed by <@${interaction.user.id}>`)
    .setColor(0x00FF00)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`Ticket ${ticket.ticket_id} claimed by ${interaction.user.tag}`);
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
