// src/commands/admin/setup.js
const { SlashCommandBuilder } = require('discord.js');
const SetupWizard = require('./wizard');
const TicketSetup = require('./setup/ticketSetup');
const ShopSetup = require('./setup/ShopSetup');
const GeneralSetup = require('./setup/GeneralSetup');
const ConfigService = require('../../services/ConfigService');

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
          await ticketSetup.show(interaction);
          break;
        case 'shop':
          const shopSetup = new ShopSetup(client, configService);
          await shopSetup.show(interaction);
          break;
        case 'general':
          const generalSetup = new GeneralSetup(client, configService);
          await generalSetup.show(interaction);
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
    const tempFile = path.join(__dirname, `../../temp/${interaction.guild.id}_config.json`);
    
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
    const embed = createConfigViewEmbed(client, interaction.guild, config);
    
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }
};