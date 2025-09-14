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
const SetupUI = require('./setupUI');

module.exports = {
  // Show the shop setup menu
  async showMenu(interaction, client, config) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('🛒 Shop System Setup')
      .setDescription('Configure your server\'s e-commerce settings')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: 'Current Configuration',
          value: SetupUI.getShopStatusText(config),
          inline: false,
        },
        {
          name: 'Available Settings',
          value: [
            '**🏪 Shop Channel** - Where products are displayed',
            '**👥 Customer Role** - Role given after purchase',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⏳ Development Status',
          value: [
            '**Phase 1 (Current)**: Basic configuration',
            '**Phase 2 (Q2 2025)**: Product management, admin panel',
            '**Phase 3 (Q3 2025)**: Payment processing, Stripe integration',
            '**Phase 4 (Q4 2025)**: Order management, analytics',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚀 What You Can Do Now',
          value: 'Configure basic settings to prepare for when shop features become available!',
          inline: false,
        }
      );

    // Create settings buttons
    const settingsRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('shop_set_channel')
          .setLabel('Set Shop Channel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🏪'),
        new ButtonBuilder()
          .setCustomId('shop_set_customer_role')
          .setLabel('Set Customer Role')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId('shop_view_roadmap')
          .setLabel('View Roadmap')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📅')
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
          .setCustomId('shop_preview')
          .setLabel('Preview Shop')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👀')
          .setDisabled(!config.shop_channel_id)
      );

    await interaction.update({
      embeds: [embed],
      components: [settingsRow, actionRow],
    });
  },

  // Handle shop-related interactions
  async handleInteraction(interaction, client) {
    const { customId } = interaction;

    switch (customId) {
      case 'shop_set_channel':
        await this.promptChannelSelection(interaction);
        break;
      case 'shop_set_customer_role':
        await this.promptRoleSelection(interaction);
        break;
      case 'shop_view_roadmap':
        await this.showRoadmap(interaction, client);
        break;
      case 'shop_preview':
        await this.showShopPreview(interaction, client);
        break;
      default:
        // Handle confirmations
        if (customId.startsWith('shop_confirm_')) {
          await this.handleConfirmation(interaction, client);
        }
    }
  },

  // Handle direct setup from slash command
  async handleDirectSetup(interaction, client) {
    const shopChannel = interaction.options.getChannel('shop_channel');
    const customerRole = interaction.options.getRole('customer_role');

    const updates = [];
    const updateValues = [];
    let paramCount = 1;

    if (shopChannel) {
      updates.push(`shop_channel_id = $${paramCount++}`);
      updateValues.push(shopChannel.id);
    }

    if (customerRole) {
      updates.push(`customer_role_id = $${paramCount++}`);
      updateValues.push(customerRole.id);
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
        .setTitle('✅ Shop System Updated')
        .setDescription('Your shop system configuration has been updated successfully!')
        .addFields(
          shopChannel ? { name: '🏪 Shop Channel', value: `<#${shopChannel.id}>`, inline: true } : null,
          customerRole ? { name: '👥 Customer Role', value: `<@&${customerRole.id}>`, inline: true } : null
        ).filter(Boolean)
        .addFields({
          name: '⏳ Coming Soon',
          value: 'Full shop functionality will be available in Phase 2 (Q2 2025)',
          inline: false,
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

    } catch (error) {
      logger.error('Error updating shop configuration:', error);
      await interaction.reply({
        content: '❌ Failed to update shop configuration. Please try again.',
        ephemeral: true,
      });
    }
  },

  // Prompt for channel selection
  async promptChannelSelection(interaction) {
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
      .setTitle('🏪 Select Shop Channel')
      .setDescription('Choose where shop products will be displayed:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_confirm_channel')
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
      .setTitle('👥 Select Customer Role')
      .setDescription('Choose the role given to customers after purchase:');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_confirm_role')
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

  // Handle confirmation of selections
  async handleConfirmation(interaction, client) {
    const { customId, values } = interaction;
    const selectedId = values[0];
    const guildId = interaction.guild.id;

    let field = '';
    let displayName = '';

    if (customId === 'shop_confirm_channel') {
      field = 'shop_channel_id';
      const channel = interaction.guild.channels.cache.get(selectedId);
      displayName = `🏪 Shop channel set to: **#${channel.name}**`;
    } else if (customId === 'shop_confirm_role') {
      field = 'customer_role_id';
      const role = interaction.guild.roles.cache.get(selectedId);
      displayName = `👥 Customer role set to: **@${role.name}**`;
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
          text: 'Going back to shop setup...',
          iconURL: client.user.displayAvatarURL(),
        });

      await interaction.update({
        embeds: [embed],
        components: [],
      });

      // After a short delay, go back to the shop menu
      setTimeout(async () => {
        const config = await this.getGuildConfig(guildId);
        await this.showMenu(interaction, client, config);
      }, 2000);

    } catch (error) {
      logger.error('Error updating shop configuration:', error);
      await interaction.update({
        content: '❌ Failed to update configuration. Please try again.',
        embeds: [],
        components: [],
      });
    }
  },

  // Show development roadmap
  async showRoadmap(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('📅 Shop System Roadmap')
      .setDescription('Here\'s what\'s coming for the Igloo shop system:')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎯 Phase 1: Q1 2025 (Current)',
          value: '✅ Basic configuration\n✅ Channel and role setup\n✅ Database foundation',
          inline: false,
        },
        {
          name: '🛍️ Phase 2: Q2 2025',
          value: '🚧 Admin shop panel\n🚧 Product management\n🚧 Inventory tracking\n🚧 Product categories',
          inline: false,
        },
        {
          name: '💳 Phase 3: Q3 2025',
          value: '⏳ Stripe integration\n⏳ Payment processing\n⏳ In-ticket purchases\n⏳ Receipt system',
          inline: false,
        },
        {
          name: '📦 Phase 4: Q4 2025',
          value: '⏳ Order management\n⏳ Analytics dashboard\n⏳ Digital delivery\n⏳ Customer support',
          inline: false,
        }
      )
      .setFooter({
        text: 'Stay tuned for updates!',
        iconURL: client.user.displayAvatarURL(),
      });

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back to Shop Setup')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
  },

  // Show shop preview
  async showShopPreview(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('🛒 Shop Preview')
      .setDescription('Here\'s what your shop will look like once it\'s ready!')
      .setImage(SetupUI.ASSETS.BANNER)
      .addFields(
        {
          name: '📦 Example Products',
          value: '• VIP Role - $5.00\n• Custom Bot - $25.00\n• Server Setup - $10.00',
          inline: true,
        },
        {
          name: '🎯 Features Coming Soon',
          value: '• Product catalog\n• Shopping cart\n• Secure checkout\n• Order history',
          inline: true,
        },
        {
          name: '⚠️ Note',
          value: 'This is just a preview! Actual shop functionality will be available in Phase 2.',
          inline: false,
        }
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back to Shop Setup')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
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
