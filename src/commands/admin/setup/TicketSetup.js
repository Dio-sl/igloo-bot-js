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
      
      // Determine the best way to send/update the message
      let reply;
      
      try {
        if (interaction.deferred || interaction.replied) {
          reply = await interaction.editReply({
            content: null,
            embeds: [setupEmbed],
            components: [optionSelect, navigationButtons],
          });
        } else {
          // If it's a fresh interaction, defer it first
          await interaction.deferReply({ ephemeral: true });
          reply = await interaction.editReply({
            embeds: [setupEmbed],
            components: [optionSelect, navigationButtons],
          });
        }
        
        // Create new collectors for this message
        this.setupOptionCollectors(interaction, reply, config);
        
      } catch (error) {
        logger.error('Error sending ticket setup UI:', error);
        // If we failed to reply, try to send a new message
        try {
          await interaction.followUp({
            content: '🎫 Ticket Setup',
            embeds: [setupEmbed],
            components: [optionSelect, navigationButtons],
            ephemeral: true,
          }).then(msg => {
            this.setupOptionCollectors(interaction, msg, config);
          });
        } catch (followUpError) {
          logger.error('Error sending followUp message:', followUpError);
          // Last resort: try to send a new command
          try {
            await interaction.channel.send({
              content: `<@${interaction.user.id}>, here's your ticket setup (the previous interaction expired):`,
              embeds: [setupEmbed],
              components: [optionSelect, navigationButtons],
            }).then(msg => {
              this.setupOptionCollectors(interaction, msg, config);
            });
          } catch (channelError) {
            logger.error('Error sending channel message:', channelError);
          }
        }
      }
    } catch (error) {
      logger.error('Error creating ticket setup UI:', error);
    }
  }
  
  /**
   * Set up collectors for the ticket setup options
   * @param {Interaction} interaction - Original interaction
   * @param {Message} message - Message to collect from
   * @param {Object} config - Guild configuration
   */
  setupOptionCollectors(interaction, message, config) {
    const filter = i => i.user.id === interaction.user.id;
    
    const collector = message.createMessageComponentCollector({
      filter,
      time: this.timeout,
    });
    
    collector.on('collect', async i => {
      try {
        // Try to defer the update first
        try {
          await i.deferUpdate();
        } catch (deferError) {
          logger.warn(`Could not defer interaction ${i.customId}:`, deferError.message);
          // Continue anyway - we'll handle the response differently if deferring failed
        }
        
        // Handle option selection
        if (i.customId === 'ticket_setup_option') {
          const option = i.values[0];
          
          // Create a new message with the selected option UI
          try {
            switch (option) {
              case 'category':
                await this.showCategorySelection(i, config);
                break;
              case 'support_role':
                await this.showRoleSelection(i, config);
                break;
              case 'log_channel':
                await this.showLogChannelSelection(i, config);
                break;
              case 'auto_close_hours':
                await this.showAutoCloseOptions(i, config);
                break;
            }
          } catch (optionError) {
            logger.error(`Error handling option ${option}:`, optionError);
            await this.safeReply(i, {
              content: `❌ Error configuring ${option}. Please try again.`,
              embeds: [],
              components: [],
            });
            
            // Try to return to the main menu after a short delay
            setTimeout(() => {
              this.createUI(interaction, config).catch(e => 
                logger.error('Error returning to setup UI after option error:', e)
              );
            }, 2000);
          }
        }
        
        // Handle navigation buttons
        else if (i.customId === 'ticket_setup_back') {
          collector.stop();
          
          try {
            await this.safeReply(i, {
              content: '⬅️ Returning to main menu...',
              embeds: [],
              components: [],
            });
            
            // Return to the main menu after a short delay
            setTimeout(async () => {
              try {
                const SetupWizard = require('./SetupWizard');
                const wizard = new SetupWizard(this.client, this.configService);
                await wizard.start(interaction);
              } catch (wizardError) {
                logger.error('Error starting setup wizard:', wizardError);
              }
            }, 1000);
          } catch (backError) {
            logger.error('Error handling back button:', backError);
          }
        }
        
        else if (i.customId === 'ticket_setup_save') {
          collector.stop();
          
          try {
            await this.safeReply(i, {
              content: '✅ Ticket settings saved successfully!',
              embeds: [],
              components: [],
            });
          } catch (saveError) {
            logger.error('Error handling save button:', saveError);
          }
        }
        
        // Handle channel selection
        else if (i.customId === 'channel_select') {
          try {
            if (!i.values || !i.values[0]) {
              await this.safeReply(i, {
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
            await this.safeReply(i, {
              content: `✅ Successfully set the ${settingType === 'category' ? 'ticket category' : 'log channel'} to <#${channelId}>`,
              components: [],
              embeds: [],
            });
            
            // After a short delay, return to the main ticket setup
            setTimeout(() => {
              this.createUI(interaction, config).catch(e => 
                logger.error('Error returning to setup UI after channel selection:', e)
              );
            }, 2000);
          } catch (channelError) {
            logger.error('Error handling channel selection:', channelError);
          }
        }
        
        // Handle role selection
        else if (i.customId === 'role_select') {
          try {
            if (!i.values || i.values.length === 0) {
              await this.safeReply(i, {
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
            await this.safeReply(i, {
              content: `✅ Successfully set the support role to <@&${roleId}>`,
              components: [],
              embeds: [],
            });
            
            // After a short delay, return to the main ticket setup
            setTimeout(() => {
              this.createUI(interaction, config).catch(e => 
                logger.error('Error returning to setup UI after role selection:', e)
              );
            }, 2000);
          } catch (roleError) {
            logger.error('Error handling role selection:', roleError);
          }
        }
        
        // Handle auto-close time buttons
        else if (i.customId.startsWith('auto_close_')) {
          try {
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
            await this.safeReply(i, {
              content: `✅ Successfully set the auto-close time to ${hours} hours`,
              components: [],
              embeds: [],
            });
            
            // After a short delay, return to the main ticket setup
            setTimeout(() => {
              this.createUI(interaction, config).catch(e => 
                logger.error('Error returning to setup UI after auto-close selection:', e)
              );
            }, 2000);
          } catch (timeError) {
            logger.error('Error handling auto-close time selection:', timeError);
          }
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
      }
    });
    
    collector.on('end', collected => {
      if (collected.size === 0) {
        // Timeout - do nothing, just let the collector end
        logger.info('Ticket setup collector timed out');
      }
    });
  }
  
  /**
   * Show category selection UI
   * @param {Interaction} interaction - Interaction
   * @param {Object} config - Guild configuration
   */
  async showCategorySelection(interaction, config) {
    try {
      // Get all category channels
      const categories = interaction.guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildCategory
      );
      
      if (categories.size === 0) {
        await this.safeReply(interaction, {
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
      await this.safeReply(interaction, {
        embeds: [embed],
        components: [selectMenu],
      });
    } catch (error) {
      logger.error('Error showing category selection:', error);
      throw error;
    }
  }
  
  /**
   * Show role selection UI
   * @param {Interaction} interaction - Interaction
   * @param {Object} config - Guild configuration
   */
  async showRoleSelection(interaction, config) {
    try {
      // Get all roles except @everyone
      const roles = interaction.guild.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position); // Sort by position (highest first)
      
      if (roles.size === 0) {
        await this.safeReply(interaction, {
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
      await this.safeReply(interaction, {
        embeds: [embed],
        components: [selectMenu],
      });
    } catch (error) {
      logger.error('Error showing role selection:', error);
      throw error;
    }
  }
  
  /**
   * Show log channel selection UI
   * @param {Interaction} interaction - Interaction
   * @param {Object} config - Guild configuration
   */
  async showLogChannelSelection(interaction, config) {
    try {
      // Get all text channels
      const textChannels = interaction.guild.channels.cache.filter(
        channel => channel.type === ChannelType.GuildText
      );
      
      if (textChannels.size === 0) {
        await this.safeReply(interaction, {
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
      await this.safeReply(interaction, {
        embeds: [embed],
        components: [selectMenu],
      });
    } catch (error) {
      logger.error('Error showing log channel selection:', error);
      throw error;
    }
  }
  
  /**
   * Show auto-close options UI
   * @param {Interaction} interaction - Interaction
   * @param {Object} config - Guild configuration
   */
  async showAutoCloseOptions(interaction, config) {
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
      await this.safeReply(interaction, {
        embeds: [embed],
        components: [hoursButtons1, hoursButtons2],
      });
    } catch (error) {
      logger.error('Error showing auto-close options:', error);
      throw error;
    }
  }
  
  /**
   * Safely reply to an interaction, handling different states
   * @param {Interaction} interaction - Interaction to reply to
   * @param {Object} options - Reply options
   * @returns {Promise<Message|void>} Message or void
   */
  async safeReply(interaction, options) {
    try {
      // If the interaction has been deferred or replied to, edit the reply
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(options);
      }
      
      // If it's a new interaction, try to update it
      try {
        return await interaction.update(options);
      } catch (updateError) {
        logger.warn('Could not update interaction, trying followUp:', updateError.message);
        
        // If update fails, try followUp
        try {
          return await interaction.followUp({
            ...options,
            ephemeral: true,
          });
        } catch (followUpError) {
          logger.warn('Could not followUp, trying to send in channel:', followUpError.message);
          
          // Last resort: try to send a new message in the channel
          if (interaction.channel) {
            return await interaction.channel.send({
              content: `<@${interaction.user.id}>, ${options.content || ''}`,
              embeds: options.embeds || [],
              components: options.components || [],
            });
          }
          
          // If all else fails, log the error
          logger.error('All attempts to reply failed');
          throw new Error('Could not reply to interaction');
        }
      }
    } catch (error) {
      logger.error('Error in safeReply:', error);
      throw error;
    }
  }
}

module.exports = TicketSetup;