// src/commands/admin/sync.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { logger } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Synchronize settings between setup wizard and commands')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'admin',
  cooldown: 10,

  async execute(interaction, client) {
    // Check permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return await interaction.reply({
        content: '❌ You need Administrator permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Import the sync script
      const { syncWizardAndCommands } = require('../../scripts/sync-wizard-commands');
      
      // Sync settings
      const success = await syncWizardAndCommands(interaction.guild.id);
      
      if (success) {
        // Create success embed
        const syncEmbed = new EmbedBuilder()
          .setColor(0x43b581) // Green color for success
          .setTitle('✅ Settings Synchronized')
          .setDescription('All settings have been successfully synchronized between the setup wizard and commands.')
          .addFields(
            {
              name: 'What was synced',
              value: '• Ticket system settings\n• Shop system settings\n• General bot settings',
            },
            {
              name: 'Next steps',
              value: 'Your bot is now using consistent settings across all features. No further action required.'
            }
          )
          .setFooter({
            text: 'Igloo Bot • Settings Sync',
            iconURL: client.user.displayAvatarURL(),
          })
          .setTimestamp();
        
        await interaction.editReply({
          embeds: [syncEmbed],
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while synchronizing settings. Please check the logs for details.',
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error('Error in sync command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while synchronizing settings. Please try again later.',
        ephemeral: true,
      });
    }
  }
};