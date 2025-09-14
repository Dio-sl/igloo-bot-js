// src/commands/admin/setup/ShopSetup.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { logger } = require('../../../utils/logger');

/**
 * Handles shop system configuration
 */
class ShopSetup {
  /**
   * Create a new shop setup handler
   * @param {Client} client - Discord client
   * @param {ConfigService} configService - Configuration service
   */
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    this.timeout = 10 * 60 * 1000; // 10 minutes
  }
  
  /**
   * Create the shop setup UI
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async createUI(interaction, config) {
    try {
      // For Phase 1, this is just a placeholder that shows the shop is coming in Phase 2
      const setupEmbed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('🛒 Shop System Setup')
        .setDescription(
          '**The shop system will be available in Phase 2 (Q2 2025).**\n\n' +
          'This upcoming feature will allow you to:\n' +
          '• Create a shop panel for your Discord server\n' +
          '• Add and manage products with descriptions and prices\n' +
          '• Process payments through Stripe integration\n' +
          '• Automate digital product delivery\n' +
          '• Track orders and manage inventory\n\n' +
          'Stay tuned for updates!'
        )
        .setFooter({ 
          text: 'Igloo Bot • Shop Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create navigation button
      const navigationButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('shop_setup_back')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
        );
      
      // Determine if we need to update or send a new message
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [setupEmbed],
          components: [navigationButton],
        });
      } else {
        await interaction.update({
          embeds: [setupEmbed],
          components: [navigationButton],
        });
      }
      
      // Create collector for the back button
      this.createSetupCollector(interaction, config);
      
    } catch (error) {
      logger.error('Error creating shop setup UI:', error);
      
      // Determine how to respond based on the interaction state
      const errorResponse = {
        content: '❌ An error occurred while creating the shop setup UI. Please try again.',
        components: [],
        embeds: [],
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorResponse);
      } else {
        await interaction.update(errorResponse);
      }
    }
  }
  
  /**
   * Create a collector for shop setup interactions
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  createSetupCollector(interaction, config) {
    // Get the message to collect interactions from
    const message = interaction.message || interaction;
    
    // Create a collector for button interactions
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: this.timeout,
    });
    
    collector.on('collect', async i => {
      try {
        // Handle back button
        if (i.customId === 'shop_setup_back') {
          // Stop this collector
          collector.stop();
          
          // Defer the update to avoid errors
          await i.deferUpdate();
          
          // Return to the main setup menu
          const SetupWizard = require('./SetupWizard');
          const wizard = new SetupWizard(this.client, this.configService);
          await wizard.start(interaction);
        }
      } catch (error) {
        logger.error('Error handling shop setup interaction:', error);
        
        try {
          await i.reply({
            content: '❌ An error occurred while processing your selection. Please try again.',
            ephemeral: true,
          });
        } catch (replyError) {
          logger.error('Error sending error message:', replyError);
        }
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        // Timeout
        interaction.editReply({
          content: '⏱️ Shop setup timed out. Please run the command again to continue setup.',
          components: [],
          embeds: [],
        }).catch(e => logger.error('Error updating timed out setup:', e));
      }
    });
  }
}

module.exports = ShopSetup;