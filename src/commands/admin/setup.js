const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
  ComponentType,
} = require('discord.js');
const { db } = require('../../database/Database');
const { logger } = require('../../utils/logger');
const branding = require('../../config/branding');

// IGLOO Theme Colors
const COLORS = {
  PRIMARY: 0x0CAFFF,    // Bright cyan blue - primary brand color
  SECONDARY: 0x87CEEB,  // Sky blue - secondary accents
  SUCCESS: 0x7FFFD4,    // Aquamarine - success indicators
  DANGER: 0xE91E63,     // Pink-ish - danger/warning color
  DARK: 0x0A5C7A,       // Dark blue - background color
};

// IGLOO Branding Assets
const ASSETS = {
  BANNER: 'https://cdn.discordapp.com/attachments/1409836469530660986/1416393618838786058/Branding_-_Imgur.png?ex=68c6aeda&is=68c55d5a&hm=0b4d6a43db275ca5cdebf44041f287d1123962269ddad361d684e6b54e5fbe2f&',
  LOGO: 'https://cdn.discordapp.com/attachments/1409836469530660986/1409836530369990676/bot_avatar.png?ex=660c0773&is=65f99273&hm=02dc4c6a7c3c0fb89cc75faf0edeecd0c9a0bf9a8ab4da48a22a83df8d2fb72c&',
};

// Command documentation
const SETUP_DOCS = {
  command: {
    name: 'setup',
    description: 'Configure the Igloo bot for your server',
    examples: [
      '`/setup panel` - Open the main setup panel with all configuration options',
      '`/setup tickets category:#support-tickets support_role:@Support log_channel:#ticket-logs` - Configure ticket system',
      '`/setup shop shop_channel:#shop customer_role:@Customer` - Configure shop system'
    ],
    subcommands: [
      {
        name: 'panel',
        description: 'Open the interactive setup panel with all configuration options',
        usage: '`/setup panel`',
        notes: 'The most user-friendly way to configure Igloo'
      },
      {
        name: 'tickets',
        description: 'Configure the ticket support system',
        options: [
          { name: 'category', description: 'Category to create tickets in' },
          { name: 'support_role', description: 'Role that can see and manage tickets' },
          { name: 'log_channel', description: 'Channel for ticket logs' }
        ],
        usage: '`/setup tickets category:#support support_role:@Support log_channel:#logs`',
        notes: 'All options are optional - you can set only what you need'
      },
      {
        name: 'shop',
        description: 'Configure the e-commerce shop system',
        options: [
          { name: 'shop_channel', description: 'Channel to display shop items' },
          { name: 'customer_role', description: 'Role given to customers after purchase' }
        ],
        usage: '`/setup shop shop_channel:#shop customer_role:@Customer`',
        notes: 'Coming in Phase 2 (Q2 2025) - Basic setup available now'
      }
    ]
  },
  roadmap: {
    phase1: {
      title: 'Phase 1 (Q1 2025)',
      features: [
        'Basic Ticket System',
        'Ticket Categories',
        'Staff Assignment',
        'Simple Configuration'
      ]
    },
    phase2: {
      title: 'Phase 2 (Q2 2025)',
      features: [
        'Admin Shop Panel',
        'Product Management',
        'Advanced Ticket Features',
        'Ticket Transcripts'
      ]
    },
    phase3: {
      title: 'Phase 3 (Q3 2025)',
      features: [
        'Payment System Integration',
        'Stripe API Integration',
        'In-ticket Product Selection',
        'Basic Automation'
      ]
    }
  }
};

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
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('help')
        .setDescription('Get detailed help for the setup command')
    ),
  
  category: 'admin',
  cooldown: 5,
  
  // Added examples and extra info for help command integration
  examples: [
    '/setup panel',
    '/setup tickets category:#support-tickets support_role:@Support',
    '/setup shop shop_channel:#shop customer_role:@Customer',
    '/setup help'
  ],
  
  extraInfo: 'The setup command allows you to configure Igloo for your server. Using `/setup panel` is recommended for most users as it provides an interactive configuration experience.',
  
  async execute(interaction, client) {
    // Check if user has administrator permission
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
          await handleSetupPanel(interaction, client);
          break;
        case 'tickets':
          await handleTicketSetup(interaction, client);
          break;
        case 'shop':
          await handleShopSetup(interaction, client);
          break;
        case 'help':
          await handleSetupHelp(interaction, client);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown subcommand. Please use `/setup panel` to access all settings or `/setup help` for guidance.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error in setup command:', error);
      await interaction.reply({
        content: '❌ An error occurred while executing the setup command. Please try again later.',
        ephemeral: true,
      });
    }
  }
};

/**
 * Handles the setup help documentation
 */
async function handleSetupHelp(interaction, client) {
  // Main help embed
  const helpEmbed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🧊 Igloo Setup Guide')
    .setDescription('Welcome to the Igloo Setup Guide! This documentation will help you configure Igloo for your server.')
    .setImage(ASSETS.BANNER)
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '📋 Overview',
        value: 'The `/setup` command allows you to configure Igloo\'s e-commerce and ticket systems. You can use the interactive panel or configure specific components directly.',
        inline: false,
      },
      {
        name: '🚀 Quick Start',
        value: 'Run `/setup panel` for an interactive setup experience with all configuration options and detailed explanations.',
        inline: false,
      },
      {
        name: '🎫 Ticket System Setup',
        value: '`/setup tickets` configures support tickets with options for category, support role, and log channel.',
        inline: false,
      },
      {
        name: '🛒 Shop System Setup (Coming in Phase 2)',
        value: '`/setup shop` configures the e-commerce system with options for shop channel and customer role.',
        inline: false,
      }
    )
    .setFooter({
      text: `Igloo Bot • Type /setup panel to begin configuration`,
      iconURL: client.user.displayAvatarURL(),
    });

  // Topic selection menu
  const topicSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_help_topic')
        .setPlaceholder('Select a topic for detailed help')
        .addOptions([
          {
            label: 'General Setup',
            description: 'Overview of all setup options',
            value: 'general',
            emoji: '⚙️',
          },
          {
            label: 'Ticket System',
            description: 'How to configure tickets',
            value: 'tickets',
            emoji: '🎫',
          },
          {
            label: 'Shop System',
            description: 'How to configure the shop',
            value: 'shop',
            emoji: '🛒',
          },
          {
            label: 'Roadmap',
            description: 'Upcoming features and timeline',
            value: 'roadmap',
            emoji: '📅',
          },
          {
            label: 'Examples',
            description: 'Example command usage',
            value: 'examples',
            emoji: '📝',
          },
        ])
    );

  // Action buttons
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_start_panel')
        .setLabel('Start Setup')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀'),
      new ButtonBuilder()
        .setLabel('Documentation')
        .setStyle(ButtonStyle.Link)
        .setURL('https://docs.igloo.bot/setup')
        .setEmoji('📚')
    );

  // Send help embed
  const response = await interaction.reply({
    embeds: [helpEmbed],
    components: [topicSelectRow, actionRow],
    ephemeral: true,
  });

  // Create collector for interactions
  const collector = response.createMessageComponentCollector({
    time: 10 * 60 * 1000, // 10 minutes
  });

  collector.on('collect', async (componentInteraction) => {
    // Handle topic selection
    if (componentInteraction.customId === 'setup_help_topic') {
      const selectedTopic = componentInteraction.values[0];
      
      switch (selectedTopic) {
        case 'general':
          await showGeneralHelp(componentInteraction, client);
          break;
        case 'tickets':
          await showTicketHelp(componentInteraction, client);
          break;
        case 'shop':
          await showShopHelp(componentInteraction, client);
          break;
        case 'roadmap':
          await showRoadmapHelp(componentInteraction, client);
          break;
        case 'examples':
          await showExamplesHelp(componentInteraction, client);
          break;
      }
    }
    
    // Handle "Start Setup" button
    if (componentInteraction.customId === 'setup_start_panel') {
      await handleSetupPanel(componentInteraction, client);
    }
  });

  collector.on('end', () => {
    // When the collector times out, disable the components
    try {
      const expiredTopicRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('setup_help_topic_expired')
            .setPlaceholder('Help menu expired - use /setup help again')
            .addOptions([{ label: 'Expired', value: 'expired' }])
            .setDisabled(true)
        );

      const expiredActionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_start_panel_expired')
            .setLabel('Start Setup')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🚀')
            .setDisabled(true),
          new ButtonBuilder()
            .setLabel('Documentation')
            .setStyle(ButtonStyle.Link)
            .setURL('https://docs.igloo.bot/setup')
            .setEmoji('📚')
        );

      interaction.editReply({
        components: [expiredTopicRow, expiredActionRow]
      }).catch(err => logger.error('Error updating expired help menu:', err));
    } catch (error) {
      logger.error('Error disabling help menu components:', error);
    }
  });
}

/**
 * Show general setup help
 */
async function showGeneralHelp(interaction, client) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('⚙️ General Setup Help')
    .setDescription('Igloo offers a comprehensive setup system to configure your e-commerce and support systems.')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '🧊 Using the Setup Panel',
        value: 'The setup panel is the easiest way to configure Igloo. Use `/setup panel` to access all settings in an interactive interface.',
        inline: false,
      },
      {
        name: '📋 Available Subcommands',
        value: [
          '`/setup panel` - Interactive setup panel (recommended)',
          '`/setup tickets` - Configure ticket system',
          '`/setup shop` - Configure shop system',
          '`/setup help` - View this help guide'
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔄 Configuration Flow',
        value: [
          '1. Configure the ticket system first',
          '2. Set up roles and permissions',
          '3. Configure shop settings (when available)',
          '4. Create ticket panel in a channel',
          '5. Test your configuration'
        ].join('\n'),
        inline: false,
      },
      {
        name: '📊 Configuration Status',
        value: 'You can check your current configuration at any time from the setup panel by clicking the "Check Current Configuration" button.',
        inline: false,
      }
    );

  // Back button
  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_help_back')
        .setLabel('Back to Help Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

  await interaction.update({
    embeds: [embed],
    components: [backButton],
  });
  
  // Create collector for the back button
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_back') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Show ticket system help
 */
async function showTicketHelp(interaction, client) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎫 Ticket System Setup Help')
    .setDescription('The ticket system allows users to create support tickets for assistance or purchases.')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '📋 Configuration Options',
        value: [
          '• **Ticket Category**: The category where ticket channels will be created',
          '• **Support Role**: The role that can view and respond to tickets',
          '• **Log Channel**: Where ticket events (create/close) are logged',
          '• **Max Tickets**: Maximum number of open tickets per user'
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔧 Setup Command',
        value: '```\n/setup tickets category:#category support_role:@Support log_channel:#logs\n```\nAll parameters are optional - you can set only what you need to change.',
        inline: false,
      },
      {
        name: '🚀 Creating a Ticket Panel',
        value: 'After configuring the ticket system, you can create a panel for users to open tickets:\n```\n/setup panel > Ticket System > Create Ticket Panel\n```',
        inline: false,
      },
      {
        name: '⚠️ Requirements',
        value: 'You must set both a ticket category and support role before creating a ticket panel.',
        inline: false,
      }
    );

  // Back button
  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_help_back')
        .setLabel('Back to Help Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

  await interaction.update({
    embeds: [embed],
    components: [backButton],
  });
  
  // Create collector for the back button
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_back') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Show shop system help
 */
async function showShopHelp(interaction, client) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🛒 Shop System Setup Help')
    .setDescription('The shop system allows you to sell products and services directly through Discord.')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '📋 Configuration Options',
        value: [
          '• **Shop Channel**: Where products will be displayed',
          '• **Customer Role**: Role given to users after purchase',
          '• **Payment Settings**: Coming in Phase 3 (Q3 2025)',
          '• **Product Management**: Coming in Phase 2 (Q2 2025)'
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔧 Setup Command',
        value: '```\n/setup shop shop_channel:#shop customer_role:@Customer\n```\nAll parameters are optional.',
        inline: false,
      },
      {
        name: '⏳ Coming Soon',
        value: [
          '• **Phase 2 (Q2 2025)**: Product management, inventory, shop panel',
          '• **Phase 3 (Q3 2025)**: Payment processing, Stripe integration',
          '• **Phase 4 (Q4 2025)**: Order management, analytics'
        ].join('\n'),
        inline: false,
      },
      {
        name: '⚠️ Current Limitations',
        value: 'The shop system is currently in early development. You can configure basic settings, but full functionality will be available in future updates.',
        inline: false,
      }
    );

  // Back button
  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_help_back')
        .setLabel('Back to Help Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

  await interaction.update({
    embeds: [embed],
    components: [backButton],
  });
  
  // Create collector for the back button
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_back') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Show roadmap help
 */
async function showRoadmapHelp(interaction, client) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('📅 Igloo Development Roadmap')
    .setDescription('Igloo is being developed in phases, with new features released quarterly. Here\'s what to expect:')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '🎯 Phase 1: Q1 2025 - Ticket System Foundation',
        value: [
          '• Basic ticket system with customizable categories',
          '• Staff assignment and ticket management',
          '• Ticket panels and configuration',
          '• Foundation setup and database design'
        ].join('\n'),
        inline: false,
      },
      {
        name: '🛍️ Phase 2: Q2 2025 - Shop Administration',
        value: [
          '• Admin shop panel with web dashboard',
          '• Product management (add, edit, remove)',
          '• Advanced ticket features (transcripts, auto-close)',
          '• Staff performance metrics'
        ].join('\n'),
        inline: false,
      },
      {
        name: '💳 Phase 3: Q3 2025 - Payment Processing',
        value: [
          '• Stripe API integration',
          '• In-ticket product selection',
          '• Secure checkout and payment processing',
          '• Basic automation for FAQs and responses'
        ].join('\n'),
        inline: false,
      },
      {
        name: '📦 Phase 4: Q4 2025 - Order Management',
        value: [
          '• Order tracking and management',
          '• Analytics and reporting dashboard',
          '• Security features and fraud detection',
          '• Digital product delivery automation'
        ].join('\n'),
        inline: false,
      }
    );

  // Back button
  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_help_back')
        .setLabel('Back to Help Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

  await interaction.update({
    embeds: [embed],
    components: [backButton],
  });
  
  // Create collector for the back button
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_back') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Show example commands
 */
async function showExamplesHelp(interaction, client) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('📝 Setup Command Examples')
    .setDescription('Here are some examples of how to use the setup command:')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '🧊 Interactive Setup',
        value: '```\n/setup panel\n```\nOpens the interactive setup panel with all configuration options.',
        inline: false,
      },
      {
        name: '🎫 Configure Ticket System',
        value: '```\n/setup tickets category:#support-tickets support_role:@Support log_channel:#ticket-logs\n```\nSets up the ticket system with specified category, support role, and log channel.',
        inline: false,
      },
      {
        name: '🛒 Configure Shop System',
        value: '```\n/setup shop shop_channel:#shop customer_role:@Customer\n```\nSets up the shop system with specified shop channel and customer role.',
        inline: false,
      },
      {
        name: '❓ Get Help',
        value: '```\n/setup help\n```\nShows this help guide with detailed information about setup commands.',
        inline: false,
      },
      {
        name: '🎫 Create Ticket Panel',
        value: 'After configuring tickets:\n```\n1. Run /setup panel\n2. Select "Ticket System"\n3. Click "Create Ticket Panel"\n4. Mention the channel where to create the panel\n```',
        inline: false,
      }
    );

  // Back button
  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_help_back')
        .setLabel('Back to Help Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

  await interaction.update({
    embeds: [embed],
    components: [backButton],
  });
  
  // Create collector for the back button
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_back') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Handles the main setup panel
 */
async function handleSetupPanel(interaction, client) {
  // Get current guild configuration
  const guildId = interaction.guild.id;
  const config = await getGuildConfig(guildId);
  
  // Create main setup embed with branding
  const setupEmbed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🧊 Igloo Setup Panel')
    .setDescription('Welcome to the Igloo Setup Panel! Configure your e-commerce and support systems using the options below.')
    .setImage(ASSETS.BANNER)
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: '🎫 Ticket System',
        value: getTicketStatusText(config),
        inline: false,
      },
      {
        name: '🛒 Shop System',
        value: getShopStatusText(config),
        inline: false,
      },
      {
        name: '⚙️ General Settings',
        value: getGeneralStatusText(config),
        inline: false,
      }
    )
    .setFooter({
      text: `Igloo Bot • Server: ${interaction.guild.name}`,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTimestamp();

  // Create category selection menu
  const categorySelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_category_select')
        .setPlaceholder('Select a system to configure')
        .addOptions([
          {
            label: 'Ticket System',
            description: 'Configure support tickets',
            value: 'tickets',
            emoji: '🎫',
          },
          {
            label: 'Shop System',
            description: 'Configure e-commerce features',
            value: 'shop',
            emoji: '🛒',
          },
          {
            label: 'General Settings',
            description: 'Configure bot behavior',
            value: 'general',
            emoji: '⚙️',
          },
        ])
    );

  // Create action buttons row
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_check_config')
        .setLabel('Check Current Configuration')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔍'),
      new ButtonBuilder()
        .setCustomId('setup_help_button')
        .setLabel('Help & Documentation')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓'),
      new ButtonBuilder()
        .setCustomId('setup_reset')
        .setLabel('Reset Configuration')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

  // Send the setup panel
  const response = await interaction.reply({
    embeds: [setupEmbed],
    components: [categorySelectRow, actionRow],
    ephemeral: true,
  });

  // Create collector for interactions
  const collector = response.createMessageComponentCollector({
    time: 10 * 60 * 1000, // 10 minutes
  });

  collector.on('collect', async (componentInteraction) => {
    // Handle dropdown menu selection
    if (componentInteraction.customId === 'setup_category_select') {
      const selectedCategory = componentInteraction.values[0];
      
      switch (selectedCategory) {
        case 'tickets':
          await handleTicketSetupMenu(componentInteraction, client, config);
          break;
        case 'shop':
          await handleShopSetupMenu(componentInteraction, client, config);
          break;
        case 'general':
          await handleGeneralSetupMenu(componentInteraction, client, config);
          break;
      }
    }
    
    // Handle button interactions
    if (componentInteraction.customId === 'setup_check_config') {
      // Refresh config data
      const updatedConfig = await getGuildConfig(guildId);
      await showCurrentConfig(componentInteraction, client, updatedConfig);
    }
    
    if (componentInteraction.customId === 'setup_help_button') {
      await handleSetupHelp(componentInteraction, client);
    }
    
    if (componentInteraction.customId === 'setup_reset') {
      await showResetConfirmation(componentInteraction, client, guildId);
    }
    
    // Handle back button
    if (componentInteraction.customId === 'setup_back_main') {
      // Refresh config data
      const updatedConfig = await getGuildConfig(guildId);
      
      // Update embed with fresh data
      setupEmbed.spliceFields(0, 3,
        {
          name: '🎫 Ticket System',
          value: getTicketStatusText(updatedConfig),
          inline: false,
        },
        {
          name: '🛒 Shop System',
          value: getShopStatusText(updatedConfig),
          inline: false,
        },
        {
          name: '⚙️ General Settings',
          value: getGeneralStatusText(updatedConfig),
          inline: false,
        }
      );
      
      await componentInteraction.update({
        embeds: [setupEmbed],
        components: [categorySelectRow, actionRow],
      });
    }
  });

  collector.on('end', () => {
    // When the collector times out, disable the components
    try {
      const expiredCategoryRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('setup_category_select_expired')
            .setPlaceholder('Setup panel expired - use /setup again')
            .addOptions([{ label: 'Expired', value: 'expired' }])
            .setDisabled(true)
        );

      const expiredActionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_check_config_expired')
            .setLabel('Check Current Configuration')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('setup_help_button_expired')
            .setLabel('Help & Documentation')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❓')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('setup_reset_expired')
            .setLabel('Reset Configuration')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(true)
        );

      interaction.editReply({
        components: [expiredCategoryRow, expiredActionRow]
      }).catch(err => logger.error('Error updating expired setup panel:', err));
    } catch (error) {
      logger.error('Error disabling setup panel components:', error);
    }
  });
}

/**
 * Handle the ticket setup menu
 */
async function handleTicketSetupMenu(interaction, client, config) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎫 Ticket System Setup')
    .setDescription('Configure your server\'s ticket system settings')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: 'Current Configuration',
        value: getTicketStatusText(config),
      },
      {
        name: 'Available Settings',
        value: [
          '**📁 Ticket Category** - Where ticket channels are created',
          '**👮 Support Role** - Members with access to all tickets',
          '**📋 Log Channel** - Where ticket events are logged',
          '**⚙️ Other Settings** - Maximum tickets, auto-close time, etc.'
        ].join('\n'),
      },
      {
        name: '❓ Need Help?',
        value: 'Click the "Ticket System Help" button below for detailed guidance and examples.',
      }
    );

  // Create settings buttons
  const settingsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_ticket_category')
        .setLabel('Set Ticket Category')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📁'),
      new ButtonBuilder()
        .setCustomId('setup_ticket_role')
        .setLabel('Set Support Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👮'),
      new ButtonBuilder()
        .setCustomId('setup_ticket_logs')
        .setLabel('Set Log Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋')
    );

  // Create action buttons
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Back to Main Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️'),
      new ButtonBuilder()
        .setCustomId('setup_ticket_help')
        .setLabel('Ticket System Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓'),
      new ButtonBuilder()
        .setCustomId('setup_create_panel')
        .setLabel('Create Ticket Panel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

  await interaction.update({
    embeds: [embed],
    components: [settingsRow, actionRow],
  });
  
  // Create collector for the ticket setup buttons
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    // Handle ticket category setup
    if (buttonInteraction.customId === 'setup_ticket_category') {
      await promptChannelSelection(buttonInteraction, 'Select the category where ticket channels will be created:', 'ticket_category', [ChannelType.GuildCategory]);
    }
    
    // Handle support role setup
    if (buttonInteraction.customId === 'setup_ticket_role') {
      await promptRoleSelection(buttonInteraction, 'Select the role that will have access to tickets:');
    }
    
    // Handle log channel setup
    if (buttonInteraction.customId === 'setup_ticket_logs') {
      await promptChannelSelection(buttonInteraction, 'Select the channel where ticket logs will be sent:', 'ticket_logs', [ChannelType.GuildText]);
    }
    
    // Handle ticket panel creation
    if (buttonInteraction.customId === 'setup_create_panel') {
      await handleTicketPanelCreation(buttonInteraction, client, config);
    }
    
    // Handle ticket help button
    if (buttonInteraction.customId === 'setup_ticket_help') {
      await showTicketHelp(buttonInteraction, client);
    }
  });
}

/**
 * Handle the shop setup menu
 */
async function handleShopSetupMenu(interaction, client, config) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🛒 Shop System Setup')
    .setDescription('Configure your server\'s e-commerce settings')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: 'Current Configuration',
        value: getShopStatusText(config),
      },
      {
        name: 'Available Settings',
        value: [
          '**🏪 Shop Channel** - Where products are displayed',
          '**👥 Customer Role** - Role given after purchase',
          '**💲 Payment Settings** - Connect payment processors',
          '**📦 Product Management** - Add, edit, remove products'
        ].join('\n'),
      },
      {
        name: '❓ Need Help?',
        value: 'Click the "Shop System Help" button below for detailed guidance and examples.',
      },
      {
        name: '⚠️ Coming Soon',
        value: 'Shop system features are coming in Phase 2 (Q2 2025) and Phase 3 (Q3 2025). Basic setup is available now.'
      }
    );

  // Create settings buttons
  const settingsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_shop_channel')
        .setLabel('Set Shop Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏪'),
      new ButtonBuilder()
        .setCustomId('setup_customer_role')
        .setLabel('Set Customer Role')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥'),
      new ButtonBuilder()
        .setCustomId('setup_payment')
        .setLabel('Payment Settings')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💲')
        .setDisabled(true)
    );

  // Create action buttons
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Back to Main Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️'),
      new ButtonBuilder()
        .setCustomId('setup_shop_help')
        .setLabel('Shop System Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓'),
      new ButtonBuilder()
        .setCustomId('setup_roadmap')
        .setLabel('View Roadmap')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📅')
    );

  await interaction.update({
    embeds: [embed],
    components: [settingsRow, actionRow],
  });
  
  // Create collector for the shop setup buttons
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    // Handle shop channel setup
    if (buttonInteraction.customId === 'setup_shop_channel') {
      await promptChannelSelection(buttonInteraction, 'Select the channel where shop products will be displayed:', 'shop_channel', [ChannelType.GuildText]);
    }
    
    // Handle customer role setup
    if (buttonInteraction.customId === 'setup_customer_role') {
      await promptRoleSelection(buttonInteraction, 'Select the role given to customers after purchase:');
    }
    
    // Handle shop help button
    if (buttonInteraction.customId === 'setup_shop_help') {
      await showShopHelp(buttonInteraction, client);
    }
    
    // Handle roadmap button
    if (buttonInteraction.customId === 'setup_roadmap') {
      await showRoadmapHelp(buttonInteraction, client);
    }
  });
}

/**
 * Handle the general setup menu
 */
async function handleGeneralSetupMenu(interaction, client, config) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('⚙️ General Settings')
    .setDescription('Configure general bot settings for your server')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      {
        name: 'Current Configuration',
        value: getGeneralStatusText(config),
      },
      {
        name: 'Available Settings',
        value: [
          '**📢 Announcement Channel** - Where bot announcements are sent',
          '**🤖 Bot Prefix** - Custom command prefix (Coming soon)',
          '**🔔 Notification Settings** - Configure when to notify staff',
          '**🔒 Permission Settings** - Control command access'
        ].join('\n'),
      },
      {
        name: '❓ Need Help?',
        value: 'Click the "General Setup Help" button below for detailed guidance and examples.',
      },
      {
        name: '⚠️ Coming Soon',
        value: 'Some general settings are coming soon and may not be available yet.'
      }
    );

  // Create settings buttons
  const settingsRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_announcement_channel')
        .setLabel('Set Announcement Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📢'),
      new ButtonBuilder()
        .setCustomId('setup_bot_prefix')
        .setLabel('Set Bot Prefix')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🤖')
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('setup_notifications')
        .setLabel('Notification Settings')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔔')
        .setDisabled(true)
    );

  // Create action buttons
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Back to Main Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️'),
      new ButtonBuilder()
        .setCustomId('setup_general_help')
        .setLabel('General Setup Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓'),
      new ButtonBuilder()
        .setCustomId('setup_roadmap')
        .setLabel('View Roadmap')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📅')
    );

  await interaction.update({
    embeds: [embed],
    components: [settingsRow, actionRow],
  });
  
  // Create collector for the general setup buttons
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    // Handle announcement channel setup
    if (buttonInteraction.customId === 'setup_announcement_channel') {
      await promptChannelSelection(buttonInteraction, 'Select the channel where bot announcements will be sent:', 'announcement_channel', [ChannelType.GuildText]);
    }
    
    // Handle general help button
    if (buttonInteraction.customId === 'setup_general_help') {
      await showGeneralHelp(buttonInteraction, client);
    }
    
    // Handle roadmap button
    if (buttonInteraction.customId === 'setup_roadmap') {
      await showRoadmapHelp(buttonInteraction, client);
    }
  });
}

/**
 * Prompt for channel selection
 */
/**
 * Prompt for channel selection using a dropdown menu
 */
async function promptChannelSelection(interaction, prompt, setting, types) {
  const guildId = interaction.guild.id;
  
  // Get available channels of the specified types
  const availableChannels = interaction.guild.channels.cache
    .filter(channel => types.includes(channel.type))
    .map(channel => ({
      label: channel.name.substring(0, 25), // Discord has 25 char limit on labels
      value: channel.id,
      description: `#${channel.name.substring(0, 45)}`,  // 50 char limit on description
    }))
    .slice(0, 25); // Discord has 25 option limit
  
  // If no channels of the required type exist
  if (availableChannels.length === 0) {
    return await interaction.reply({
      content: `❌ No ${types.includes(ChannelType.GuildCategory) ? 'categories' : 'text channels'} found in this server. Please create one first.`,
      ephemeral: true,
    });
  }
  
  // Create the prompt embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Channel Selection')
    .setDescription(prompt);
  
  // Create the channel select menu
  const selectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_channel_select')
        .setPlaceholder('Select a channel')
        .addOptions(availableChannels)
    );
  
  // Add cancel button
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️')
    );
  
  const response = await interaction.reply({
    embeds: [embed],
    components: [selectRow, buttonRow],
    ephemeral: true,
  });
  
  // Create collector for the selection
  const collector = response.createMessageComponentCollector({ 
    time: 60000 // 1 minute
  });
  
  collector.on('collect', async componentInteraction => {
    // Handle channel selection
    if (componentInteraction.customId === 'setup_channel_select') {
      const channelId = componentInteraction.values[0];
      const channel = interaction.guild.channels.cache.get(channelId);
      
      try {
        // Save the channel ID to the database based on the setting
        let updateField;
        
        switch (setting) {
          case 'ticket_category':
            updateField = 'ticket_category_id';
            break;
          case 'ticket_logs':
            updateField = 'log_channel_id';
            break;
          case 'shop_channel':
            updateField = 'shop_channel_id';
            break;
          case 'announcement_channel':
            updateField = 'announcement_channel_id';
            break;
          default:
            throw new Error('Unknown setting');
        }
        
        // Get current config
        const configResult = await db.query(
          'SELECT * FROM guild_config WHERE guild_id = $1',
          [guildId]
        );
        
        if (configResult.rows.length === 0) {
          // Insert new config
          await db.query(
            `INSERT INTO guild_config (guild_id, ${updateField})
             VALUES ($1, $2)`,
            [guildId, channelId]
          );
        } else {
          // Update existing config
          await db.query(
            `UPDATE guild_config
             SET ${updateField} = $1
             WHERE guild_id = $2`,
            [channelId, guildId]
          );
        }
        
        // Confirm the update
        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Channel Set')
          .setDescription(`Successfully set ${setting.replace('_', ' ')} to ${channel}!`)
          .setFooter({ text: 'You can continue with other configuration options.' });
        
        await componentInteraction.update({
          embeds: [successEmbed],
          components: [],
        });
        
        // After a short delay, go back to the appropriate setup menu
        setTimeout(async () => {
          const config = await getGuildConfig(guildId);
          
          if (setting === 'ticket_category' || setting === 'ticket_logs') {
            await handleTicketSetupMenu(componentInteraction, client, config);
          } else if (setting === 'shop_channel') {
            await handleShopSetupMenu(componentInteraction, client, config);
          } else if (setting === 'announcement_channel') {
            await handleGeneralSetupMenu(componentInteraction, client, config);
          }
        }, 2000); // 2 second delay
      } catch (error) {
        logger.error('Error saving channel setting:', error);
        await componentInteraction.update({
          content: '❌ An error occurred while saving your setting. Please try again.',
          embeds: [],
          components: [],
        });
      }
    }
    
    // Handle cancel button
    if (componentInteraction.customId === 'setup_cancel') {
      const config = await getGuildConfig(guildId);
      
      if (setting === 'ticket_category' || setting === 'ticket_logs') {
        await handleTicketSetupMenu(componentInteraction, client, config);
      } else if (setting === 'shop_channel') {
        await handleShopSetupMenu(componentInteraction, client, config);
      } else if (setting === 'announcement_channel') {
        await handleGeneralSetupMenu(componentInteraction, client, config);
      }
    }
  });
  
  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      // Timeout - update the message
      const timeoutEmbed = new EmbedBuilder()
        .setColor(COLORS.DANGER)
        .setTitle('⏱️ Timed Out')
        .setDescription('Channel selection timed out. Please try again.');
      
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [],
      }).catch(err => logger.error('Error updating timed out channel selection:', err));
    }
  });
}

/**
 * Prompt for role selection using a dropdown menu
 */
async function promptRoleSelection(interaction, prompt) {
  const guildId = interaction.guild.id;
  
  // Get available roles (excluding @everyone)
  const availableRoles = interaction.guild.roles.cache
    .filter(role => role.id !== interaction.guild.id) // Filter out @everyone role
    .sort((a, b) => b.position - a.position) // Sort by position (highest first)
    .map(role => ({
      label: role.name.substring(0, 25), // Discord has 25 char limit on labels
      value: role.id,
      description: `Role with ${role.members.size} members`,
    }))
    .slice(0, 25); // Discord has 25 option limit
  
  // If no roles exist
  if (availableRoles.length === 0) {
    return await interaction.reply({
      content: `❌ No roles found in this server (besides @everyone). Please create a role first.`,
      ephemeral: true,
    });
  }
  
  // Create the prompt embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Role Selection')
    .setDescription(prompt);
  
  // Create the role select menu
  const selectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_role_select')
        .setPlaceholder('Select a role')
        .addOptions(availableRoles)
    );
  
  // Add cancel button
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️')
    );
  
  const response = await interaction.reply({
    embeds: [embed],
    components: [selectRow, buttonRow],
    ephemeral: true,
  });
  
  // Create collector for the selection
  const collector = response.createMessageComponentCollector({ 
    time: 60000 // 1 minute
  });
  
  collector.on('collect', async componentInteraction => {
    // Handle role selection
    if (componentInteraction.customId === 'setup_role_select') {
      const roleId = componentInteraction.values[0];
      const role = interaction.guild.roles.cache.get(roleId);
      
      try {
        // Get current config
        const configResult = await db.query(
          'SELECT * FROM guild_config WHERE guild_id = $1',
          [guildId]
        );
        
        if (configResult.rows.length === 0) {
          // Insert new config
          await db.query(
            `INSERT INTO guild_config (guild_id, support_role_id)
             VALUES ($1, $2)`,
            [guildId, roleId]
          );
        } else {
          // Update existing config
          await db.query(
            `UPDATE guild_config
             SET support_role_id = $1
             WHERE guild_id = $2`,
            [roleId, guildId]
          );
        }
        
        // Confirm the update
        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Role Set')
          .setDescription(`Successfully set support role to ${role}!`)
          .setFooter({ text: 'You can continue with other configuration options.' });
        
        await componentInteraction.update({
          embeds: [successEmbed],
          components: [],
        });
        
        // After a short delay, go back to the ticket setup menu
        setTimeout(async () => {
          const config = await getGuildConfig(guildId);
          await handleTicketSetupMenu(componentInteraction, client, config);
        }, 2000); // 2 second delay
      } catch (error) {
        logger.error('Error saving role setting:', error);
        await componentInteraction.update({
          content: '❌ An error occurred while saving your setting. Please try again.',
          embeds: [],
          components: [],
        });
      }
    }
    
    // Handle cancel button
    if (componentInteraction.customId === 'setup_cancel') {
      const config = await getGuildConfig(guildId);
      await handleTicketSetupMenu(componentInteraction, client, config);
    }
  });
  
  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      // Timeout - update the message
      const timeoutEmbed = new EmbedBuilder()
        .setColor(COLORS.DANGER)
        .setTitle('⏱️ Timed Out')
        .setDescription('Role selection timed out. Please try again.');
      
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [],
      }).catch(err => logger.error('Error updating timed out role selection:', err));
    }
  });
}

/**
 * Handle ticket panel creation with improved channel selection
 */
async function handleTicketPanelCreation(interaction, client, config) {
  // First check if we have the required settings
  if (!config.ticket_category_id || !config.support_role_id) {
    return await interaction.reply({
      content: '❌ You need to configure both a ticket category and a support role before creating a ticket panel.',
      ephemeral: true,
    });
  }
  
  // Get available text channels for the panel
  const availableChannels = interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText)
    .map(channel => ({
      label: channel.name.substring(0, 25), // Discord has 25 char limit on labels
      value: channel.id,
      description: `#${channel.name.substring(0, 45)}`,  // 50 char limit on description
    }))
    .slice(0, 25); // Discord has 25 option limit
  
  // If no text channels exist
  if (availableChannels.length === 0) {
    return await interaction.reply({
      content: `❌ No text channels found in this server. Please create a text channel first.`,
      ephemeral: true,
    });
  }
  
  // Create the prompt embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Create Ticket Panel')
    .setDescription('Select the channel where you want to create the ticket panel:')
    .setFooter({ text: 'The ticket panel will be created in the selected channel.' });
  
  // Create the channel select menu
  const selectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_panel_channel_select')
        .setPlaceholder('Select a channel')
        .addOptions(availableChannels)
    );
  
  // Add cancel button
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_cancel_panel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️')
    );
  
  const response = await interaction.reply({
    embeds: [embed],
    components: [selectRow, buttonRow],
    ephemeral: true,
  });
  
  // Create collector for the selection
  const collector = response.createMessageComponentCollector({ 
    time: 60000 // 1 minute
  });
  
  collector.on('collect', async componentInteraction => {
    // Handle channel selection
    if (componentInteraction.customId === 'setup_panel_channel_select') {
      const channelId = componentInteraction.values[0];
      const channel = interaction.guild.channels.cache.get(channelId);
      
      try {
        // Create the ticket panel using the ticketpanel command logic
        // Ice theme colors
        const IGLOO_BLUE = 0x0CAFFF;  // Bright cyan/blue
        
        // Custom igloo banner image URL
        const IGLOO_BANNER = ASSETS.BANNER;
        
        // Create branded embed with ice theme
        const panelEmbed = new EmbedBuilder()
          .setTitle('❄️ Igloo. Ticket Panel')
          .setDescription(
            'Need help? Have a question? Want to report an issue?' +
            ' Click the button below to create a private support ticket.\n\n' +
            '**What happens next:**\n' +
            '• A private ticket channel will be created\n' +
            '• Our support team will be notified\n' +
            '• You\'ll receive assistance as soon as possible\n\n' +
            '**Ticket Categories:**\n' +
            '🛒 **Buy** - Click for making a purchase\n' +
            '🧊 **General Support** - General questions and help\n' +
            '📦 **Order Issues** - Problems with orders\n' +
            '⚙️ **Technical Support** - Technical difficulties\n'
          )
          .setColor(IGLOO_BLUE)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setImage(IGLOO_BANNER)
          .setFooter({ 
            text: 'Igloo E-Commerce Bot • Click below to create a ticket',
            iconURL: client.user.displayAvatarURL()
          });

        // Create button with ice theme
        const button = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('create_ticket')
              .setLabel('Create Ticket')
              .setEmoji('🧊')
              .setStyle(ButtonStyle.Primary)
          );

        // Send panel to specified channel
        await channel.send({
          embeds: [panelEmbed],
          components: [button]
        });
        
        // Create success embed
        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Ticket Panel Created')
          .setDescription(`Ticket panel successfully created in ${channel}!`)
          .addFields({
            name: '📋 Next Steps',
            value: [
              '• Users can now create tickets by clicking the button',
              '• Tickets will be created in the configured category',
              '• The support role will be notified of new tickets',
              '• Ticket logs will be sent to the configured log channel (if set)'
            ].join('\n')
          })
          .setFooter({ text: 'Igloo Bot • Use /setup panel to make further configuration changes' });
        
        // Add additional actions
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('setup_back_main')
              .setLabel('Back to Setup Panel')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('↩️'),
            new ButtonBuilder()
              .setCustomId('setup_check_config_after_panel')
              .setLabel('Check Configuration')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔍')
          );
        
        // Confirm the creation
        await componentInteraction.update({
          embeds: [successEmbed],
          components: [actionRow],
          ephemeral: true,
        });
      } catch (error) {
        logger.error('Error creating ticket panel:', error);
        await componentInteraction.update({
          content: '❌ An error occurred while creating the ticket panel. Please try again.',
          embeds: [],
          components: [],
        });
      }
    }
    
    // Handle cancel button
    if (componentInteraction.customId === 'setup_cancel_panel') {
      const config = await getGuildConfig(interaction.guild.id);
      await handleTicketSetupMenu(componentInteraction, client, config);
    }
  });
  
  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      // Timeout - update the message
      const timeoutEmbed = new EmbedBuilder()
        .setColor(COLORS.DANGER)
        .setTitle('⏱️ Timed Out')
        .setDescription('Panel creation timed out. Please try again.');
      
      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [],
      }).catch(err => logger.error('Error updating timed out panel creation:', err));
    }
  });
}

/**
 * Prompt for role selection
 */
async function promptRoleSelection(interaction, prompt) {
  const guildId = interaction.guild.id;
  
  // Create the prompt embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Role Selection')
    .setDescription(prompt)
    .setFooter({ text: 'Use /setup command to cancel and start over.' });
  
  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
  
  // Create a message collector for the next message from this user
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ 
    filter, 
    max: 1, 
    time: 60000 
  });
  
  collector.on('collect', async message => {
    // Delete the user's message to keep the channel clean
    try {
      await message.delete();
    } catch (error) {
      logger.warn('Could not delete message during setup:', error);
    }
    
    // Check if the message mentions a role
    const roleMention = message.mentions.roles.first();
    
    if (!roleMention) {
      await interaction.followUp({
        content: '❌ Please mention a valid role. Setup canceled - use /setup to start again.',
        ephemeral: true,
      });
      return;
    }
    
    try {
      // Get current config
      const configResult = await db.query(
        'SELECT * FROM guild_config WHERE guild_id = $1',
        [guildId]
      );
      
      if (configResult.rows.length === 0) {
        // Insert new config
        await db.query(
          `INSERT INTO guild_config (guild_id, support_role_id)
           VALUES ($1, $2)`,
          [guildId, roleMention.id]
        );
      } else {
        // Update existing config
        await db.query(
          `UPDATE guild_config
           SET support_role_id = $1
           WHERE guild_id = $2`,
          [roleMention.id, guildId]
        );
      }
      
      // Confirm the update
      await interaction.followUp({
        content: `✅ Successfully set support role to ${roleMention}!`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error saving role setting:', error);
      await interaction.followUp({
        content: '❌ An error occurred while saving your setting. Please try again.',
        ephemeral: true,
      });
    }
  });
  
  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.followUp({
        content: '❌ No role was selected within the time limit. Setup canceled - use /setup to start again.',
        ephemeral: true,
      });
    }
  });
}

/**
 * Handle ticket setup via the /setup tickets subcommand
 */
async function handleTicketSetup(interaction, client) {
  const category = interaction.options.getChannel('category');
  const supportRole = interaction.options.getRole('support_role');
  const logChannel = interaction.options.getChannel('log_channel');
  
  // At least one option must be provided
  if (!category && !supportRole && !logChannel) {
    return await interaction.reply({
      content: '❌ Please provide at least one option to configure.',
      ephemeral: true,
    });
  }
  
  // Get guild ID
  const guildId = interaction.guild.id;
  
  try {
    // Check if guild config exists
    const configResult = await db.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    
    if (configResult.rows.length === 0) {
      // Insert new config
      await db.query(
        `INSERT INTO guild_config (
          guild_id, 
          ticket_category_id, 
          support_role_id, 
          log_channel_id
        ) VALUES ($1, $2, $3, $4)`,
        [
          guildId, 
          category?.id || null, 
          supportRole?.id || null, 
          logChannel?.id || null
        ]
      );
    } else {
      // Update existing config with non-null values
      const updates = [];
      const values = [guildId];
      let paramIndex = 2;
      
      if (category) {
        updates.push(`ticket_category_id = $${paramIndex++}`);
        values.push(category.id);
      }
      
      if (supportRole) {
        updates.push(`support_role_id = $${paramIndex++}`);
        values.push(supportRole.id);
      }
      
      if (logChannel) {
        updates.push(`log_channel_id = $${paramIndex++}`);
        values.push(logChannel.id);
      }
      
      await db.query(
        `UPDATE guild_config
         SET ${updates.join(', ')}
         WHERE guild_id = $1`,
        values
      );
    }
    
    // Create success message
    const successParts = [];
    if (category) successParts.push(`Ticket Category: ${category}`);
    if (supportRole) successParts.push(`Support Role: ${supportRole}`);
    if (logChannel) successParts.push(`Log Channel: ${logChannel}`);
    
    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('✅ Ticket System Configured')
      .setDescription('The ticket system has been successfully configured with the following settings:')
      .addFields({ name: 'Updated Settings', value: successParts.join('\n') })
      .setFooter({ text: 'Use /setup panel to configure more settings' });
    
    // Add help button
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_panel_after_config')
          .setLabel('Open Setup Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('setup_ticket_help_after_config')
          .setLabel('Ticket System Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓'),
        new ButtonBuilder()
          .setCustomId('setup_create_panel_after_config')
          .setLabel('Create Ticket Panel')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );
    
    const response = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true,
    });
    
    // Create collector for buttons
    const collector = response.createMessageComponentCollector({
      time: 5 * 60 * 1000, // 5 minutes
    });
    
    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'setup_panel_after_config') {
        await handleSetupPanel(buttonInteraction, client);
      }
      
      if (buttonInteraction.customId === 'setup_ticket_help_after_config') {
        await showTicketHelp(buttonInteraction, client);
      }
      
      if (buttonInteraction.customId === 'setup_create_panel_after_config') {
        const config = await getGuildConfig(guildId);
        await handleTicketPanelCreation(buttonInteraction, client, config);
      }
    });
    
  } catch (error) {
    logger.error('Error in ticket setup:', error);
    await interaction.reply({
      content: '❌ An error occurred while configuring the ticket system. Please try again later.',
      ephemeral: true,
    });
  }
}

/**
 * Handle shop setup via the /setup shop subcommand
 */
async function handleShopSetup(interaction, client) {
  const shopChannel = interaction.options.getChannel('shop_channel');
  const customerRole = interaction.options.getRole('customer_role');
  
  // At least one option must be provided
  if (!shopChannel && !customerRole) {
    return await interaction.reply({
      content: '❌ Please provide at least one option to configure.',
      ephemeral: true,
    });
  }
  
  // Get guild ID
  const guildId = interaction.guild.id;
  
  try {
    // Check if guild config exists
    const configResult = await db.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    
    if (configResult.rows.length === 0) {
      // Insert new config
      await db.query(
        `INSERT INTO guild_config (
          guild_id, 
          shop_channel_id, 
          customer_role_id
        ) VALUES ($1, $2, $3)`,
        [
          guildId, 
          shopChannel?.id || null, 
          customerRole?.id || null
        ]
      );
    } else {
      // Update existing config with non-null values
      const updates = [];
      const values = [guildId];
      let paramIndex = 2;
      
      if (shopChannel) {
        updates.push(`shop_channel_id = $${paramIndex++}`);
        values.push(shopChannel.id);
      }
      
      if (customerRole) {
        updates.push(`customer_role_id = $${paramIndex++}`);
        values.push(customerRole.id);
      }
      
      await db.query(
        `UPDATE guild_config
         SET ${updates.join(', ')}
         WHERE guild_id = $1`,
        values
      );
    }
    
    // Create success message
    const successParts = [];
    if (shopChannel) successParts.push(`Shop Channel: ${shopChannel}`);
    if (customerRole) successParts.push(`Customer Role: ${customerRole}`);
    
    // Create success embed
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('✅ Shop System Configured')
      .setDescription('The shop system has been successfully configured with the following settings:')
      .addFields(
        { name: 'Updated Settings', value: successParts.join('\n') },
        { name: '⚠️ Coming Soon', value: 'Full shop functionality is coming in Phase 2 (Q2 2025) and Phase 3 (Q3 2025).' }
      )
      .setFooter({ text: 'Use /setup panel to configure more settings' });
    
    // Add help button
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_panel_after_shop_config')
          .setLabel('Open Setup Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('setup_shop_help_after_config')
          .setLabel('Shop System Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓'),
        new ButtonBuilder()
          .setCustomId('setup_roadmap_after_config')
          .setLabel('View Roadmap')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📅')
      );
    
    const response = await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true,
    });
    
    // Create collector for buttons
    const collector = response.createMessageComponentCollector({
      time: 5 * 60 * 1000, // 5 minutes
    });
    
    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.customId === 'setup_panel_after_shop_config') {
        await handleSetupPanel(buttonInteraction, client);
      }
      
      if (buttonInteraction.customId === 'setup_shop_help_after_config') {
        await showShopHelp(buttonInteraction, client);
      }
      
      if (buttonInteraction.customId === 'setup_roadmap_after_config') {
        await showRoadmapHelp(buttonInteraction, client);
      }
    });
    
  } catch (error) {
    logger.error('Error in shop setup:', error);
    await interaction.reply({
      content: '❌ An error occurred while configuring the shop system. Please try again later.',
      ephemeral: true,
    });
  }
}

/**
 * Show the current configuration
 */
async function showCurrentConfig(interaction, client, config) {
  // Create embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🔍 Current Configuration')
    .setDescription('Here is your server\'s current Igloo configuration:')
    .setThumbnail(client.user.displayAvatarURL());
  
  // Add ticket system settings
  const ticketSettings = [];
  if (config.ticket_category_id) {
    const category = interaction.guild.channels.cache.get(config.ticket_category_id);
    ticketSettings.push(`📁 Category: ${category ? category.name : 'Unknown (ID: ' + config.ticket_category_id + ')'}`);
  }
  
  if (config.support_role_id) {
    const role = interaction.guild.roles.cache.get(config.support_role_id);
    ticketSettings.push(`👮 Support Role: ${role ? role.name : 'Unknown (ID: ' + config.support_role_id + ')'}`);
  }
  
  if (config.log_channel_id) {
    const channel = interaction.guild.channels.cache.get(config.log_channel_id);
    ticketSettings.push(`📋 Log Channel: ${channel ? channel.name : 'Unknown (ID: ' + config.log_channel_id + ')'}`);
  }
  
  if (ticketSettings.length > 0) {
    embed.addFields({
      name: '🎫 Ticket System',
      value: ticketSettings.join('\n') || 'Not configured',
    });
  } else {
    embed.addFields({
      name: '🎫 Ticket System',
      value: 'Not configured',
    });
  }
  
  // Add shop system settings
  const shopSettings = [];
  if (config.shop_channel_id) {
    const channel = interaction.guild.channels.cache.get(config.shop_channel_id);
    shopSettings.push(`🏪 Shop Channel: ${channel ? channel.name : 'Unknown (ID: ' + config.shop_channel_id + ')'}`);
  }
  
  if (config.customer_role_id) {
    const role = interaction.guild.roles.cache.get(config.customer_role_id);
    shopSettings.push(`👥 Customer Role: ${role ? role.name : 'Unknown (ID: ' + config.customer_role_id + ')'}`);
  }
  
  if (shopSettings.length > 0) {
    embed.addFields({
      name: '🛒 Shop System',
      value: shopSettings.join('\n') || 'Not configured',
    });
  } else {
    embed.addFields({
      name: '🛒 Shop System',
      value: 'Not configured',
    });
  }
  
  // Add general settings
  const generalSettings = [];
  if (config.announcement_channel_id) {
    const channel = interaction.guild.channels.cache.get(config.announcement_channel_id);
    generalSettings.push(`📢 Announcement Channel: ${channel ? channel.name : 'Unknown (ID: ' + config.announcement_channel_id + ')'}`);
  }
  
  if (generalSettings.length > 0) {
    embed.addFields({
      name: '⚙️ General Settings',
      value: generalSettings.join('\n') || 'Not configured',
    });
  } else {
    embed.addFields({
      name: '⚙️ General Settings',
      value: 'Not configured',
    });
  }
  
  // Add setup recommendations
  const recommendations = [];
  
  if (!config.ticket_category_id || !config.support_role_id) {
    recommendations.push('• Set up ticket category and support role to enable the ticket system');
  }
  
  if (!config.log_channel_id) {
    recommendations.push('• Set up a log channel to keep track of ticket activity');
  }
  
  if (!config.shop_channel_id || !config.customer_role_id) {
    recommendations.push('• Configure shop channel and customer role for the shop system (coming in Phase 2)');
  }
  
  if (recommendations.length > 0) {
    embed.addFields({
      name: '💡 Recommendations',
      value: recommendations.join('\n'),
    });
  }
  
  // Add help note and roadmap reference
  embed.addFields({
    name: '❓ Need Help?',
    value: 'Use `/setup help` for detailed guidance on configuration options and upcoming features.',
  });
  
  // Add action buttons
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Back to Setup Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️'),
      new ButtonBuilder()
        .setCustomId('setup_help_from_config')
        .setLabel('Setup Help')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓')
    );
  
  const response = await interaction.update({
    embeds: [embed],
    components: [actionRow],
  });
  
  // Create collector for buttons
  const collector = response.createMessageComponentCollector({
    time: 5 * 60 * 1000, // 5 minutes
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_help_from_config') {
      await handleSetupHelp(buttonInteraction, client);
    }
  });
}

/**
 * Show reset confirmation
 */
async function showResetConfirmation(interaction, client, guildId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.DANGER)
    .setTitle('⚠️ Reset Configuration')
    .setDescription('Are you sure you want to reset all Igloo configuration for this server? This action cannot be undone.')
    .setFooter({ text: 'This will delete all settings, but not any created channels or roles.' });
  
  const confirmRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('setup_reset_confirm')
        .setLabel('Yes, Reset Everything')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️'),
      new ButtonBuilder()
        .setCustomId('setup_back_main')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️')
    );
  
  const response = await interaction.update({
    embeds: [embed],
    components: [confirmRow],
  });
  
  // Create collector for confirmation
  const collector = response.createMessageComponentCollector({
    time: 30000, // 30 seconds
  });
  
  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.customId === 'setup_reset_confirm') {
      try {
        // Delete all config for this guild
        await db.query(
          'DELETE FROM guild_config WHERE guild_id = $1',
          [guildId]
        );
        
        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Configuration Reset')
          .setDescription('All Igloo configuration for this server has been reset.')
          .setFooter({ text: 'Use /setup to configure the bot again.' });
        
        // Add help button
        const actionRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('setup_panel_after_reset')
              .setLabel('Open Setup Panel')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('⚙️'),
            new ButtonBuilder()
              .setCustomId('setup_help_after_reset')
              .setLabel('Setup Help')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('❓')
          );
        
        await buttonInteraction.update({
          embeds: [successEmbed],
          components: [actionRow],
        });
        
        // Create collector for buttons
        const resetCollector = response.createMessageComponentCollector({
          time: 5 * 60 * 1000, // 5 minutes
        });
        
        resetCollector.on('collect', async (buttonInteraction) => {
          if (buttonInteraction.customId === 'setup_panel_after_reset') {
            await handleSetupPanel(buttonInteraction, client);
          }
          
          if (buttonInteraction.customId === 'setup_help_after_reset') {
            await handleSetupHelp(buttonInteraction, client);
          }
        });
      } catch (error) {
        logger.error('Error resetting configuration:', error);
        await buttonInteraction.update({
          content: '❌ An error occurred while resetting the configuration. Please try again later.',
          embeds: [],
          components: [],
        });
      }
    }
  });
  
  collector.on('end', collected => {
    if (collected.size === 0) {
      // Timeout - go back to main menu
      interaction.editReply({
        content: 'Reset confirmation timed out.',
        embeds: [],
        components: [],
      }).catch(err => logger.error('Error updating timed out reset confirmation:', err));
    }
  });
}

/**
 * Handle ticket panel creation
 */
async function handleTicketPanelCreation(interaction, client, config) {
  // First check if we have the required settings
  if (!config.ticket_category_id || !config.support_role_id) {
    return await interaction.reply({
      content: '❌ You need to configure both a ticket category and a support role before creating a ticket panel.',
      ephemeral: true,
    });
  }
  
  // Create the prompt embed
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('Create Ticket Panel')
    .setDescription('Where would you like to create the ticket panel? Please mention a channel.')
    .setFooter({ text: 'The ticket panel will be created in the mentioned channel.' });
  
  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
  
  // Create a message collector for the next message from this user
  const filter = m => m.author.id === interaction.user.id;
  const collector = interaction.channel.createMessageCollector({ 
    filter, 
    max: 1, 
    time: 60000 
  });
  
  collector.on('collect', async message => {
    // Delete the user's message to keep the channel clean
    try {
      await message.delete();
    } catch (error) {
      logger.warn('Could not delete message during setup:', error);
    }
    
    // Check if the message mentions a channel
    const channelMention = message.mentions.channels.first();
    
    if (!channelMention) {
      await interaction.followUp({
        content: '❌ Please mention a valid text channel. Panel creation canceled.',
        ephemeral: true,
      });
      return;
    }
    
    // Check if the channel is a text channel
    if (channelMention.type !== ChannelType.GuildText) {
      await interaction.followUp({
        content: '❌ The channel must be a text channel. Panel creation canceled.',
        ephemeral: true,
      });
      return;
    }
    
    try {
      // Create the ticket panel using the ticketpanel command logic
      // Ice theme colors
      const IGLOO_BLUE = 0x0CAFFF;  // Bright cyan/blue
      
      // Custom igloo banner image URL
      const IGLOO_BANNER = ASSETS.BANNER;
      
      // Create branded embed with ice theme
      const panelEmbed = new EmbedBuilder()
        .setTitle('❄️ Igloo. Ticket Panel')
        .setDescription(
          'Need help? Have a question? Want to report an issue?' +
          ' Click the button below to create a private support ticket.\n\n' +
          '**What happens next:**\n' +
          '• A private ticket channel will be created\n' +
          '• Our support team will be notified\n' +
          '• You\'ll receive assistance as soon as possible\n\n' +
          '**Ticket Categories:**\n' +
          '🛒 **Buy** - Click for making a purchase\n' +
          '🧊 **General Support** - General questions and help\n' +
          '📦 **Order Issues** - Problems with orders\n' +
          '⚙️ **Technical Support** - Technical difficulties\n'
        )
        .setColor(IGLOO_BLUE)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setImage(IGLOO_BANNER)
        .setFooter({ 
          text: 'Igloo E-Commerce Bot • Click below to create a ticket',
          iconURL: client.user.displayAvatarURL()
        });

      // Create button with ice theme
      const button = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setEmoji('🧊')
            .setStyle(ButtonStyle.Primary)
        );

      // Send panel to specified channel
      await channelMention.send({
        embeds: [panelEmbed],
        components: [button]
      });
      
      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('✅ Ticket Panel Created')
        .setDescription(`Ticket panel successfully created in ${channelMention}!`)
        .addFields({
          name: '📋 Next Steps',
          value: [
            '• Users can now create tickets by clicking the button',
            '• Tickets will be created in the configured category',
            '• The support role will be notified of new tickets',
            '• Ticket logs will be sent to the configured log channel (if set)'
          ].join('\n')
        })
        .setFooter({ text: 'Igloo Bot • Use /setup panel to make further configuration changes' });
      
      // Add additional actions
      const actionRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_back_main')
            .setLabel('Back to Setup Panel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️'),
          new ButtonBuilder()
            .setCustomId('setup_check_config_after_panel')
            .setLabel('Check Configuration')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔍')
        );
      
      // Confirm the creation
      await interaction.followUp({
        embeds: [successEmbed],
        components: [actionRow],
        ephemeral: true,
      });
      
      // Create collector for buttons
      const response = await interaction.fetchReply();
      const buttonCollector = response.createMessageComponentCollector({
        time: 5 * 60 * 1000, // 5 minutes
      });
      
      buttonCollector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId === 'setup_check_config_after_panel') {
          const updatedConfig = await getGuildConfig(guildId);
          await showCurrentConfig(buttonInteraction, client, updatedConfig);
        }
      });
    } catch (error) {
      logger.error('Error creating ticket panel:', error);
      await interaction.followUp({
        content: '❌ An error occurred while creating the ticket panel. Please try again.',
        ephemeral: true,
      });
    }
  });
  
  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.followUp({
        content: '❌ No channel was selected within the time limit. Panel creation canceled.',
        ephemeral: true,
      });
    }
  });
}

/**
 * Get guild configuration from database
 */
async function getGuildConfig(guildId) {
  try {
    const result = await db.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );
    
    return result.rows[0] || {};
  } catch (error) {
    logger.error('Error getting guild config:', error);
    return {};
  }
}

/**
 * Get ticket status text based on config
 */
function getTicketStatusText(config) {
  if (!config.ticket_category_id && !config.support_role_id && !config.log_channel_id) {
    return '❌ Not configured';
  }
  
  const parts = [];
  
  if (config.ticket_category_id) {
    parts.push('✅ Ticket category set');
  } else {
    parts.push('❌ No ticket category');
  }
  
  if (config.support_role_id) {
    parts.push('✅ Support role set');
  } else {
    parts.push('❌ No support role');
  }
  
  if (config.log_channel_id) {
    parts.push('✅ Log channel set');
  } else {
    parts.push('❌ No log channel');
  }
  
  return parts.join('\n');
}

/**
 * Get shop status text based on config
 */
function getShopStatusText(config) {
  if (!config.shop_channel_id && !config.customer_role_id) {
    return '❌ Not configured';
  }
  
  const parts = [];
  
  if (config.shop_channel_id) {
    parts.push('✅ Shop channel set');
  } else {
    parts.push('❌ No shop channel');
  }
  
  if (config.customer_role_id) {
    parts.push('✅ Customer role set');
  } else {
    parts.push('❌ No customer role');
  }
  
  parts.push('⚠️ Shop system coming soon!');
  
  return parts.join('\n');
}

/**
 * Get general status text based on config
 */
function getGeneralStatusText(config) {
  if (!config.announcement_channel_id) {
    return '❌ Not configured';
  }
  
  const parts = [];
  
  if (config.announcement_channel_id) {
    parts.push('✅ Announcement channel set');
  } else {
    parts.push('❌ No announcement channel');
  }
  
  return parts.join('\n');
}