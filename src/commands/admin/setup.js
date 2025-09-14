const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const { db } = require('../../database/Database');
const { logger } = require('../../utils/logger');
const branding = require('../../config/branding');

// Import setup modules
const TicketSetup = require('./setup/ticketSetup');
const ShopSetup = require('./setup/ShopSetup');
const GeneralSetup = require('./setup/GeneralSetup');
const SetupUI = require('./setup/setupUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the Igloo bot for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('panel')
        .setDescription('Open the setup panel with all configuration options')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tickets')
        .setDescription('Configure the ticket system')
        .addChannelOption(option =>
          option
            .setName('category')
            .setDescription('Category to create tickets in')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('support_role')
            .setDescription('Role that can see and manage tickets')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('log_channel')
            .setDescription('Channel for ticket logs')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('shop')
        .setDescription('Configure the shop system')
        .addChannelOption(option =>
          option
            .setName('shop_channel')
            .setDescription('Channel to display shop items')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('customer_role')
            .setDescription('Role given to customers after purchase')
            .setRequired(false)
        )
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

    const subcommand = interaction.options.getSubcommand();
    
    try {
      switch (subcommand) {
        case 'panel':
          await this.handleSetupPanel(interaction, client);
          break;
        case 'tickets':
          await TicketSetup.handleDirectSetup(interaction, client);
          break;
        case 'shop':
          await ShopSetup.handleDirectSetup(interaction, client);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand. Please use `/setup panel`.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error in setup command:', error);
      await interaction.reply({
        content: '❌ An error occurred. Please try again later.',
        ephemeral: true,
      });
    }
  },

  async handleSetupPanel(interaction, client) {
    const guildId = interaction.guild.id;
    
    // Get current configuration
    const config = await this.getGuildConfig(guildId);
    
    // Create main setup embed
    const embed = SetupUI.createMainEmbed(client, interaction.guild, config);
    
    // Create menu components
    const menuRow = SetupUI.createCategoryMenu();
    const actionRow = SetupUI.createMainActionButtons();

    // Send the setup panel
    const response = await interaction.reply({
      embeds: [embed],
      components: [menuRow, actionRow],
      ephemeral: true,
    });

    // Handle interactions with a simple router
    this.handleInteractions(response, interaction, client, config);
  },

  handleInteractions(response, originalInteraction, client, config) {
    const collector = response.createMessageComponentCollector({
      time: 10 * 60 * 1000, // 10 minutes
    });

    collector.on('collect', async (componentInteraction) => {
      try {
        // Route interactions to appropriate handlers
        await this.routeInteraction(componentInteraction, client, config);
      } catch (error) {
        logger.error('Error handling setup interaction:', error);
        await componentInteraction.reply({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true,
        });
      }
    });

    collector.on('end', () => {
      // Disable components when expired
      SetupUI.disableComponents(originalInteraction);
    });
  },

  async routeInteraction(interaction, client, config) {
    const { customId } = interaction;

    // Category selection
    if (customId === 'setup_category_select') {
      const category = interaction.values[0];
      switch (category) {
        case 'tickets':
          await TicketSetup.showMenu(interaction, client, config);
          break;
        case 'shop':
          await ShopSetup.showMenu(interaction, client, config);
          break;
        case 'general':
          await GeneralSetup.showMenu(interaction, client, config);
          break;
      }
      return;
    }

    // Main panel buttons
    if (customId === 'setup_check_config') {
      const updatedConfig = await this.getGuildConfig(interaction.guild.id);
      await SetupUI.showCurrentConfig(interaction, client, updatedConfig);
      return;
    }

    if (customId === 'setup_help_button') {
      await SetupUI.showHelp(interaction, client);
      return;
    }

    if (customId === 'setup_reset') {
      await SetupUI.showResetConfirmation(interaction, client);
      return;
    }

    // Back to main
    if (customId === 'setup_back_main') {
      const updatedConfig = await this.getGuildConfig(interaction.guild.id);
      const embed = SetupUI.createMainEmbed(client, interaction.guild, updatedConfig);
      const menuRow = SetupUI.createCategoryMenu();
      const actionRow = SetupUI.createMainActionButtons();

      await interaction.update({
        embeds: [embed],
        components: [menuRow, actionRow],
      });
      return;
    }

    // Route to specific modules
    if (customId.startsWith('ticket_')) {
      await TicketSetup.handleInteraction(interaction, client);
    } else if (customId.startsWith('shop_')) {
      await ShopSetup.handleInteraction(interaction, client);
    } else if (customId.startsWith('general_')) {
      await GeneralSetup.handleInteraction(interaction, client);
    }
  },

  async getGuildConfig(guildId) {
    try {
      const result = await db.query(
        'SELECT * FROM guild_configs WHERE guild_id = $1',
        [guildId]
      );
      
      return result.rows[0] || {
        guild_id: guildId,
        ticket_category_id: null,
        support_role_id: null,
        log_channel_id: null,
        shop_channel_id: null,
        customer_role_id: null,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      logger.error('Error getting guild config:', error);
      return {
        guild_id: guildId,
        ticket_category_id: null,
        support_role_id: null,
        log_channel_id: null,
        shop_channel_id: null,
        customer_role_id: null,
        created_at: new Date(),
        updated_at: new Date()
      };
    }
  }
};