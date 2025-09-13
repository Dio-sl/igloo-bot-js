const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { logger } = require('../utils/logger');

async function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  
  // Check if commands directory exists
  if (!fs.existsSync(commandsPath)) {
    logger.warn('Commands directory not found');
    return;
  }

  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    
    // Skip if not a directory
    if (!fs.statSync(folderPath).isDirectory()) continue;
    
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        logger.info(`Loaded command: ${command.data.name}`);
      } else {
        logger.warn(`Invalid command file: ${file}`);
      }
    }
  }

  // Deploy commands
  await deployCommands(client, commands);
  
  logger.info(`Loaded ${client.commands.size} commands`);
}

async function deployCommands(client, commands) {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    logger.info('Deploying slash commands...');

    if (process.env.NODE_ENV === 'development' && process.env.DEV_GUILD_ID) {
      // Deploy to specific guild in development
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID),
        { body: commands }
      );
      logger.info(`Deployed ${commands.length} commands to dev guild`);
    } else {
      // Deploy globally in production
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      logger.info(`Deployed ${commands.length} commands globally`);
    }
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
}

module.exports = { loadCommands };
