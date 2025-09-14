// Dropdown Interaction Diagnostic Tool
// Run this to verify the bot's dropdown detection and handling
const { Client, GatewayIntentBits, Events, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

// Initialize the Discord client with relevant intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Setup diagnostic event handlers
client.on('ready', () => {
  console.log(`[DIAGNOSTIC] Logged in as ${client.user.tag}`);
  console.log('[DIAGNOSTIC] Bot is ready to test dropdown interactions');
  console.log('[DIAGNOSTIC] Use the /test-dropdown command to run diagnostics');
});

// Track seen interactions for debugging
const seenInteractions = new Map();

// Register slash command for dropdown testing
client.on(Events.ClientReady, async () => {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log('[DIAGNOSTIC] No guilds found. Add the bot to a server first.');
      return;
    }

    // Register the test command for the first guild
    const command = {
      name: 'test-dropdown',
      description: 'Test dropdown menu interactions',
    };

    await guild.commands.create(command);
    console.log(`[DIAGNOSTIC] Test command registered in guild: ${guild.name}`);
  } catch (error) {
    console.error('[DIAGNOSTIC] Error registering test command:', error);
  }
});

// Handle command interactions
client.on(Events.InteractionCreate, async interaction => {
  // Log all interactions for diagnostics
  console.log(`[DIAGNOSTIC] Interaction received: Type=${interaction.type}, ID=${interaction.id}`);
  
  if (interaction.isStringSelectMenu()) {
    console.log(`[DIAGNOSTIC] StringSelectMenu detected: ${interaction.customId}`);
    console.log(`[DIAGNOSTIC] Selected values: ${interaction.values.join(', ')}`);
    
    // Track this interaction
    seenInteractions.set(interaction.id, {
      type: 'StringSelectMenu',
      customId: interaction.customId,
      timestamp: new Date(),
      values: interaction.values
    });
    
    // For test dropdowns, acknowledge
    if (interaction.customId === 'test_dropdown') {
      await interaction.reply({
        content: `✅ Selection received: ${interaction.values.join(', ')}`,
        ephemeral: true
      });
    }
  }
  
  // Create test dropdown
  if (interaction.isChatInputCommand() && interaction.commandName === 'test-dropdown') {
    console.log('[DIAGNOSTIC] Creating test dropdown menu');
    
    // Create a test dropdown
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('test_dropdown')
          .setPlaceholder('Select an option')
          .addOptions([
            {
              label: 'Option 1',
              value: 'option1',
              description: 'This is option 1',
            },
            {
              label: 'Option 2',
              value: 'option2',
              description: 'This is option 2',
            },
            {
              label: 'Option 3',
              value: 'option3',
              description: 'This is option 3',
            },
          ])
      );
    
    await interaction.reply({
      content: 'Please select an option from the dropdown:',
      components: [row],
      ephemeral: true
    });
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log('[DIAGNOSTIC] Bot is connecting to Discord...');
  })
  .catch(error => {
    console.error('[DIAGNOSTIC] Login failed:', error);
  });

// Add graceful shutdown
process.on('SIGINT', async () => {
  console.log('[DIAGNOSTIC] Shutting down...');
  
  // Print interaction statistics
  console.log(`[DIAGNOSTIC] Tracked ${seenInteractions.size} interactions during this session`);
  
  // Exit the process
  client.destroy();
  process.exit(0);
});