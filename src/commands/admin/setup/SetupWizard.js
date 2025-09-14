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
    try {
      // Ensure the interaction is deferred
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
      
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
      
      // Send or update the wizard interface
      let wizardMessage;
      try {
        wizardMessage = await interaction.editReply({
          content: null,
          embeds: [welcomeEmbed],
          components: [sectionSelect, navigationButtons],
        });
      } catch (error) {
        logger.error('Error sending initial wizard interface:', error);
        
        // Try to send a new message if editing fails
        try {
          wizardMessage = await interaction.followUp({
            embeds: [welcomeEmbed],
            components: [sectionSelect, navigationButtons],
            ephemeral: true,
          });
        } catch (followUpError) {
          logger.error('Error sending followUp wizard interface:', followUpError);
          throw followUpError;
        }
      }
      
      // Set up collector for section selection
      this.createSectionCollector(interaction, wizardMessage, guildConfig);
      
    } catch (error) {
      logger.error('Error starting setup wizard:', error);
      
      // Try to send an error message
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            content: '❌ An error occurred while starting the setup wizard. Please try again later.',
            components: [],
            embeds: [],
          });
        } else {
          await interaction.reply({
            content: '❌ An error occurred while starting the setup wizard. Please try again later.',
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error('Error sending setup error message:', replyError);
      }
    }
  }
  
  /**
   * Create a collector for section selection
   * @param {Interaction} interaction - Command interaction
   * @param {Message} message - Wizard message
   * @param {Object} config - Guild configuration
   */
  createSectionCollector(interaction, message, config) {
    const filter = i => i.user.id === interaction.user.id;
    
    // Create a collector for interactions
    const collector = message.createMessageComponentCollector({
      filter,
      time: this.timeout,
    });
    
    collector.on('collect', async i => {
      try {
        // Try to defer the update first
        let deferSuccess = false;
        try {
          await i.deferUpdate();
          deferSuccess = true;
        } catch (deferError) {
          logger.warn(`Could not defer ${i.customId}:`, deferError.message);
        }
        
        // Handle section selection
        if (i.customId === 'setup_section_select') {
          const section = i.values[0];
          collector.stop();
          
          // Create a transitional message
          try {
            const transitionalContent = `Loading ${
              section === 'tickets' ? '🎫 ticket system' :
              section === 'shop' ? '🛒 shop system' :
              '⚙️ general settings'
            } setup...`;
            
            if (deferSuccess) {
              await i.editReply({
                content: transitionalContent,
                embeds: [],
                components: [],
              });
            } else {
              // If we couldn't defer, try to send a new message
              await interaction.followUp({
                content: transitionalContent,
                ephemeral: true,
              });
            }
            
            // Wait for the Discord API to register the edit
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Launch the appropriate setup interface with the original interaction
            switch (section) {
              case 'tickets':
                await this.ticketSetup.createUI(interaction, config);
                break;
              case 'shop':
                await this.shopSetup.createUI(interaction, config);
                break;
              case 'general':
                await this.generalSetup.createUI(interaction, config);
                break;
            }
          } catch (error) {
            logger.error(`Error loading ${section} setup:`, error);
            
            // Try to send an error message
            try {
              await interaction.followUp({
                content: `❌ An error occurred while loading the ${section} setup. Please try again.`,
                ephemeral: true,
              });
              
              // Try to restart the wizard after a short delay
              setTimeout(() => {
                this.start(interaction).catch(e => 
                  logger.error('Error restarting wizard after error:', e)
                );
              }, 2000);
            } catch (followUpError) {
              logger.error('Error sending section error message:', followUpError);
            }
          }
        }
        
        // Handle exit button
        else if (i.customId === 'setup_exit') {
          collector.stop();
          
          try {
            if (deferSuccess) {
              await i.editReply({
                content: '✅ Setup wizard closed. You can run `/setup` again at any time.',
                components: [],
                embeds: [],
              });
            } else {
              await interaction.followUp({
                content: '✅ Setup wizard closed. You can run `/setup` again at any time.',
                ephemeral: true,
              });
            }
          } catch (exitError) {
            logger.error('Error sending exit message:', exitError);
          }
        }
        
        // Handle complete button
        else if (i.customId === 'setup_complete') {
          collector.stop();
          
          try {
            // Get latest config and create summary
            const latestConfig = await this.configService.getGuildConfig(interaction.guild.id);
            const summary = await this.createSummary(interaction.guild.id);
            
            if (deferSuccess) {
              await i.editReply({
                content: '✅ Setup complete! Here is your configuration summary:',
                embeds: [summary],
                components: [],
              });
            } else {
              await interaction.followUp({
                content: '✅ Setup complete! Here is your configuration summary:',
                embeds: [summary],
                ephemeral: true,
              });
            }
          } catch (completeError) {
            logger.error('Error sending completion summary:', completeError);
            
            // Try to send a simplified message
            try {
              await interaction.followUp({
                content: '✅ Setup complete! Your settings have been saved.',
                ephemeral: true,
              });
            } catch (simplifiedError) {
              logger.error('Error sending simplified completion message:', simplifiedError);
            }
          }
        }
      } catch (error) {
        logger.error('Error handling wizard interaction:', error);
        
        // Try to send an error message
        try {
          await interaction.followUp({
            content: '❌ An error occurred. Please try again or run the `/setup` command again.',
            ephemeral: true,
          });
        } catch (followUpError) {
          logger.error('Error sending error followUp:', followUpError);
        }
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        // Timeout - send a timeout message
        try {
          interaction.followUp({
            content: '⏱️ Setup wizard timed out. Please run the command again to continue setup.',
            ephemeral: true,
          }).catch(e => logger.error('Error sending timeout message:', e));
        } catch (error) {
          logger.error('Error sending timeout message:', error);
        }
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