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
      }).catch(e => logger.error('Error sending setup error message:', e));
    }
  }
  
  /**
   * Create a collector for section selection
   * @param {Interaction} interaction - Command interaction
   * @param {Message} message - Wizard message
   * @param {Object} config - Guild configuration
   */
  createSectionCollector(interaction, message, config) {
    // Create a collector for select menu interactions
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: this.timeout,
    });
    
    collector.on('collect', async i => {
      try {
        // Handle section selection
        if (i.customId === 'setup_section_select') {
          // IMPORTANT: Always defer the interaction first
          await i.deferUpdate().catch(e => logger.warn(`Could not defer setup_section_select:`, e));
          
          const section = i.values[0];
          console.log(`Detected setup dropdown: ${i.customId} - Selected ${section}`);
          
          // Create a new interaction response for the selected section
          try {
            switch (section) {
              case 'tickets':
                // Create a transitional message to prevent interaction conflicts
                await i.editReply({
                  content: '🎫 Loading ticket system setup...',
                  embeds: [],
                  components: [],
                }).catch(e => logger.error('Error sending transition message:', e));
                
                // Wait a short delay to ensure Discord registers the edit
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Now create the ticket setup UI with a new interaction
                await this.ticketSetup.createUI(interaction, config);
                break;
                
              case 'shop':
                // Create a transitional message to prevent interaction conflicts
                await i.editReply({
                  content: '🛒 Loading shop system setup...',
                  embeds: [],
                  components: [],
                }).catch(e => logger.error('Error sending transition message:', e));
                
                // Wait a short delay to ensure Discord registers the edit
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Now create the shop setup UI with a new interaction
                await this.shopSetup.createUI(interaction, config);
                break;
                
              case 'general':
                // Create a transitional message to prevent interaction conflicts
                await i.editReply({
                  content: '⚙️ Loading general settings setup...',
                  embeds: [],
                  components: [],
                }).catch(e => logger.error('Error sending transition message:', e));
                
                // Wait a short delay to ensure Discord registers the edit
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Now create the general setup UI with a new interaction
                await this.generalSetup.createUI(interaction, config);
                break;
                
              default:
                await i.editReply({
                  content: '❌ Unknown section selected. Please try again.',
                  components: [],
                  embeds: [],
                }).catch(e => logger.error('Error sending unknown section message:', e));
                
                // After a short delay, go back to the main wizard
                setTimeout(() => {
                  this.start(interaction).catch(e => logger.error('Error restarting wizard:', e));
                }, 2000);
            }
          } catch (error) {
            logger.error(`Error handling setup section ${section}:`, error);
            
            // Try to respond with an error, but handle errors gracefully
            try {
              await i.editReply({
                content: `❌ An error occurred while configuring ${section}. Please try again.`,
                components: [],
                embeds: [],
              }).catch(e => logger.error('Error sending section error message:', e));
              
              // After a short delay, go back to the main wizard
              setTimeout(() => {
                this.start(interaction).catch(e => logger.error('Error restarting wizard after error:', e));
              }, 3000);
            } catch (replyError) {
              logger.error('Error sending section error message:', replyError);
            }
          }
        }
        
        // Handle navigation buttons
        if (i.customId === 'setup_exit') {
          // Stop the collector
          collector.stop();
          
          // Always defer the update first
          await i.deferUpdate().catch(e => logger.warn(`Could not defer setup_exit:`, e));
          
          // Send exit message
          await i.editReply({
            content: '✅ Setup wizard closed. You can run `/setup` again at any time.',
            components: [],
            embeds: [],
          }).catch(e => logger.error('Error sending exit message:', e));
        }
        
        if (i.customId === 'setup_complete') {
          // Stop the collector
          collector.stop();
          
          // Always defer the update first
          await i.deferUpdate().catch(e => logger.warn(`Could not defer setup_complete:`, e));
          
          // Create and send the summary
          try {
            const summary = await this.createSummary(interaction.guild.id);
            await i.editReply({
              content: '✅ Setup complete! Here is your configuration summary:',
              embeds: [summary],
              components: [],
            }).catch(e => logger.error('Error sending summary:', e));
          } catch (error) {
            logger.error('Error creating summary:', error);
            await i.editReply({
              content: '❌ An error occurred while creating the summary. Your settings have been saved.',
              components: [],
              embeds: [],
            }).catch(e => logger.error('Error sending summary error message:', e));
          }
        }
      } catch (error) {
        logger.error('Error in setup wizard collector:', error);
        
        // Try to send an error message, but handle any errors
        try {
          if (!i.replied && !i.deferred) {
            await i.reply({
              content: '❌ An error occurred. Please try again.',
              ephemeral: true,
            }).catch(e => logger.error('Error sending collector error reply:', e));
          } else {
            await i.followUp({
              content: '❌ An error occurred. Please try again.',
              ephemeral: true,
            }).catch(e => logger.error('Error sending collector error followup:', e));
          }
        } catch (replyError) {
          logger.error('Error sending collector error message:', replyError);
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