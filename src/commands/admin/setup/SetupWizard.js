// src/commands/admin/setup/SetupWizard.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { logger } = require('../../../utils/logger');

// Import modules
const TicketSetup = require('./TicketSetup');
const ShopSetup = require('./ShopSetup');
const GeneralSetup = require('./GeneralSetup');

/**
 * Handles the interactive setup wizard for the bot
 */
class SetupWizard {
  /**
   * Create a new setup wizard
   * @param {Client} client - Discord client
   * @param {ConfigService} configService - Configuration service
   */
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    this.wizardStep = 0;
    this.timeout = 10 * 60 * 1000; // 10 minutes
    
    // Initialize modules
    this.ticketSetup = new TicketSetup(client, configService);
    this.shopSetup = new ShopSetup(client, configService);
    this.generalSetup = new GeneralSetup(client, configService);
  }
  
  /**
   * Start the setup wizard
   * @param {Interaction} interaction - Command interaction
   */
  async start(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Get current guild configuration
      const guildConfig = await this.configService.getGuildConfig(interaction.guild.id);
      
      // Create welcome embed with ice theme
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('❄️ Igloo Setup Wizard')
        .setDescription(
          'Welcome to the Igloo Setup Wizard! This will guide you through setting up the bot for your server.\n\n' +
          'The setup is divided into 3 sections:\n' +
          '• 🎫 **Ticket System** - Configure ticket categories, support roles, and more\n' +
          '• 🛒 **Shop System** - Set up your shop channel, customer roles, and payment options\n' +
          '• ⚙️ **General Settings** - Configure bot permissions and other settings\n\n' +
          'Please select which section you would like to set up first:'
        )
        .setThumbnail(this.client.user.displayAvatarURL())
        .setFooter({ 
          text: 'Igloo Bot • Setup Wizard',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create section selection menu
      const sectionSelect = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('setup_section_select')
            .setPlaceholder('Select a section to configure')
            .addOptions([
              {
                label: 'Ticket System',
                value: 'tickets',
                description: 'Configure ticket settings',
                emoji: '🎫',
              },
              {
                label: 'Shop System',
                value: 'shop',
                description: 'Configure shop settings',
                emoji: '🛒',
              },
              {
                label: 'General Settings',
                value: 'general',
                description: 'Configure general bot settings',
                emoji: '⚙️',
              },
            ])
        );
      
      // Create navigation buttons
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_exit')
            .setLabel('Exit Wizard')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌'),
          new ButtonBuilder()
            .setCustomId('setup_complete')
            .setLabel('Complete Setup')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );
      
      // Send initial wizard interface
      const wizardMessage = await interaction.editReply({
        embeds: [welcomeEmbed],
        components: [sectionSelect, navigationButtons],
      });
      
      // Set up collector for section selection
      this.createSectionCollector(interaction, wizardMessage, guildConfig);
      
    } catch (error) {
      logger.error('Error starting setup wizard:', error);
      await interaction.editReply({
        content: '❌ An error occurred while starting the setup wizard. Please try again later.',
        components: [],
      });
    }
  }
  
  /**
   * Create a collector for section selection
   * @param {Interaction} interaction - Command interaction
   * @param {Message} message - Wizard message
   * @param {Object} config - Guild configuration
   */
  createSectionCollector(interaction, message, config) {
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: this.timeout,
      componentType: ComponentType.StringSelect,
    });
    
    collector.on('collect', async i => {
      // Handle section selection
      if (i.customId === 'setup_section_select') {
        const section = i.values[0];
        
        try {
          switch (section) {
            case 'tickets':
              await this.ticketSetup.createUI(i, config);
              break;
            case 'shop':
              await this.shopSetup.createUI(i, config);
              break;
            case 'general':
              await this.generalSetup.createUI(i, config);
              break;
          }
        } catch (error) {
          logger.error(`Error handling setup section ${section}:`, error);
          await i.reply({
            content: `❌ An error occurred while configuring ${section}. Please try again.`,
            ephemeral: true,
          });
        }
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        // Timeout
        interaction.editReply({
          content: '⏱️ Setup wizard timed out. Please run the command again to continue setup.',
          components: [],
          embeds: [],
        }).catch(e => logger.error('Error updating timed out wizard:', e));
      }
    });
    
    // Also create a button collector for navigation
    const buttonCollector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.isButton(),
      time: this.timeout,
    });
    
    buttonCollector.on('collect', async i => {
      if (i.customId === 'setup_exit') {
        await i.update({
          content: '✅ Setup wizard closed. You can run `/setup` again at any time.',
          components: [],
          embeds: [],
        });
        buttonCollector.stop();
        collector.stop();
      }
      
      if (i.customId === 'setup_complete') {
        const summary = await this.createSummary(interaction.guild.id);
        await i.update({
          content: '✅ Setup complete! Here is your configuration summary:',
          embeds: [summary],
          components: [],
        });
        buttonCollector.stop();
        collector.stop();
      }
    });
  }
  
  /**
   * Create a summary of the current configuration
   * @param {string} guildId - Guild ID
   * @returns {EmbedBuilder} Summary embed
   */
  async createSummary(guildId) {
    const config = await this.configService.getGuildConfig(guildId);
    
    const summaryEmbed = new EmbedBuilder()
      .setColor(0x0CAFFF)
      .setTitle('❄️ Igloo Configuration Summary')
      .setDescription('Here is your current Igloo configuration:')
      .setThumbnail(this.client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎫 Ticket System',
          value: this.formatTicketSummary(config),
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: this.formatShopSummary(config),
          inline: false,
        },
        {
          name: '⚙️ General Settings',
          value: this.formatGeneralSummary(config),
          inline: false,
        }
      )
      .setFooter({ 
        text: 'Igloo Bot • Setup Complete',
        iconURL: this.client.user.displayAvatarURL()
      })
      .setTimestamp();
      
    return summaryEmbed;
  }
  
  /**
   * Format ticket system summary
   * @param {Object} config - Guild configuration
   * @returns {string} Formatted summary
   */
  formatTicketSummary(config) {
    const ticketConfig = config.tickets || {};
    const parts = [];
    
    if (ticketConfig.category) {
      parts.push(`📁 **Category ID**: ${ticketConfig.category}`);
    } else {
      parts.push('📁 **Category**: Not configured');
    }
    
    if (ticketConfig.support_role) {
      parts.push(`👮 **Support Role ID**: ${ticketConfig.support_role}`);
    } else {
      parts.push('👮 **Support Role**: Not configured');
    }
    
    if (ticketConfig.log_channel) {
      parts.push(`📋 **Log Channel ID**: ${ticketConfig.log_channel}`);
    } else {
      parts.push('📋 **Log Channel**: Not configured');
    }
    
    if (ticketConfig.auto_close_hours) {
      parts.push(`⏱️ **Auto-Close**: ${ticketConfig.auto_close_hours} hours`);
    } else {
      parts.push('⏱️ **Auto-Close**: 72 hours (default)');
    }
    
    return parts.length > 0 ? parts.join('\n') : 'No ticket settings configured yet.';
  }
  
  /**
   * Format shop system summary
   * @param {Object} config - Guild configuration
   * @returns {string} Formatted summary
   */
  formatShopSummary(config) {
    const shopConfig = config.shop || {};
    const parts = [];
    
    if (shopConfig.channel) {
      parts.push(`🛍️ **Shop Channel ID**: ${shopConfig.channel}`);
    } else {
      parts.push('🛍️ **Shop Channel**: Not configured');
    }
    
    if (shopConfig.customer_role) {
      parts.push(`🏷️ **Customer Role ID**: ${shopConfig.customer_role}`);
    } else {
      parts.push('🏷️ **Customer Role**: Not configured');
    }
    
    parts.push('⏳ **Status**: Coming in Phase 2 (Q2 2025)');
    
    return parts.length > 0 ? parts.join('\n') : 'No shop settings configured yet.';
  }
  
  /**
   * Format general settings summary
   * @param {Object} config - Guild configuration
   * @returns {string} Formatted summary
   */
  formatGeneralSummary(config) {
    const generalConfig = config.general || {};
    const parts = [];
    
    parts.push('✅ **Bot Status**: Online and ready');
    
    if (generalConfig.admin_roles && generalConfig.admin_roles.length > 0) {
      const roleIds = generalConfig.admin_roles.join(', ');
      parts.push(`👑 **Admin Roles IDs**: ${roleIds}`);
    } else {
      parts.push('👑 **Admin Roles**: Not configured');
    }
    
    return parts.length > 0 ? parts.join('\n') : 'No general settings configured yet.';
  }
}

module.exports = SetupWizard;