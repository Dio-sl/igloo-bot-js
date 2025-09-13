const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  PermissionFlagsBits,
} = require('discord.js');
const { logger } = require('../../utils/logger');

// IGLOO Theme Colors
const COLORS = {
  PRIMARY: 0x0CAFFF,    // Bright cyan blue - primary brand color
  SECONDARY: 0x87CEEB,  // Sky blue - secondary accents
  SUCCESS: 0x7FFFD4,    // Aquamarine - success indicators
  DANGER: 0xE91E63,     // Pink-ish - danger/warning color
  DARK: 0x0A5C7A,       // Dark blue - background color
};

// IGLOO Theme Emojis
const EMOJIS = {
  LOGO: '🧊',
  TICKET: '🎫',
  SHOP: '🛒',
  UTILITY: '🔧',
  ADMIN: '👑',
  STATS: '📊',
  LINKS: '🔗',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with Igloo bot commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false)
        .setAutocomplete(true)
    ),
  
  category: 'utility',
  cooldown: 3,
  
  async execute(interaction, client) {
    const commandName = interaction.options.getString('command');

    // Get all available commands, organized by category
    const commandCategories = new Map();
    
    // Sort commands into categories
    for (const [name, command] of client.commands.entries()) {
      if (!command.category) continue;
      
      // Check if user has permission to use this command
      let hasPermission = true;
      if (command.data.default_member_permissions) {
        const requiredPerms = BigInt(command.data.default_member_permissions);
        hasPermission = interaction.memberPermissions?.has(requiredPerms) ?? true;
      }
      
      // Only show commands the user has permission to use
      if (hasPermission) {
        if (!commandCategories.has(command.category)) {
          commandCategories.set(command.category, []);
        }
        commandCategories.get(command.category).push(command);
      }
    }

    if (commandName) {
      // Show specific command help with more details
      const command = client.commands.get(commandName);
      
      if (!command) {
        await interaction.reply({
          content: `Command \`${commandName}\` not found!`,
          ephemeral: true,
        });
        return;
      }

      // Check if the user has permission to use this command
      let hasPermission = true;
      if (command.data.default_member_permissions) {
        const requiredPerms = BigInt(command.data.default_member_permissions);
        hasPermission = interaction.memberPermissions?.has(requiredPerms) ?? true;
      }

      if (!hasPermission) {
        await interaction.reply({
          content: `You don't have permission to use the \`/${commandName}\` command.`,
          ephemeral: true,
        });
        return;
      }

      // Create embed with detailed command information
      const embed = new EmbedBuilder()
        .setTitle(`${getCategoryEmoji(command.category)} Command: /${command.data.name}`)
        .setDescription(command.data.description)
        .setColor(COLORS.PRIMARY)
        .addFields(
          { name: 'Category', value: command.category.charAt(0).toUpperCase() + command.category.slice(1), inline: true },
          { name: 'Cooldown', value: `${command.cooldown || 3} seconds`, inline: true }
        );

      // Add options if the command has any
      if (command.data.options && command.data.options.length > 0) {
        const optionsField = command.data.options.map(option => {
          const required = option.required ? '(Required)' : '(Optional)';
          return `• **${option.name}**: ${option.description} ${required}`;
        }).join('\n');
        
        embed.addFields({ name: 'Options', value: optionsField });
      }

      // Add usage examples if available
      if (command.examples) {
        embed.addFields({ name: 'Examples', value: command.examples.join('\n') });
      }

      // Add extra info if available
      if (command.extraInfo) {
        embed.addFields({ name: 'Additional Information', value: command.extraInfo });
      }

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_back')
            .setLabel('Back to Help Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      const response = await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        ephemeral: true 
      });

      // Create a collector for button interactions
      const collector = response.createMessageComponentCollector({ 
        componentType: ComponentType.Button,
        time: 3 * 60 * 1000 // 3 minutes
      });

      collector.on('collect', async buttonInteraction => {
        if (buttonInteraction.customId === 'help_back') {
          await handleMainMenu(buttonInteraction, client, commandCategories);
          collector.stop();
        }
      });

    } else {
      // Show main help menu
      await handleMainMenu(interaction, client, commandCategories);
    }
  }
};

/**
 * Handle the main help menu display
 */
async function handleMainMenu(interaction, client, commandCategories) {
  // Create main help embed
  const embed = createMainEmbed(client);
  
  // Create category selection menu
  const categorySelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('Select a command category')
        .addOptions([
          {
            label: 'Ticket Commands',
            description: 'Manage support tickets',
            value: 'tickets',
            emoji: EMOJIS.TICKET,
          },
          {
            label: 'Shop Commands',
            description: 'Browse and purchase products',
            value: 'shop',
            emoji: EMOJIS.SHOP,
          },
          {
            label: 'Utility Commands',
            description: 'General utility functions',
            value: 'utility',
            emoji: EMOJIS.UTILITY,
          },
          {
            label: 'Admin Commands',
            description: 'Server management commands',
            value: 'admin',
            emoji: EMOJIS.ADMIN,
          },
        ])
    );

  // Create button row
  const buttonRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.SUPPORT_SERVER || 'https://discord.gg/your-invite')
        .setEmoji('💬'),
      new ButtonBuilder()
        .setLabel('Invite Bot')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setLabel('Documentation')
        .setStyle(ButtonStyle.Link)
        .setURL('https://docs.igloo.bot')
        .setEmoji('📚')
    );

  // Check if this is a reply or a button interaction
  const method = interaction.replied ? 'editReply' : 'reply';
  
  const response = await interaction[method]({ 
    embeds: [embed], 
    components: [categorySelectRow, buttonRow], 
    ephemeral: true 
  });

  // Create collectors for the select menu
  const collector = response.createMessageComponentCollector({ 
    time: 5 * 60 * 1000 // 5 minutes
  });

  collector.on('collect', async menuInteraction => {
    // Handle category selection
    if (menuInteraction.customId === 'help_category_select') {
      const categoryName = menuInteraction.values[0];
      const categoryEmbed = await createCategoryEmbed(client, categoryName, commandCategories);
      
      // Add back button to return to main menu
      const backButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_main_menu')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );
      
      await menuInteraction.update({ 
        embeds: [categoryEmbed], 
        components: [backButton]
      });
    }
    
    // Handle back button
    if (menuInteraction.customId === 'help_main_menu') {
      const mainEmbed = createMainEmbed(client);
      
      await menuInteraction.update({ 
        embeds: [mainEmbed], 
        components: [categorySelectRow, buttonRow]
      });
    }
  });

  collector.on('end', () => {
    // When the collector times out, disable the components
    try {
      const expiredRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select_expired')
            .setPlaceholder('Help menu expired - use /help again')
            .addOptions([{ label: 'Expired', value: 'expired' }])
            .setDisabled(true)
        );

      const expiredButtonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL(process.env.SUPPORT_SERVER || 'https://discord.gg/your-invite')
            .setEmoji('💬'),
          new ButtonBuilder()
            .setLabel('Invite Bot')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user?.id}&permissions=8&scope=bot%20applications.commands`)
            .setEmoji('➕'),
          new ButtonBuilder()
            .setLabel('Documentation')
            .setStyle(ButtonStyle.Link)
            .setURL('https://docs.igloo.bot')
            .setEmoji('📚')
        );

      interaction.editReply({ 
        components: [expiredRow, expiredButtonRow]
      }).catch(err => logger.error('Error updating expired help menu:', err));
    } catch (error) {
      logger.error('Error disabling help menu components:', error);
    }
  });
}

/**
 * Create the main help embed
 */
function createMainEmbed(client) {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.LOGO} Igloo Bot Help`)
    .setDescription('Igloo is a complete e-commerce automation bot for Discord communities. Select a category below to view available commands or use `/help command` to get detailed help for a specific command.')
    .setColor(COLORS.PRIMARY)
    .setThumbnail(client.user?.displayAvatarURL() || '')
    .addFields(
      {
        name: `${EMOJIS.TICKET} Ticket Commands`,
        value: 'Create and manage support tickets for your server',
        inline: true
      },
      {
        name: `${EMOJIS.SHOP} Shop Commands`,
        value: 'Browse products and manage orders',
        inline: true
      },
      {
        name: `${EMOJIS.UTILITY} Utility Commands`,
        value: 'General bot utilities and information',
        inline: true
      },
      {
        name: `${EMOJIS.ADMIN} Admin Commands`,
        value: 'Server configuration and management',
        inline: true
      }
    )
    .addFields(
      {
        name: `${EMOJIS.STATS} Bot Statistics`,
        value: [
          `**Servers:** ${client.guilds.cache.size}`,
          `**Users:** ${client.users.cache.size}`,
          `**Uptime:** ${formatUptime(client.uptime || 0)}`
        ].join('\n'),
        inline: true,
      },
      {
        name: `${EMOJIS.LINKS} Quick Links`,
        value: [
          `[Support Server](${process.env.SUPPORT_SERVER || 'https://discord.gg/your-invite'})`,
          `[Documentation](https://docs.igloo.bot)`,
          `[Dashboard](https://igloo.bot)`
        ].join('\n'),
        inline: true,
      }
    )
    .setFooter({
      text: `Igloo Bot • Version ${process.env.BOT_VERSION || '0.1.0'} • Phase ${process.env.BOT_PHASE || '1'}`,
      iconURL: client.user?.displayAvatarURL(),
    })
    .setTimestamp();
}

/**
 * Create a category-specific embed
 */
async function createCategoryEmbed(client, categoryName, commandCategories) {
  // Get emoji for the category
  const categoryEmoji = getCategoryEmoji(categoryName);
  
  // Format category name for display
  const formattedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  
  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`${categoryEmoji} ${formattedName} Commands`)
    .setColor(COLORS.PRIMARY)
    .setThumbnail(client.user?.displayAvatarURL() || '');

  // Get all commands in this category
  const commands = commandCategories.get(categoryName) || [];
  
  if (commands.length === 0) {
    // If no commands found or all are coming soon
    embed.setDescription(`There are no ${formattedName} commands available yet. Check back soon!`);
    
    // Add placeholder commands based on category
    switch (categoryName) {
      case 'tickets':
        embed.addFields(
          { name: '`/ticket`', value: 'Create a support ticket', inline: true },
          { name: '`/close`', value: 'Close current ticket (Coming soon)', inline: true }
        );
        break;
      case 'shop':
        embed.addFields(
          { name: '`/shop`', value: 'View available products (Coming soon)', inline: true },
          { name: '`/order`', value: 'View your orders (Coming soon)', inline: true }
        );
        break;
      case 'utility':
        embed.addFields(
          { name: '`/help`', value: 'Show this help menu', inline: true },
          { name: '`/ping`', value: 'Check bot latency (Coming soon)', inline: true }
        );
        break;
      case 'admin':
        embed.addFields(
          { name: '`/setup`', value: 'Configure bot for your server (Coming soon)', inline: true },
          { name: '`/panel`', value: 'Access admin panel (Coming soon)', inline: true }
        );
        break;
    }
  } else {
    // Add real commands with descriptions
    embed.setDescription(`Here are all the available ${formattedName} commands. Use \`/help command\` for more details.`);
    
    // Sort commands alphabetically
    commands.sort((a, b) => a.data.name.localeCompare(b.data.name));
    
    // Add each command to the embed
    for (const command of commands) {
      embed.addFields({
        name: `\`/${command.data.name}\``,
        value: command.data.description,
        inline: true
      });
    }
    
    // Add placeholder for upcoming commands if appropriate
    if (categoryName === 'tickets' && !commands.some(cmd => cmd.data.name === 'close')) {
      embed.addFields({ name: '`/close`', value: 'Close current ticket (Coming soon)', inline: true });
    }
    
    if (categoryName === 'shop' && !commands.some(cmd => cmd.data.name === 'shop')) {
      embed.addFields({ name: '`/shop`', value: 'View available products (Coming soon)', inline: true });
    }
    
    if (categoryName === 'admin' && !commands.some(cmd => cmd.data.name === 'setup')) {
      embed.addFields({ name: '`/setup`', value: 'Configure bot for your server (Coming soon)', inline: true });
    }
  }
  
  // Add usage note
  embed.addFields({
    name: 'How to use commands',
    value: 'Type `/` in the chat to see available commands. Select a command and fill in any required options.'
  });
  
  return embed;
}

/**
 * Get the appropriate emoji for a category
 */
function getCategoryEmoji(category) {
  switch (category?.toLowerCase()) {
    case 'tickets':
      return EMOJIS.TICKET;
    case 'shop':
      return EMOJIS.SHOP;
    case 'utility':
      return EMOJIS.UTILITY;
    case 'admin':
      return EMOJIS.ADMIN;
    default:
      return EMOJIS.LOGO;
  }
}

/**
 * Format uptime into a readable string
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400000);
  const hours = Math.floor((uptime % 86400000) / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}