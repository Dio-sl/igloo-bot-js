const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');

const { db } = require('../../../database/Database');
const { logger } = require('../../../utils/logger');
const SetupUI = require('../SetupUI');  // Capital 'U' in 'UI'

module.exports = {
  // Show the ticket setup menu
  async showMenu(interaction, client, config) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('🎫 Ticket System Setup')
      .setDescription('Configure your server\'s ticket system settings')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: 'Current Configuration',
          value: SetupUI.getTicketStatusText(config),
          inline: false,
        },
        {
          name: 'Available Settings',
          value: [
            '**📁 Ticket Category** - Where ticket channels are created',
            '**👮 Support Role** - Members with access to all tickets',
            '**📋 Log Channel** - Where ticket events are logged',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚀 Quick Setup',
          value: 'Click the buttons below to configure each setting, then create your ticket panel!',
          inline: false,
        }
      );

    // Create settings buttons
    const settingsRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_set_category')
          .setLabel('Set Category')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📁'),
        new ButtonBuilder()
          .setCustomId('ticket_set_role')
          .setLabel('Set Support Role')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👮'),
        new ButtonBuilder()
          .setCustomId('ticket_set_logs')
          .setLabel('Set Log Channel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋')
      );

    // Create action buttons
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back_main')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️'),
        new ButtonBuilder()
          .setCustomId('ticket_create_panel')
          .setLabel('Create Ticket Panel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(!this.isTicketSystemConfigured(config))
      );

    await interaction.update({
      embeds: [embed],
      components: [settingsRow, actionRow],
    });
  },

  // Handle ticket-related interactions
  async handleInteraction(interaction, client) {
    const { customId } = interaction;

    switch (customId) {
      case 'ticket_set_category':
        await this.promptCategorySelection(interaction);
        break;
      case 'ticket_set_role':
        await this.promptRoleSelection(interaction);
        break;
      case 'ticket_set_logs':
        await this.promptLogChannelSelection(interaction);
        break;
      case 'ticket_create_panel':
        await this.createTicketPanel(interaction, client);
        break;
      default:
        // Handle channel/role selection confirmations
        if (customId.startsWith('ticket_confirm_')) {
          await this.handleConfirmation(interaction, client);
        }
    }
  },

  // Handle direct setup from slash command
  async handleDirectSetup(interaction, client) {
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    const logChannel = interaction.options.getChannel('log_channel');

    const updates = [];
    const updateValues = [];
    let paramCount = 1;

    if (category) {
      updates.push(`ticket_category_id = $${paramCount++}`);
      updateValues.push(category.id);
    }

    if (supportRole) {
      updates.push(`support_role_id = $${paramCount++}`);
      updateValues.push(supportRole.id);
    }

    if (logChannel) {
      updates.push(`log_channel_id = $${paramCount++}`);
      updateValues.push(logChannel.id);
    }

    if (updates.length === 0) {
      return await interaction.reply({
        content: '❌ Please specify at least one option to configure.',
        ephemeral: true,
      });
    }

    try {
      updates.push(`updated_at = $${paramCount++}`);
      updateValues.push(new Date());
      updateValues.push(interaction.guild.id);

      await db.query(
        `INSERT INTO guild_configs (guild_id, ${updates.map((_, i) => updates[i].split(' = ')[0]).join(', ')}, created_at, updated_at) 
         VALUES ($${paramCount}, ${updates.map((_, i) => `$${i + 1}`).join(', ')}, NOW(), $${paramCount - 1})
         ON CONFLICT (guild_id) DO UPDATE SET ${updates.join(', ')}`,
        updateValues
      );

      const embed = new EmbedBuilder()
        .setColor(SetupUI.COLORS.SUCCESS)
        .setTitle('✅ Ticket System Updated')
        .setDescription('Your ticket system configuration has been updated successfully!')
        .addFields(
          category ? { name: '📁 Category', value: `<#${category.id}>`, inline: true } : null,
          supportRole ? { name: '👮 Support Role', value: `<@&${supportRole.id}>`, inline: true } : null,
          logChannel ? { name: '📋 Log Channel', value: `<#${logChannel.id}>`, inline: true } : null
        ).filter(Boolean);

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error updating ticket configuration:', error);
      await interaction.reply({
        content: '❌ Failed to update ticket configuration. Please try again.',
        ephemeral: true,
      });
    }
  },

  // Prompt for category selection
  async promptCategorySelection(interaction) {
    const categories = interaction.guild.channels.cache
      .filter(channel => channel.type === ChannelType.GuildCategory)
      .first(25); // Discord limit

    if (categories.length === 0) {
      return await interaction.reply({
        content: '❌ No categories found in this server. Please create a category first.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('📁 Select Ticket Category')
      .setDescription('Choose the category where ticket channels will be created:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_confirm_category')
      .setPlaceholder('Choose a category...')
      .addOptions(
        categories.map(category => ({
          label: category.name,
          value: category.id,
          description: `ID: ${category.id}`,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [row, backButton],
    });
  },

  // Prompt for role selection
  async promptRoleSelection(interaction) {
    const roles = interaction.guild.roles.cache
      .filter(role => !role.managed && role.id !== interaction.guild.id)
      .first(25); // Discord limit

    if (roles.length === 0) {
      return await interaction.reply({
        content: '❌ No suitable roles found in this server.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('👮 Select Support Role')
      .setDescription('Choose the role that will have access to tickets:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_confirm_role')
      .setPlaceholder('Choose a role...')
      .addOptions(
        roles.map(role => ({
          label: role.name,
          value: role.id,
          description: `Members: ${role.members.size}`,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [row, backButton],
    });
  },

  // Prompt for log channel selection
  async promptLogChannelSelection(interaction) {
    const channels = interaction.guild.channels.cache
      .filter(channel => channel.type === ChannelType.GuildText)
      .first(25); // Discord limit

    if (channels.length === 0) {
      return await interaction.reply({
        content: '❌ No text channels found in this server.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('📋 Select Log Channel')
      .setDescription('Choose where ticket events will be logged:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_confirm_logs')
      .setPlaceholder('Choose a channel...')
      .addOptions(
        channels.map(channel => ({
          label: `# ${channel.name}`,
          value: channel.id,
          description: `ID: ${channel.id}`,
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [row, backButton],
    });
  },

  // Handle confirmation of selections
  async handleConfirmation(interaction, client) {
    const { customId, values } = interaction;
    const selectedId = values[0];
    const guildId = interaction.guild.id;

    let field = '';
    let displayName = '';

    if (customId === 'ticket_confirm_category') {
      field = 'ticket_category_id';
      const category = interaction.guild.channels.cache.get(selectedId);
      displayName = `📁 Category set to: **${category.name}**`;
    } else if (customId === 'ticket_confirm_role') {
      field = 'support_role_id';
      const role = interaction.guild.roles.cache.get(selectedId);
      displayName = `👮 Support role set to: **@${role.name}**`;
    } else if (customId === 'ticket_confirm_logs') {
      field = 'log_channel_id';
      const channel = interaction.guild.channels.cache.get(selectedId);
      displayName = `📋 Log channel set to: **#${channel.name}**`;
    }

    try {
      // Update database
      await db.query(
        `INSERT INTO guild_configs (guild_id, ${field}, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (guild_id) DO UPDATE SET ${field} = $2, updated_at = NOW()`,
        [guildId, selectedId]
      );

      // Show success message
      const embed = new EmbedBuilder()
        .setColor(SetupUI.COLORS.SUCCESS)
        .setTitle('✅ Configuration Updated')
        .setDescription(displayName)
        .setFooter({
          text: 'Going back to ticket setup...',
          iconURL: client.user.displayAvatarURL(),
        });

      await interaction.update({
        embeds: [embed],
        components: [],
      });

      // After a short delay, go back to the ticket menu
      setTimeout(async () => {
        const config = await this.getGuildConfig(guildId);
        await this.showMenu(interaction, client, config);
      }, 2000);

    } catch (error) {
      logger.error('Error updating ticket configuration:', error);
      await interaction.update({
        content: '❌ Failed to update configuration. Please try again.',
        embeds: [],
        components: [],
      });
    }
  },

  // Create ticket panel
  async createTicketPanel(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('🎫 Support Tickets')
      .setDescription('Need help? Click the button below to create a support ticket!')
      .setThumbnail(SetupUI.ASSETS.LOGO)
      .addFields({
        name: 'How it works:',
        value: '• Click "Create Ticket" below\n• A private channel will be created\n• Our support team will help you\n• The ticket will be closed when resolved',
      });

    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

    await interaction.followUp({
      content: '✅ **Ticket panel created!** You can send this message anywhere:',
      embeds: [embed],
      components: [button],
      ephemeral: true,
    });
  },

  // Check if ticket system is properly configured
  isTicketSystemConfigured(config) {
    return config.ticket_category_id && config.support_role_id;
  },

  // Get guild configuration
  async getGuildConfig(guildId) {
    try {
      const result = await db.query(
        'SELECT * FROM guild_configs WHERE guild_id = $1',
        [guildId]
      );
      return result.rows[0] || {};
    } catch (error) {
      logger.error('Error getting guild config:', error);
      return {};
    }
  }
};