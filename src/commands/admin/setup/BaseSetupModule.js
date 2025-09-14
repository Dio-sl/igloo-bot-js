// src/commands/admin/setup/BaseSetupModule.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits, // Add the missing import
} = require('discord.js');

const { logger } = require('../../../utils/logger');

/**
 * BaseSetupModule - Base class for all setup modules
 * Provides common functionality for setup UI and interactions
 */
class BaseSetupModule {
  /**
   * Create a new BaseSetupModule
   * @param {Client} client - Discord.js client
   * @param {ConfigService} configService - Configuration service
   */
  constructor(client, configService) {
    this.client = client;
    this.configService = configService;
    
    // Theme colors
    this.COLORS = {
      PRIMARY: 0x0CAFFF,
      SECONDARY: 0x87CEEB,
      SUCCESS: 0x7FFFD4,
      DANGER: 0xE91E63,
      DARK: 0x0A5C7A,
    };
  }

  /**
   * Generate UI for this module
   * @param {Interaction} interaction - Discord interaction
   * @param {Object} config - Guild configuration
   * @returns {Promise<void>}
   */
  async createUI(interaction, config) {
    // Get module-specific settings
    const section = this.getConfigSection();
    const sectionConfig = config[section] || {};
    
    // Create embed
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.PRIMARY)
      .setTitle(`${this.getIcon()} ${this.getDisplayName()} Setup`)
      .setDescription(`Configure your server's ${this.getDisplayName().toLowerCase()} settings`)
      .setThumbnail(this.client.user.displayAvatarURL())
      .addFields(
        {
          name: 'Current Configuration',
          value: this.getStatusText(config, interaction.guild) || 'No configuration set.',
          inline: false,
        },
        {
          name: 'Available Settings',
          value: this.getSettingsText() || 'No settings available.',
          inline: false,
        }
      )
      .setFooter({
        text: `Igloo Bot • Server: ${interaction.guild.name}`,
        iconURL: this.client.user.displayAvatarURL(),
      });
    
    // Create settings buttons
    const settingsButtons = this.getSettingsButtons(config);
    
    // Create component rows
    const components = [];
    
    // Split buttons into rows if needed (max 5 per row)
    if (settingsButtons.length <= 5) {
      components.push(new ActionRowBuilder().addComponents(settingsButtons));
    } else {
      const firstRow = settingsButtons.slice(0, 5);
      const secondRow = settingsButtons.slice(5);
      
      components.push(new ActionRowBuilder().addComponents(firstRow));
      components.push(new ActionRowBuilder().addComponents(secondRow));
    }
    
    // Add navigation buttons
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Back to Main Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️'),
      new ButtonBuilder()
        .setCustomId(`${section}_create_panel`)
        .setLabel('Create Panel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
        .setDisabled(!this.isConfigured(config))
    ));
    
    // Send or update message
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        embeds: [embed],
        components: components,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        components: components,
        ephemeral: true,
      });
    }
    
    // Set up collector for interactions
    const message = await interaction.fetchReply();
    this.setupCollector(message, interaction);
  }

  /**
   * Handle interactions for this module
   * @param {Interaction} interaction - Discord interaction
   * @param {string} customId - Custom ID of the interaction
   * @returns {Promise<void>}
   */
  async handleInteraction(interaction, customId) {
    const section = this.getConfigSection();
    
    // Handle setting interactions
    if (customId.startsWith(`${section}_set_`)) {
      const settingKey = customId.replace(`${section}_set_`, '');
      await this.promptSetting(interaction, settingKey);
      return;
    }
    
    // Handle selection confirmations
    if (customId.startsWith(`${section}_select_`)) {
      const settingKey = customId.replace(`${section}_select_`, '');
      const value = interaction.values[0];
      await this.updateSetting(interaction, settingKey, value);
      return;
    }
    
    // Handle other actions
    switch (customId) {
      case `${section}_create_panel`:
        await this.createPanel(interaction);
        break;
        
      case `${section}_reset`:
        await this.confirmReset(interaction);
        break;
        
      case `${section}_reset_confirm`:
        await this.resetSettings(interaction);
        break;
        
      case `${section}_back`:
      case 'setup_back_main':
        // Get updated config
        const config = await this.configService.getGuildConfig(interaction.guild.id);
        await this.createUI(interaction, config);
        break;
        
      default:
        logger.warn(`Unknown interaction: ${customId}`);
        await interaction.reply({
          content: '❌ Unknown interaction. Please try again.',
          ephemeral: true,
        });
    }
  }

  /**
   * Get the configuration section name for this module
   * @returns {string} Configuration section name
   */
  getConfigSection() {
    // Must be implemented by subclass
    throw new Error('BaseSetupModule.getConfigSection() must be implemented by subclass');
  }

  /**
   * Validate settings for this module
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result with status and errors
   */
  validateSettings(settings) {
    // Get settings definitions
    const definitions = this.getSettingsDefinitions();
    
    // Track validation errors
    const errors = [];
    
    // Check each setting
    for (const [key, value] of Object.entries(settings)) {
      // Find definition for this setting
      const definition = definitions.find(d => d.key === key);
      
      // Skip if no definition found
      if (!definition) continue;
      
      // Check required settings
      if (definition.required && (value === null || value === undefined || value === '')) {
        errors.push({
          key,
          message: `${definition.label} is required`
        });
        continue;
      }
      
      // Skip validation for null values in non-required fields
      if (!definition.required && (value === null || value === undefined)) {
        continue;
      }
      
      // Validate based on type
      switch (definition.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push({
              key,
              message: `${definition.label} must be a string`
            });
          } else if (definition.maxLength && value.length > definition.maxLength) {
            errors.push({
              key,
              message: `${definition.label} must be at most ${definition.maxLength} characters`
            });
          }
          break;
          
        case 'number':
          if (typeof value !== 'number') {
            errors.push({
              key,
              message: `${definition.label} must be a number`
            });
          } else {
            if (definition.min !== undefined && value < definition.min) {
              errors.push({
                key,
                message: `${definition.label} must be at least ${definition.min}`
              });
            }
            
            if (definition.max !== undefined && value > definition.max) {
              errors.push({
                key,
                message: `${definition.label} must be at most ${definition.max}`
              });
            }
          }
          break;
          
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({
              key,
              message: `${definition.label} must be a boolean`
            });
          }
          break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper methods (these would typically be implemented by subclasses or used internally)

  /**
   * Get the display name for this module
   * @returns {string} Display name
   */
  getDisplayName() {
    const section = this.getConfigSection();
    return section.charAt(0).toUpperCase() + section.slice(1);
  }

  /**
   * Get the icon emoji for this module
   * @returns {string} Icon emoji
   */
  getIcon() {
    const icons = {
      tickets: '🎫',
      shop: '🛒',
      general: '⚙️',
    };
    
    return icons[this.getConfigSection()] || '📝';
  }

  /**
   * Get settings definitions for this module
   * @returns {Array<Object>} Settings definitions
   */
  getSettingsDefinitions() {
    // Should be implemented by subclass
    return [];
  }

  /**
   * Get status text showing current configuration
   * @param {Object} config - Guild configuration
   * @param {Guild} guild - Discord guild
   * @returns {string} Status text
   */
  getStatusText(config, guild) {
    const section = this.getConfigSection();
    const sectionConfig = config[section] || {};
    const settings = this.getSettingsDefinitions();
    
    const parts = settings.map(setting => {
      const value = sectionConfig[setting.key];
      
      if (value === null || value === undefined) {
        return `❌ **${setting.label}**: Not configured`;
      }
      
      // Format value based on type
      let displayValue = String(value);
      
      if (setting.type === 'channel' && guild) {
        const channel = guild.channels.cache.get(value);
        displayValue = channel ? `<#${channel.id}>` : 'Unknown channel';
      } else if (setting.type === 'role' && guild) {
        const role = guild.roles.cache.get(value);
        displayValue = role ? `<@&${role.id}>` : 'Unknown role';
      } else if (setting.type === 'boolean') {
        displayValue = value ? '✅ Enabled' : '❌ Disabled';
      }
      
      return `✅ **${setting.label}**: ${displayValue}`;
    });
    
    return parts.join('\n');
  }

  /**
   * Get text describing available settings
   * @returns {string} Settings text
   */
  getSettingsText() {
    const settings = this.getSettingsDefinitions();
    
    const parts = settings.map(setting => {
      return `**${setting.emoji} ${setting.label}** - ${setting.description || ''}`;
    });
    
    return parts.join('\n');
  }

  /**
   * Get buttons for settings
   * @param {Object} config - Guild configuration
   * @returns {Array<ButtonBuilder>} Settings buttons
   */
  getSettingsButtons(config) {
    const section = this.getConfigSection();
    const sectionConfig = config[section] || {};
    
    return this.getSettingsDefinitions().map(setting => {
      const isConfigured = sectionConfig[setting.key] !== null && 
                          sectionConfig[setting.key] !== undefined;
      
      return new ButtonBuilder()
        .setCustomId(`${section}_set_${setting.key}`)
        .setLabel(setting.label)
        .setStyle(isConfigured ? ButtonStyle.Success : ButtonStyle.Primary)
        .setEmoji(setting.emoji);
    });
  }

  /**
   * Check if all required settings are configured
   * @param {Object} config - Guild configuration
   * @returns {boolean} True if configured
   */
  isConfigured(config) {
    const section = this.getConfigSection();
    const sectionConfig = config[section] || {};
    
    // Check if all required settings are configured
    return this.getSettingsDefinitions()
      .filter(setting => setting.required)
      .every(setting => {
        const value = sectionConfig[setting.key];
        return value !== null && value !== undefined && value !== '';
      });
  }

  /**
   * Set up collector for interactions
   * @param {Message} message - Message to collect interactions from
   * @param {Interaction} interaction - Original interaction
   */
  setupCollector(message, interaction) {
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 10 * 60 * 1000 // 10 minutes timeout
    });
    
    collector.on('collect', async i => {
      try {
        await i.deferUpdate();
        await this.handleInteraction(i, i.customId);
      } catch (error) {
        logger.error('Error handling interaction:', error);
        
        try {
          await i.editReply({
            content: '❌ An error occurred. Please try again.',
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('setup_back_main')
                  .setLabel('Back to Main Menu')
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji('↩️')
              )
            ]
          });
        } catch (e) {
          logger.error('Error sending error message:', e);
        }
      }
    });
  }

  /**
   * Prompt for setting value
   * @param {Interaction} interaction - Discord interaction
   * @param {string} settingKey - Setting key
   */
  async promptSetting(interaction, settingKey) {
    // To be implemented based on setting type
    // This would typically show a selection menu, prompt, or modal
    await interaction.update({
      content: `Setting up ${settingKey}...`,
      components: [],
      embeds: []
    });
  }

  /**
   * Update a setting
   * @param {Interaction} interaction - Discord interaction
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  async updateSetting(interaction, key, value) {
    try {
      const section = this.getConfigSection();
      
      await this.configService.updateGuildConfig(
        interaction.guild.id,
        section,
        key,
        value
      );
      
      // Get updated config
      const config = await this.configService.getGuildConfig(interaction.guild.id);
      
      // Show success message
      await interaction.update({
        content: `✅ Setting updated successfully!`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${section}_back`)
              .setLabel('Back to Settings')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️')
          )
        ],
        embeds: []
      });
    } catch (error) {
      logger.error('Error updating setting:', error);
      
      await interaction.update({
        content: `❌ Error updating setting: ${error.message}`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${section}_back`)
              .setLabel('Back to Settings')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️')
          )
        ],
        embeds: []
      });
    }
  }

  /**
   * Show reset confirmation
   * @param {Interaction} interaction - Discord interaction
   */
  async confirmReset(interaction) {
    const section = this.getConfigSection();
    
    const embed = new EmbedBuilder()
      .setColor(this.COLORS.DANGER)
      .setTitle(`🗑️ Reset ${this.getDisplayName()} Settings`)
      .setDescription(`⚠️ **WARNING**: This will reset ALL ${this.getDisplayName()} settings for this server!`)
      .addFields({
        name: 'This action cannot be undone!',
        value: 'Are you sure you want to continue?'
      });
    
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${section}_reset_confirm`)
          .setLabel('Yes, Reset Everything')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId(`${section}_back`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      )
    ];
    
    await interaction.update({
      embeds: [embed],
      components: components,
      content: null
    });
  }

  /**
   * Reset settings for this module
   * @param {Interaction} interaction - Discord interaction
   */
  async resetSettings(interaction) {
    try {
      const section = this.getConfigSection();
      
      // Create empty reset data
      const resetData = {};
      
      // Set all settings to null
      this.getSettingsDefinitions().forEach(setting => {
        resetData[setting.key] = null;
      });
      
      // Update config
      await this.configService.bulkUpdateConfig(
        interaction.guild.id,
        { [section]: resetData }
      );
      
      // Show success message
      await interaction.update({
        content: `✅ All ${this.getDisplayName()} settings have been reset.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${section}_back`)
              .setLabel('Back to Settings')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️')
          )
        ],
        embeds: []
      });
    } catch (error) {
      logger.error('Error resetting settings:', error);
      
      await interaction.update({
        content: `❌ Error resetting settings: ${error.message}`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${section}_back`)
              .setLabel('Back to Settings')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️')
          )
        ],
        embeds: []
      });
    }
  }

  /**
   * Create a panel for this module
   * @param {Interaction} interaction - Discord interaction
   */
  async createPanel(interaction) {
    // To be implemented by subclasses
    await interaction.update({
      content: `This feature is not yet implemented.`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${this.getConfigSection()}_back`)
            .setLabel('Back to Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        )
      ],
      embeds: []
    });
  }
}

module.exports = BaseSetupModule;