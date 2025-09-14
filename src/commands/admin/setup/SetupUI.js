const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// IGLOO Theme Colors
const COLORS = {
  PRIMARY: 0x0CAFFF,    // Bright cyan blue
  SECONDARY: 0x87CEEB,  // Sky blue
  SUCCESS: 0x7FFFD4,    // Aquamarine
  DANGER: 0xE91E63,     // Pink-ish
  DARK: 0x0A5C7A,       // Dark blue
};

// IGLOO Branding Assets
const ASSETS = {
  BANNER: 'https://cdn.discordapp.com/attachments/1409836469530660986/1416393618838786058/Branding_-_Imgur.png?ex=68c6aeda&is=68c55d5a&hm=0b4d6a43db275ca5cdebf44041f287d1123962269ddad361d684e6b54e5fbe2f&',
  LOGO: 'https://cdn.discordapp.com/attachments/1409836469530660986/1409836530369990676/bot_avatar.png?ex=660c0773&is=65f99273&hm=02dc4c6a7c3c0fb89cc75faf0edeecd0c9a0bf9a8ab4da48a22a83df8d2fb72c&',
};

module.exports = {
  COLORS,
  ASSETS,

  // Create the main setup panel embed
  createMainEmbed(client, guild, config) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🧊 Igloo Setup Panel')
      .setDescription('Welcome to the Igloo Setup Panel! Configure your e-commerce and support systems using the options below.')
      .setImage(ASSETS.BANNER)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎫 Ticket System',
          value: this.getTicketStatusText(config),
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: this.getShopStatusText(config),
          inline: false,
        },
        {
          name: '⚙️ General Settings',
          value: this.getGeneralStatusText(config),
          inline: false,
        }
      )
      .setFooter({
        text: `Igloo Bot • Server: ${guild.name}`,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();
  },

  // Create category selection menu
  createCategoryMenu() {
    return new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup_category_select')
          .setPlaceholder('Select a system to configure')
          .addOptions([
            {
              label: 'Ticket System',
              description: 'Configure support tickets',
              value: 'tickets',
              emoji: '🎫',
            },
            {
              label: 'Shop System',
              description: 'Configure e-commerce features',
              value: 'shop',
              emoji: '🛒',
            },
            {
              label: 'General Settings',
              description: 'Configure bot behavior',
              value: 'general',
              emoji: '⚙️',
            },
          ])
      );
  },

  // Create main action buttons
  createMainActionButtons() {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_check_config')
          .setLabel('Check Current Configuration')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔍'),
        new ButtonBuilder()
          .setCustomId('setup_help_button')
          .setLabel('Help & Documentation')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓'),
        new ButtonBuilder()
          .setCustomId('setup_reset')
          .setLabel('Reset Configuration')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );
  },

  // Create back button
  createBackButton() {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_back_main')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );
  },

  // Get ticket system status text
  getTicketStatusText(config) {
    const parts = [];
    
    if (config.ticket_category_id) {
      parts.push('✅ **Category**: <#' + config.ticket_category_id + '>');
    } else {
      parts.push('❌ **Category**: Not configured');
    }
    
    if (config.support_role_id) {
      parts.push('✅ **Support Role**: <@&' + config.support_role_id + '>');
    } else {
      parts.push('❌ **Support Role**: Not configured');
    }
    
    if (config.log_channel_id) {
      parts.push('✅ **Log Channel**: <#' + config.log_channel_id + '>');
    } else {
      parts.push('❌ **Log Channel**: Not configured');
    }
    
    return parts.join('\n') || '❌ No ticket system configured';
  },

  // Get shop system status text
  getShopStatusText(config) {
    const parts = [];
    
    if (config.shop_channel_id) {
      parts.push('✅ **Shop Channel**: <#' + config.shop_channel_id + '>');
    } else {
      parts.push('❌ **Shop Channel**: Not configured');
    }
    
    if (config.customer_role_id) {
      parts.push('✅ **Customer Role**: <@&' + config.customer_role_id + '>');
    } else {
      parts.push('❌ **Customer Role**: Not configured');
    }
    
    parts.push('⏳ **Status**: Coming in Phase 2 (Q2 2025)');
    
    return parts.join('\n');
  },

  // Get general settings status text
  getGeneralStatusText(config) {
    const parts = [];
    parts.push('✅ **Bot Status**: Online and ready');
    parts.push('✅ **Database**: Connected');
    parts.push('⚙️ **Additional settings coming soon**');
    
    return parts.join('\n');
  },

  // Show current configuration
  async showCurrentConfig(interaction, client, config) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🔍 Current Configuration')
      .setDescription('Here is your current Igloo configuration:')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎫 Ticket System',
          value: this.getTicketStatusText(config),
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: this.getShopStatusText(config),
          inline: false,
        },
        {
          name: '⚙️ General Settings',
          value: this.getGeneralStatusText(config),
          inline: false,
        }
      )
      .setFooter({
        text: 'Use the menu above to configure different systems',
        iconURL: client.user.displayAvatarURL(),
      });

    const backButton = this.createBackButton();

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
  },

  // Show help information
  async showHelp(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('❓ Igloo Setup Help')
      .setDescription('Need help configuring Igloo? Here are the basics:')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎫 Ticket System',
          value: 'Set up support tickets with categories, roles, and logging. Perfect for customer support!',
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: 'Configure e-commerce features (coming in Phase 2). Set channels and customer roles now.',
          inline: false,
        },
        {
          name: '🚀 Quick Start',
          value: '1. Select a system from the menu\n2. Configure the required settings\n3. Test your setup\n4. You\'re ready to go!',
          inline: false,
        },
        {
          name: '📅 Roadmap',
          value: 'Phase 1: Tickets ✅\nPhase 2: Shop Panel (Q2 2025)\nPhase 3: Payments (Q3 2025)',
          inline: false,
        }
      )
      .setFooter({
        text: 'Use /setup help for more detailed information',
        iconURL: client.user.displayAvatarURL(),
      });

    const backButton = this.createBackButton();

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
  },

  // Show reset confirmation
  async showResetConfirmation(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.DANGER)
      .setTitle('🗑️ Reset Configuration')
      .setDescription('⚠️ **WARNING**: This will reset ALL Igloo configuration for this server!')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: 'What will be reset:',
          value: '• All ticket system settings\n• All shop system settings\n• All general bot settings\n• All stored data for this server',
          inline: false,
        },
        {
          name: 'This action cannot be undone!',
          value: 'Make sure you really want to do this before confirming.',
          inline: false,
        }
      );

    const confirmRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_reset_confirm')
          .setLabel('Yes, Reset Everything')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId('setup_back_main')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

    await interaction.update({
      embeds: [embed],
      components: [confirmRow],
    });
  },

  // Disable components when expired
  async disableComponents(interaction) {
    try {
      const expiredCategoryRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('setup_category_select_expired')
            .setPlaceholder('Setup panel expired - use /setup panel again')
            .addOptions([{ label: 'Expired', value: 'expired' }])
            .setDisabled(true)
        );

      const expiredActionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_check_config_expired')
            .setLabel('Check Current Configuration')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('setup_help_button_expired')
            .setLabel('Help & Documentation')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('setup_reset_expired')
            .setLabel('Reset Configuration')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(true)
        );

      await interaction.editReply({
        components: [expiredCategoryRow, expiredActionRow]
      });
    } catch (error) {
      // Ignore errors when disabling components
    }
  }
};