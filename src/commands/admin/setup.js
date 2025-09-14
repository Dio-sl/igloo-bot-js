// src/commands/admin/setup.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits, // Correctly import PermissionFlagsBits
} = require('discord.js');

const { db } = require('../../database/Database');
const { logger } = require('../../utils/logger');
const ConfigService = require('../../services/ConfigService');

// Import setup modules
const TicketSetup = require('./setup/TicketSetup');
const ShopSetup = require('./setup/ShopSetup');
const GeneralSetup = require('./setup/GeneralSetup');
const SetupWizard = require('./setup/SetupWizard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the Igloo bot for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('wizard')
        .setDescription('Start the interactive setup wizard')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tickets')
        .setDescription('Configure the ticket system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shop')
        .setDescription('Configure the shop system')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('general')
        .setDescription('Configure general bot settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('export')
        .setDescription('Export your current configuration')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('import')
        .setDescription('Import a configuration')
        .addAttachmentOption(option =>
          option
            .setName('config_file')
            .setDescription('JSON configuration file')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current configuration')
    ),

  category: 'admin',
  cooldown: 5,

  async execute(interaction, client) {
    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    const configService = new ConfigService(db);
    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'wizard':
          const wizard = new SetupWizard(client, configService);
          await wizard.start(interaction);
          break;
        case 'tickets':
          const ticketSetup = new TicketSetup(client, configService);
          await ticketSetup.createUI(interaction, await configService.getGuildConfig(interaction.guild.id));
          break;
        case 'shop':
          const shopSetup = new ShopSetup(client, configService);
          await shopSetup.createUI(interaction, await configService.getGuildConfig(interaction.guild.id));
          break;
        case 'general':
          const generalSetup = new GeneralSetup(client, configService);
          await generalSetup.createUI(interaction, await configService.getGuildConfig(interaction.guild.id));
          break;
        case 'export':
          await this.handleExport(interaction, configService);
          break;
        case 'import':
          await this.handleImport(interaction, configService);
          break;
        case 'view':
          await this.handleView(interaction, client, configService);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error in setup command:', error);
      const errorMessage = { 
        content: '❌ An error occurred. Please try again later.',
        ephemeral: true
      };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },

  async handleExport(interaction, configService) {
    await interaction.deferReply({ ephemeral: true });
    const config = await configService.exportConfig(interaction.guild.id);
    
    // Create a temporary file with the configuration
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(__dirname, '../../temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `${interaction.guild.id}_config.json`);
    
    fs.writeFileSync(tempFile, JSON.stringify(config, null, 2));
    
    await interaction.editReply({
      content: '✅ Here is your configuration export:',
      files: [tempFile],
      ephemeral: true,
    });
    
    // Clean up
    setTimeout(() => {
      try {
        fs.unlinkSync(tempFile);
      } catch (error) {
        logger.error('Error deleting temp file:', error);
      }
    }, 10000);
  },

  async handleImport(interaction, configService) {
    await interaction.deferReply({ ephemeral: true });
    
    const attachment = interaction.options.getAttachment('config_file');
    if (!attachment.name.endsWith('.json')) {
      return await interaction.editReply({
        content: '❌ Please upload a valid JSON configuration file.',
        ephemeral: true,
      });
    }
    
    try {
      const response = await fetch(attachment.url);
      const config = await response.json();
      
      await configService.importConfig(interaction.guild.id, config);
      
      await interaction.editReply({
        content: '✅ Configuration imported successfully!',
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error importing configuration:', error);
      await interaction.editReply({
        content: '❌ Invalid configuration file. Please ensure it is a valid JSON export.',
        ephemeral: true,
      });
    }
  },

  async handleView(interaction, client, configService) {
    const config = await configService.getGuildConfig(interaction.guild.id);
    
    // Create the view embed
    const embed = new EmbedBuilder()
      .setColor(0x0CAFFF)
      .setTitle('🧊 Igloo Configuration')
      .setDescription('Here is your current Igloo configuration:')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🎫 Ticket System',
          value: this.formatTicketConfig(config, interaction.guild),
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: this.formatShopConfig(config, interaction.guild),
          inline: false,
        },
        {
          name: '⚙️ General Settings',
          value: this.formatGeneralConfig(config),
          inline: false,
        }
      )
      .setFooter({
        text: `Igloo Bot • Server: ${interaction.guild.name}`,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();
    
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
  
  formatTicketConfig(config, guild) {
    const ticketConfig = config.tickets || {};
    const parts = [];
    
    // Format category
    if (ticketConfig.category) {
      const category = guild.channels.cache.get(ticketConfig.category);
      parts.push(`📁 **Category**: ${category ? `<#${category.id}>` : 'Unknown category'}`);
    } else {
      parts.push('📁 **Category**: Not configured');
    }
    
    // Format support role
    if (ticketConfig.support_role) {
      const role = guild.roles.cache.get(ticketConfig.support_role);
      parts.push(`👮 **Support Role**: ${role ? `<@&${role.id}>` : 'Unknown role'}`);
    } else {
      parts.push('👮 **Support Role**: Not configured');
    }
    
    // Format log channel
    if (ticketConfig.log_channel) {
      const channel = guild.channels.cache.get(ticketConfig.log_channel);
      parts.push(`📋 **Log Channel**: ${channel ? `<#${channel.id}>` : 'Unknown channel'}`);
    } else {
      parts.push('📋 **Log Channel**: Not configured');
    }
    
    // Format auto-close hours
    if (ticketConfig.auto_close_hours) {
      parts.push(`⏱️ **Auto-Close**: ${ticketConfig.auto_close_hours} hours`);
    } else {
      parts.push('⏱️ **Auto-Close**: 72 hours (default)');
    }
    
    return parts.join('\n');
  },
  
  formatShopConfig(config, guild) {
    const shopConfig = config.shop || {};
    const parts = [];
    
    // Format shop channel
    if (shopConfig.channel) {
      const channel = guild.channels.cache.get(shopConfig.channel);
      parts.push(`🛍️ **Shop Channel**: ${channel ? `<#${channel.id}>` : 'Unknown channel'}`);
    } else {
      parts.push('🛍️ **Shop Channel**: Not configured');
    }
    
    // Format customer role
    if (shopConfig.customer_role) {
      const role = guild.roles.cache.get(shopConfig.customer_role);
      parts.push(`🏷️ **Customer Role**: ${role ? `<@&${role.id}>` : 'Unknown role'}`);
    } else {
      parts.push('🏷️ **Customer Role**: Not configured');
    }
    
    parts.push('⏳ **Status**: Coming in Phase 2 (Q2 2025)');
    
    return parts.join('\n');
  },
  
  formatGeneralConfig(config) {
    const generalConfig = config.general || {};
    const parts = [];
    
    parts.push('✅ **Bot Status**: Online and ready');
    
    // Format admin roles
    if (generalConfig.admin_roles && generalConfig.admin_roles.length > 0) {
      const roleList = generalConfig.admin_roles
        .map(roleId => `<@&${roleId}>`)
        .join(', ');
      parts.push(`👑 **Admin Roles**: ${roleList}`);
    } else {
      parts.push('👑 **Admin Roles**: Not configured');
    }
    
    return parts.join('\n');
  }
};