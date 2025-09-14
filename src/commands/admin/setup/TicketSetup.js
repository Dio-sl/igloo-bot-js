// src/commands/admin/setup/TicketSetup.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { logger } = require('../../../utils/logger');

/**
 * Handles ticket system configuration
 */
class TicketSetup {
  /**
   * Create a new ticket setup handler
   * @param {Client} client - Discord client
   * @param {ConfigService} configService - Configuration service
   */
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    this.timeout = 10 * 60 * 1000; // 10 minutes
  }
  
  /**
   * Create the ticket setup UI
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async createUI(interaction, config) {
    const ticketConfig = config.tickets || {};
    
    try {
      // Create ticket setup embed
      const setupEmbed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('🎫 Ticket System Setup')
        .setDescription(
          'Configure your ticket system settings below. Each option will help personalize your ticket system.\n\n' +
          'Select an option to configure:'
        )
        .addFields(
          {
            name: '📁 Ticket Category',
            value: ticketConfig.category 
              ? `Currently set to: <#${ticketConfig.category}>` 
              : 'Not configured - Select a category channel where tickets will be created',
            inline: false,
          },
          {
            name: '👮 Support Role',
            value: ticketConfig.support_role 
              ? `Currently set to: <@&${ticketConfig.support_role}>` 
              : 'Not configured - Select a role that will have access to all tickets',
            inline: false,
          },
          {
            name: '📋 Log Channel',
            value: ticketConfig.log_channel 
              ? `Currently set to: <#${ticketConfig.log_channel}>` 
              : 'Not configured - Select a channel for ticket logs',
            inline: false,
          },
          {
            name: '⏱️ Auto-Close Time',
            value: `Currently set to: ${ticketConfig.auto_close_hours || 72} hours`,
            inline: false,
          }
        )
        .setFooter({ 
          text: 'Igloo Bot • Ticket Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create option selection menu
      const optionSelect = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('ticket_setup_option')
            .setPlaceholder('Select an option to configure')
            .addOptions([
              {
                label: 'Ticket Category',
                value: 'category',
                description: 'Set the category for ticket channels',
                emoji: '📁',
              },
              {
                label: 'Support Role',
                value: 'support_role',
                description: 'Set the role that can access all tickets',
                emoji: '👮',
              },
              {
                label: 'Log Channel',
                value: 'log_channel',
                description: 'Set the channel for ticket logs',
                emoji: '📋',
              },
              {
                label: 'Auto-Close Time',
                value: 'auto_close_hours',
                description: 'Set how long before inactive tickets close',
                emoji: '⏱️',
              },
            ])
        );
      
      // Create navigation buttons
      const navigationButtons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_setup_back')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️'),
          new ButtonBuilder()
            .setCustomId('ticket_setup_save')
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
      logger.error('Error creating ticket setup UI:', error);
      
      // Determine how to respond based on the interaction state
      const errorResponse = {
        content: '❌ An error occurred while creating the ticket setup UI. Please try again.',
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
   * Create a collector for ticket setup interactions
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
        if (i.customId === 'ticket_setup_option') {
          const option = i.values[0];
          
          switch (option) {
            case 'category':
              await this.promptCategorySelect(i, config);
              break;
            case 'support_role':
              await this.promptRoleSelect(i, config);
              break;
            case 'log_channel':
              await this.promptLogChannelSelect(i, config);
              break;
            case 'auto_close_hours':
              await this.promptAutoCloseHours(i, config);
              break;
          }
          
          return;
        }
        
        // Handle channel selection
        if (i.customId === 'channel_select') {
          // Make sure we have values
          if (!i.values || !i.values[0]) {
            await i.reply({
              content: '❌ No channel selected. Please try again.',
              ephemeral: true,
            });
            return;
          }
          
          const channelId = i.values[0];
          const settingType = i.message.embeds[0].title.includes('Category') 
            ? 'category' 
            : 'log_channel';
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'tickets',
            settingType,
            channelId
          );
          
          // Update the config object
          if (!config.tickets) config.tickets = {};
          config.tickets[settingType] = channelId;
          
          // Show success message
          await i.update({
            content: `✅ Successfully set the ${settingType === 'category' ? 'ticket category' : 'log channel'} to <#${channelId}>`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main ticket setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle role selection
        if (i.customId === 'role_select') {
          // Make sure we have values
          if (!i.values || !i.values[0]) {
            await i.reply({
              content: '❌ No role selected. Please try again.',
              ephemeral: true,
            });
            return;
          }
          
          const roleId = i.values[0];
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'tickets',
            'support_role',
            roleId
          );
          
          // Update the config object
          if (!config.tickets) config.tickets = {};
          config.tickets.support_role = roleId;
          
          // Show success message
          await i.update({
            content: `✅ Successfully set the support role to <@&${roleId}>`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main ticket setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle auto-close time buttons
        if (i.customId.startsWith('auto_close_')) {
          const hours = parseInt(i.customId.split('_')[2]);
          
          // Update the config
          await this.configService.updateGuildConfig(
            interaction.guild.id,
            'tickets',
            'auto_close_hours',
            hours
          );
          
          // Update the config object
          if (!config.tickets) config.tickets = {};
          config.tickets.auto_close_hours = hours;
          
          // Show success message
          await i.update({
            content: `✅ Successfully set the auto-close time to ${hours} hours`,
            components: [],
            embeds: [],
          });
          
          // After a short delay, return to the main ticket setup
          setTimeout(async () => {
            await this.createUI(interaction, config);
          }, 2000);
          
          return;
        }
        
        // Handle navigation buttons
        if (i.customId === 'ticket_setup_back') {
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
        
        if (i.customId === 'ticket_setup_save') {
          // Show success message
          await i.update({
            content: '✅ Ticket system settings saved successfully!',
            components: [],
            embeds: [],
          });
          
          // Stop the collector
          collector.stop();
          
          return;
        }
        
      } catch (error) {
        logger.error('Error handling ticket setup interaction:', error);
        
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
          content: '⏱️ Ticket setup timed out. Please run the command again to continue setup.',
          components: [],
          embeds: [],
        }).catch(e => logger.error('Error updating timed out setup:', e));
      }
    });
  }
  
  /**
   * Prompt for category channel selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptCategorySelect(interaction, config) {
    try {
      // Get all category channels
      const categories = interaction.guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildCategory
      );
      
      if (categories.size === 0) {
        await interaction.reply({
          content: '❌ No category channels found in this server. Please create a category first.',
          ephemeral: true,
        });
        return;
      }
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('📁 Select Ticket Category')
        .setDescription(
          'Select a category channel where ticket channels will be created.\n\n' +
          'This category should have appropriate permissions set up for your staff members. ' +
          'The bot will automatically set permissions for each ticket creator.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Ticket Category Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create the select menu with category options
      const options = categories.map(category => ({
        label: category.name,
        value: category.id,
        description: `ID: ${category.id}`,
      })).slice(0, 25); // Maximum 25 options
      
      const selectMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('channel_select')
            .setPlaceholder('Select a category channel')
            .addOptions(options)
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for category selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading category channels. Please try again.',
        ephemeral: true,
      });
    }
  }
  
  /**
   * Prompt for support role selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptRoleSelect(interaction, config) {
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
        .setTitle('👮 Select Support Role')
        .setDescription(
          'Select a role that will have access to all tickets.\n\n' +
          'Members with this role will be able to view and respond to all tickets, ' +
          'regardless of who created them.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Support Role Setup',
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
            .setCustomId('role_select')
            .setPlaceholder('Select a support role')
            .addOptions(options)
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for role selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading roles. Please try again.',
        ephemeral: true,
      });
    }
  }
  
  /**
   * Prompt for log channel selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptLogChannelSelect(interaction, config) {
    try {
      // Get all text channels
      const textChannels = interaction.guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildText
      );
      
      if (textChannels.size === 0) {
        await interaction.reply({
          content: '❌ No text channels found in this server. Please create a text channel first.',
          ephemeral: true,
        });
        return;
      }
      
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('📋 Select Log Channel')
        .setDescription(
          'Select a text channel where ticket logs will be sent.\n\n' +
          'This channel will receive notifications when tickets are created, closed, or deleted. ' +
          'It should be a private channel that only staff can access.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Log Channel Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create the select menu with channel options
      const options = textChannels.map(channel => ({
        label: channel.name,
        value: channel.id,
        description: `ID: ${channel.id}`,
      })).slice(0, 25); // Maximum 25 options
      
      const selectMenu = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('channel_select')
            .setPlaceholder('Select a log channel')
            .addOptions(options)
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [selectMenu],
      });
      
    } catch (error) {
      logger.error('Error prompting for log channel selection:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading channels. Please try again.',
        ephemeral: true,
      });
    }
  }
  
  /**
   * Prompt for auto-close hours selection
   * @param {Interaction} interaction - Command interaction
   * @param {Object} config - Guild configuration
   */
  async promptAutoCloseHours(interaction, config) {
    try {
      // Create the embed
      const embed = new EmbedBuilder()
        .setColor(0x0CAFFF)
        .setTitle('⏱️ Set Auto-Close Time')
        .setDescription(
          'Select how long (in hours) before inactive tickets are automatically closed.\n\n' +
          'Inactive tickets will receive a warning message before being closed. ' +
          'This helps keep your server clean and organized.'
        )
        .setFooter({ 
          text: 'Igloo Bot • Auto-Close Setup',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Create buttons for common hour options
      const hoursButtons1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('auto_close_24')
            .setLabel('24 Hours')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('auto_close_48')
            .setLabel('48 Hours')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('auto_close_72')
            .setLabel('72 Hours')
            .setStyle(ButtonStyle.Primary)
        );
      
      const hoursButtons2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('auto_close_120')
            .setLabel('5 Days')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('auto_close_168')
            .setLabel('7 Days')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('auto_close_0')
            .setLabel('Disable Auto-Close')
            .setStyle(ButtonStyle.Danger)
        );
      
      // Send the prompt
      await interaction.update({
        embeds: [embed],
        components: [hoursButtons1, hoursButtons2],
      });
      
    } catch (error) {
      logger.error('Error prompting for auto-close hours:', error);
      await interaction.reply({
        content: '❌ An error occurred while creating the auto-close prompt. Please try again.',
        ephemeral: true,
      });
    }
  }
}

module.exports = TicketSetup;