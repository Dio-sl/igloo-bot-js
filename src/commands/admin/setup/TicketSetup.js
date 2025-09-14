// src/commands/admin/setup/TicketSetup.js
const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const BaseSetupModule = require('./BaseSetupModule');
const { logger } = require('../../../utils/logger');

/**
 * TicketSetup - Handles ticket system configuration
 * @extends BaseSetupModule
 */
class TicketSetup extends BaseSetupModule {
  /**
   * Get the configuration section name for this module
   * @returns {string} Configuration section name
   */
  getConfigSection() {
    return 'tickets';
  }

  /**
   * Get settings definitions for this module
   * @returns {Array<Object>} Settings definitions
   */
  getSettingsDefinitions() {
    return [
      {
        key: 'category',
        label: 'Ticket Category',
        emoji: '📁',
        type: 'channel',
        channelTypes: [ChannelType.GuildCategory],
        required: true,
        description: 'Category where ticket channels will be created'
      },
      {
        key: 'support_role',
        label: 'Support Role',
        emoji: '👮',
        type: 'role',
        required: true,
        description: 'Role that can access and manage tickets'
      },
      {
        key: 'log_channel',
        label: 'Log Channel',
        emoji: '📋',
        type: 'channel',
        channelTypes: [ChannelType.GuildText],
        required: false,
        description: 'Channel for ticket logs and transcripts'
      },
      {
        key: 'auto_close_hours',
        label: 'Auto-Close Time',
        emoji: '⏱️',
        type: 'number',
        required: false,
        default: 72,
        min: 1,
        max: 720,
        description: 'Hours of inactivity before auto-closing tickets',
        presets: [
          { label: '24 Hours', value: 24 },
          { label: '48 Hours', value: 48 },
          { label: '72 Hours', value: 72 },
          { label: '7 Days', value: 168 }
        ]
      },
      {
        key: 'max_open_tickets',
        label: 'Max Tickets Per User',
        emoji: '🔢',
        type: 'number',
        required: false,
        default: 5,
        min: 1,
        max: 50,
        description: 'Maximum number of open tickets per user'
      },
      {
        key: 'welcome_message',
        label: 'Welcome Message',
        emoji: '📝',
        type: 'text',
        multiline: true,
        required: false,
        maxLength: 2000,
        description: 'Message sent when a ticket is created',
        placeholder: 'Thanks for opening a ticket! Our support team will assist you shortly.'
      }
    ];
  }

  /**
   * Prompt for setting value with customized UI
   * @param {Interaction} interaction - Discord interaction
   * @param {string} settingKey - Setting key
   */
  async promptSetting(interaction, settingKey) {
    // Get setting definition
    const setting = this.getSettingsDefinitions().find(s => s.key === settingKey);
    
    if (!setting) {
      return await interaction.update({
        content: `❌ Unknown setting: ${settingKey}`,
        components: []
      });
    }
    
    // Dispatch to appropriate prompt method based on setting type
    switch (setting.type) {
      case 'channel':
        await this.promptChannelSelection(interaction, setting);
        break;
        
      case 'role':
        await this.promptRoleSelection(interaction, setting);
        break;
        
      case 'text':
        await this.promptTextInput(interaction, setting);
        break;
        
      case 'number':
        await this.promptNumberInput(interaction, setting);
        break;
        
      default:
        await interaction.update({
          content: `❌ Unsupported setting type: ${setting.type}`,
          components: []
        });
    }
  }

  /**
   * Prompt for channel selection
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} setting - Setting definition
   */
  async promptChannelSelection(interaction, setting) {
    // Get available channels
    const channels = interaction.guild.channels.cache
      .filter(channel => {
        if (setting.channelTypes) {
          return setting.channelTypes.includes(channel.type);
        }
        return true;
      })
      .first(25); // Discord limit
    
    if (channels.length === 0) {
      return await interaction.update({
        content: `❌ No suitable channels found. Please create a ${
          setting.key === 'category' ? 'category' : 'channel'
        } first.`,
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`tickets_back`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
            )
        ]
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.PRIMARY)
      .setTitle(`${setting.emoji} ${setting.label}`)
      .setDescription(setting.description);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`tickets_select_${setting.key}`)
      .setPlaceholder(`Select a ${setting.key === 'category' ? 'category' : 'channel'}...`)
      .addOptions(
        channels.map(channel => ({
          label: channel.name,
          description: `ID: ${channel.id}`,
          value: channel.id
        }))
      );
    
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`tickets_back`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );
    
    await interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        buttonRow
      ],
      content: null
    });
  }

  /**
   * Prompt for role selection
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} setting - Setting definition
   */
  async promptRoleSelection(interaction, setting) {
    // Get available roles
    const roles = interaction.guild.roles.cache
      .filter(role => !role.managed && role.id !== interaction.guild.id) // Skip managed roles and @everyone
      .sort((a, b) => b.position - a.position) // Sort by position
      .first(25); // Discord limit
    
    if (roles.length === 0) {
      return await interaction.update({
        content: `❌ No suitable roles found. Please create a role first.`,
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`tickets_back`)
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
            )
        ]
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.PRIMARY)
      .setTitle(`${setting.emoji} ${setting.label}`)
      .setDescription(setting.description);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`tickets_select_${setting.key}`)
      .setPlaceholder('Select a role...')
      .addOptions(
        roles.map(role => ({
          label: role.name,
          description: `ID: ${role.id}`,
          value: role.id
        }))
      );
    
    const buttonRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`tickets_back`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );
    
    await interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        buttonRow
      ],
      content: null
    });
  }

  /**
   * Prompt for number input
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} setting - Setting definition
   */
  async promptNumberInput(interaction, setting) {
    // Get current configuration
    const config = await this.configService.getGuildConfig(interaction.guild.id);
    const currentValue = config.tickets?.[setting.key] || setting.default;
    
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.PRIMARY)
      .setTitle(`${setting.emoji} ${setting.label}`)
      .setDescription(setting.description);
    
    if (setting.min !== undefined || setting.max !== undefined) {
      let rangeText = 'Valid range: ';
      if (setting.min !== undefined) rangeText += `${setting.min} to `;
      if (setting.max !== undefined) rangeText += setting.max;
      else rangeText += 'unlimited';
      
      embed.addFields({ name: 'Range', value: rangeText, inline: true });
    }
    
    if (currentValue !== undefined) {
      embed.addFields({ name: 'Current Value', value: `${currentValue}`, inline: true });
    }
    
    // Create preset buttons for quick selection
    const presets = setting.presets || [
      { label: '1', value: 1 },
      { label: '5', value: 5 },
      { label: '10', value: 10 },
      { label: '25', value: 25 },
      { label: '50', value: 50 }
    ];
    
    const presetButtons = presets.map(preset => {
      return new ButtonBuilder()
        .setCustomId(`tickets_number_${setting.key}_${preset.value}`)
        .setLabel(preset.label)
        .setStyle(currentValue === preset.value ? ButtonStyle.Success : ButtonStyle.Secondary);
    });
    
    const navRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`tickets_back`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );
    
    // Create rows for buttons
    const components = [];
    
    if (presetButtons.length <= 5) {
      components.push(new ActionRowBuilder().addComponents(presetButtons));
    } else {
      const firstRow = presetButtons.slice(0, 5);
      const secondRow = presetButtons.slice(5);
      
      components.push(new ActionRowBuilder().addComponents(firstRow));
      if (secondRow.length > 0) {
        components.push(new ActionRowBuilder().addComponents(secondRow));
      }
    }
    
    components.push(navRow);
    
    await interaction.update({
      embeds: [embed],
      components: components,
      content: null
    });
  }

  /**
   * Handle number selection
   * @param {Interaction} interaction - Discord interaction
   * @param {string} customId - Custom ID of the interaction
   */
  async handleInteraction(interaction, customId) {
    // Handle number selection buttons
    if (customId.startsWith('tickets_number_')) {
      const parts = customId.replace('tickets_number_', '').split('_');
      const settingKey = parts[0];
      const value = parseInt(parts[1], 10);
      
      await this.updateSetting(interaction, settingKey, value);
      return;
    }
    
    // Call parent method for other interactions
    await super.handleInteraction(interaction, customId);
  }

  /**
   * Create a ticket panel
   * @param {Interaction} interaction - Discord interaction
   */
  async createPanel(interaction) {
    try {
      // Get configuration
      const config = await this.configService.getGuildConfig(interaction.guild.id);
      const ticketConfig = config.tickets || {};
      
      // Validate required settings
      if (!ticketConfig.category || !ticketConfig.support_role) {
        return await interaction.update({
          content: '❌ Ticket category and support role must be configured before creating a panel.',
          components: [
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('tickets_back')
                  .setLabel('Back to Settings')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('↩️')
              )
          ],
          embeds: []
        });
      }
      
      // Create ticket panel embed
      const panelEmbed = new EmbedBuilder()
        .setColor(this.COLORS.PRIMARY)
        .setTitle('🎫 Support Tickets')
        .setDescription('Need help? Click the button below to open a support ticket.')
        .addFields({
          name: 'How it works',
          value: [
            '1. Click the button to create a ticket',
            '2. Describe your issue in detail',
            '3. Our support team will assist you as soon as possible',
            '4. When your issue is resolved, the ticket will be closed'
          ].join('\n'),
          inline: false
        })
        .setFooter({
          text: 'Powered by Igloo Bot',
          iconURL: this.client.user.displayAvatarURL()
        })
        .setTimestamp();
      
      // Create ticket button
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create')
            .setLabel('Open a Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );
      
      // Ask where to send the panel
      const promptEmbed = new EmbedBuilder()
        .setColor(this.COLORS.PRIMARY)
        .setTitle('🎫 Create Ticket Panel')
        .setDescription('Select a channel to send the ticket panel to:')
        .setFooter({
          text: 'The panel will be posted in the selected channel',
          iconURL: this.client.user.displayAvatarURL()
        });
      
      // Get text channels
      const channels = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText)
        .first(25);
      
      if (channels.length === 0) {
        return await interaction.update({
          content: '❌ No text channels found. Please create a channel first.',
          components: [
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('tickets_back')
                  .setLabel('Back to Settings')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('↩️')
              )
          ],
          embeds: []
        });
      }
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('tickets_panel_channel')
        .setPlaceholder('Select a channel...')
        .addOptions(
          channels.map(channel => ({
            label: channel.name,
            description: `ID: ${channel.id}`,
            value: channel.id
          }))
        );
      
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('tickets_back')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );
      
      await interaction.update({
        embeds: [promptEmbed],
        components: [
          new ActionRowBuilder().addComponents(selectMenu),
          actionRow
        ],
        content: null
      });
      
      // Set up collector for channel selection
      const message = await interaction.fetchReply();
      const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'tickets_panel_channel',
        time: 60000,
        max: 1
      });
      
      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          
          const channelId = i.values[0];
          const channel = interaction.guild.channels.cache.get(channelId);
          
          if (!channel) {
            return await i.editReply({
              content: '❌ Channel not found. Please try again.',
              components: [
                new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setCustomId('tickets_back')
                      .setLabel('Back to Settings')
                      .setStyle(ButtonStyle.Secondary)
                      .setEmoji('↩️')
                  )
              ],
              embeds: []
            });
          }
          
          // Send ticket panel to the selected channel
          await channel.send({
            embeds: [panelEmbed],
            components: [buttonRow]
          });
          
          // Show success message
          await i.editReply({
            content: `✅ Ticket panel created successfully in ${channel}!`,
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('tickets_back')
                    .setLabel('Back to Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
                )
            ],
            embeds: []
          });
          
          // Log panel creation
          logger.info(`Ticket panel created in #${channel.name} (${channel.id}) by ${interaction.user.tag}`);
        } catch (error) {
          logger.error('Error creating ticket panel:', error);
          
          await i.editReply({
            content: `❌ Error creating ticket panel: ${error.message}`,
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('tickets_back')
                    .setLabel('Back to Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
                )
            ],
            embeds: []
          });
        }
      });
      
      collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          interaction.editReply({
            content: '❌ Channel selection timed out. Please try again.',
            components: [
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId('tickets_back')
                    .setLabel('Back to Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
                )
            ],
            embeds: []
          }).catch(error => {
            logger.error('Error updating timed out message:', error);
          });
        }
      });
    } catch (error) {
      logger.error('Error in createPanel:', error);
      
      await interaction.update({
        content: `❌ An error occurred: ${error.message}`,
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('tickets_back')
                .setLabel('Back to Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('↩️')
            )
        ],
        embeds: []
      });
    }
  }
}

module.exports = TicketSetup;