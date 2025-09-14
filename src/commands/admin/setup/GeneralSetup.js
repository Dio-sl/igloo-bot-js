// src/commands/admin/setup/GeneralSetup.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { logger } = require('../../../utils/logger');

/**
 * Handles general bot configuration
 */
class GeneralSetup {
  /**
   * Create a new general setup handler
   * @param {Client} client - Discord client
   * @param {ConfigService} configService - Configuration service
   */
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    this.timeout = 10 * 60 * 1000; // 10 minutes
  }
  
  /**
   * Create the general setup UI
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async createUI(interaction, config) {
    const generalConfig = config.general || {};
    
    try {
      // Create general setup embed
      const setupEmbed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('⚙️ General Settings')
        .setDescription(
          'Configure general bot settings below. These settings affect the overall behavior of the bot.\n\n' +
          'Select an option to configure:'
        )
        .addFields(
          {
            name: '👑 Admin Roles',
            value: generalConfig.admin_roles && generalConfig.admin_roles.length > 0
              ? `Currently set to: ${generalConfig.admin_roles.map(id => `<@&${id}>`).join(', ')}` 
              : 'Not configured - Select roles that can use admin commands',
            inline: false,
          },
          {
            name: '🌐 Default Language',
            value: `Currently set to: ${generalConfig.locale || 'en-US'}`,
            inline: false,
          },
          {
            name: '🕒 Timezone',
            value: `Currently set to: ${generalConfig.timezone || 'UTC'}`,
            inline: false,
          }
        )
        .setFooter({ 
          text: 'Igloo Bot • General Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create option selection menu
      const optionSelect = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('general_setup_option')
            .setPlaceholder('Select an option to configure')
            .addOptions([
              {
                label: 'Admin Roles',
                value: 'admin_roles',
                description: 'Set roles that can use admin commands',
                emoji: '👑',
              },
              {
                label: 'Default Language',
                value: 'locale',
                description: 'Set the default language for the bot',
                emoji: '🌐',
              },
              {
                label: 'Timezone',
                value: 'timezone',
                description: 'Set the timezone for date/time displays',
                emoji: '🕒',
              },
            ])
        );
      
      // Create navigation buttons
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('general_setup_back')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️'),
          new ButtonBuilder()
            .setCustomId('general_setup_save')
            .setLabel('Save Settings')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾')
        );
      
      // Determine if we need to update or send a new message
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [setupEmbed],
          components: [optionSelect, navigationButtons],
        });
      } else {
        await interaction.update({
          embeds: [setupEmbed],
          components: [optionSelect, navigationButtons],
        });
      }
      
      // Create collector for interactions
      this.createSetupCollector(interaction, config);
      
    } catch (error) {
      logger.error('Error creating general setup UI:', error);
      
      // Determine how to respond based on the interaction state
      const errorResponse = {
        content: '❌ An error occurred while creating the general setup UI. Please try again.',
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
   * Create a collector for general setup interactions
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  createSetupCollector(interaction, config) {
    // Get the message to collect interactions from
    const message = interaction.message || interaction;
    
    // Create a collector for select menu interactions
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: this.timeout,
    });
    
    collector.on('collect', async i => {
      try {
        // Handle select menu interactions
        if (i.customId === 'general_setup_option') {
          const option = i.values[0];
          
          switch (option) {
            case 'admin_roles':
              await this.promptAdminRoleSelect(i, config);
              break;
            case 'locale':
              await this.promptLocaleSelect(i, config);
              break;
            case 'timezone':
              await this.promptTimezoneSelect(i, config);
              break;
          }
          
          return;
        }
        
        // Handle role selection
        if (i.customId === 'admin_role_select') {
          // Make sure we have values
          if (!i.values || i.values.length === 0) {
            await i.reply({
              content: '❌ No roles selected. Please try again.',
              ephemeral: true,
            });
            return;
          }
          
          const roleIds = i.values;
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'general',
            'admin_roles',
            roleIds
          );
          
          // Update the config object
          if (!config.general) config.general = {};
          config.general.admin_roles = roleIds;
          
          // Show success message
          const roleList = roleIds.map(id => `<@&${id}>`).join(', ');
          await i.update({
            content: `✅ Successfully set admin roles to: ${roleList}`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main general setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle locale selection
        if (i.customId === 'locale_select') {
          // Make sure we have values
          if (!i.values || !i.values[0]) {
            await i.reply({
              content: '❌ No language selected. Please try again.',
              ephemeral: true,
            });
            return;
          }
          
          const locale = i.values[0];
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'general',
            'locale',
            locale
          );
          
          // Update the config object
          if (!config.general) config.general = {};
          config.general.locale = locale;
          
          // Show success message
          await i.update({
            content: `✅ Successfully set the default language to: ${locale}`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main general setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle timezone selection
        if (i.customId === 'timezone_select') {
          // Make sure we have values
          if (!i.values || !i.values[0]) {
            await i.reply({
              content: '❌ No timezone selected. Please try again.',
              ephemeral: true,
            });
            return;
          }
          
          const timezone = i.values[0];
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'general',
            'timezone',
            timezone
          );
          
          // Update the config object
          if (!config.general) config.general = {};
          config.general.timezone = timezone;
          
          // Show success message
          await i.update({
            content: `✅ Successfully set the timezone to: ${timezone}`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main general setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle navigation buttons
        if (i.customId === 'general_setup_back') {
          // Stop this collector
          collector.stop();
          
          // Defer the update to avoid errors
          await i.deferUpdate();
          
          // Return to the main setup menu
          const SetupWizard = require('./SetupWizard');
          const wizard = new SetupWizard(this.client, this.configService);
          await wizard.start(interaction);
          
          return;
        }
        
        if (i.customId === 'general_setup_save') {
          // Show success message
          await i.update({
            content: '✅ General settings saved successfully!',
            components: [],
            embeds: [],
          });
          
          // Stop the collector
          collector.stop();
          
          return;
        }
        
      } catch (error) {
        logger.error('Error handling general setup interaction:', error);
        
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
          content: '⏱️ General setup timed out. Please run the command again to continue setup.',
          components: [],
          embeds: [],
        }).catch(e => logger.error('Error updating timed out setup:', e));
      }
    });
  }
  
  /**
   * Prompt for admin role selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptAdminRoleSelect(interaction, config) {
    try {
      // Get all roles except @everyone
      const roles = interaction.guild.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)
      
      if (roles.size === 0) {
        await interaction.reply({
          content: '❌ No roles found in this server. Please create a role first.',
          ephemeral: true,
        });
        return;
      }
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('👑 Select Admin Roles')
        .setDescription(
          'Select roles that can use admin commands.\n\n' +
          'Members with these roles will be able to access all administrative ' +
          'functions of the bot, including setup and configuration.\n\n' +
          '**Note**: Users with the Administrator permission in Discord can ' +
          'always use admin commands, regardless of roles.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Admin Roles Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create the select menu with role options
      const options = roles.map(role => ({
        label: role.name,
        value: role.id,
        description: `ID: ${role.id}`,
      })).slice(0, 25); // Maximum 25 options
      
      const selectMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('admin_role_select')
            .setPlaceholder('Select admin roles')
            .setMinValues(1)
            .setMaxValues(Math.min(options.length, 10)) // Up to 10 roles or all available
            .addOptions(options)
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for admin role selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading roles. Please try again.',
        ephemeral: true,
      });
    }
  }
  
  /**
   * Prompt for locale selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptLocaleSelect(interaction, config) {
    try {
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('🌐 Select Default Language')
        .setDescription(
          'Select the default language for the bot.\n\n' +
          'This will affect all default messages sent by the bot, ' +
          'including ticket panels, welcome messages, and notifications.\n\n' +
          '**Note**: Full localization will be available in a future update.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Language Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create the select menu with language options
      const selectMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('locale_select')
            .setPlaceholder('Select a language')
            .addOptions([
              {
                label: 'English (US)',
                value: 'en-US',
                description: 'English (United States)',
                emoji: '🇺🇸',
              },
              {
                label: 'English (UK)',
                value: 'en-GB',
                description: 'English (United Kingdom)',
                emoji: '🇬🇧',
              },
              {
                label: 'Español',
                value: 'es-ES',
                description: 'Spanish',
                emoji: '🇪🇸',
              },
              {
                label: 'Français',
                value: 'fr-FR',
                description: 'French',
                emoji: '🇫🇷',
              },
              {
                label: 'Deutsch',
                value: 'de-DE',
                description: 'German',
                emoji: '🇩🇪',
              },
            ])
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for locale selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while creating the language prompt. Please try again.',
        ephemeral: true,
      });
    }
  }
  
  /**
   * Prompt for timezone selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptTimezoneSelect(interaction, config) {
    try {
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('🕒 Select Timezone')
        .setDescription(
          'Select the timezone for date and time displays.\n\n' +
          'This will affect how dates and times are displayed in messages, ' +
          'logs, and other time-sensitive information.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Timezone Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create the select menu with common timezone options
      const selectMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('timezone_select')
            .setPlaceholder('Select a timezone')
            .addOptions([
              {
                label: 'UTC',
                value: 'UTC',
                description: 'Coordinated Universal Time',
                emoji: '🌍',
              },
              {
                label: 'America/New_York',
                value: 'America/New_York',
                description: 'Eastern Time (US & Canada)',
                emoji: '🇺🇸',
              },
              {
                label: 'America/Chicago',
                value: 'America/Chicago',
                description: 'Central Time (US & Canada)',
                emoji: '🇺🇸',
              },
              {
                label: 'America/Denver',
                value: 'America/Denver',
                description: 'Mountain Time (US & Canada)',
                emoji: '🇺🇸',
              },
              {
                label: 'America/Los_Angeles',
                value: 'America/Los_Angeles',
                description: 'Pacific Time (US & Canada)',
                emoji: '🇺🇸',
              },
              {
                label: 'Europe/London',
                value: 'Europe/London',
                description: 'Greenwich Mean Time',
                emoji: '🇬🇧',
              },
              {
                label: 'Europe/Paris',
                value: 'Europe/Paris',
                description: 'Central European Time',
                emoji: '🇪🇺',
              },
              {
                label: 'Asia/Tokyo',
                value: 'Asia/Tokyo',
                description: 'Japan Standard Time',
                emoji: '🇯🇵',
              },
              {
                label: 'Australia/Sydney',
                value: 'Australia/Sydney',
                description: 'Australian Eastern Time',
                emoji: '🇦🇺',
              },
            ])
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for timezone selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while creating the timezone prompt. Please try again.',
        ephemeral: true,
      });
    }
  }
}

module.exports = GeneralSetup;