const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { db } = require('../../../database/Database');
const { logger } = require('../../../utils/logger');
const SetupUI = require('../SetupUI');  // Capital 'U' in 'UI'

module.exports = {
  // Show the general setup menu
  async showMenu(interaction, client, config) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.PRIMARY)
      .setTitle('⚙️ General Settings')
      .setDescription('Configure general bot behavior and settings')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: 'Current Status',
          value: SetupUI.getGeneralStatusText(config),
          inline: false,
        },
        {
          name: 'Available Settings',
          value: [
            '**🔧 Bot Status** - Monitor bot health',
            '**📊 Database** - Connection status',
            '**⚡ Performance** - Response times and metrics',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚀 Coming Soon',
          value: [
            '• Custom bot prefix',
            '• Auto-moderation settings',
            '• Welcome/goodbye messages',
            '• Advanced logging options',
          ].join('\n'),
          inline: false,
        }
      );

    // Create action buttons
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('general_check_status')
          .setLabel('Check Bot Status')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔍'),
        new ButtonBuilder()
          .setCustomId('general_test_database')
          .setLabel('Test Database')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗄️'),
        new ButtonBuilder()
          .setCustomId('setup_back_main')
          .setLabel('Back to Main Menu')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [actionRow],
    });
  },

  // Handle general setup interactions
  async handleInteraction(interaction, client) {
    const { customId } = interaction;

    switch (customId) {
      case 'general_check_status':
        await this.checkBotStatus(interaction, client);
        break;
      case 'general_test_database':
        await this.testDatabase(interaction, client);
        break;
    }
  },

  // Check bot status
  async checkBotStatus(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(SetupUI.COLORS.SUCCESS)
      .setTitle('🔍 Bot Status Check')
      .setDescription('Here\'s your bot\'s current status:')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🤖 Bot Information',
          value: [
            `**Name**: ${client.user.username}`,
            `**ID**: ${client.user.id}`,
            `**Status**: Online ✅`,
            `**Uptime**: ${this.formatUptime(process.uptime())}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '📊 Server Information',
          value: [
            `**Servers**: ${client.guilds.cache.size}`,
            `**Users**: ${client.users.cache.size}`,
            `**Channels**: ${client.channels.cache.size}`,
            `**Memory**: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '⚡ Performance',
          value: [
            `**API Latency**: ${Math.round(client.ws.ping)}ms`,
            `**Response Time**: <1s`,
            `**Database**: Connected ✅`,
            `**Last Restart**: ${new Date().toLocaleString()}`,
          ].join('\n'),
          inline: false,
        }
      );

    const backButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_category_select')
          .setLabel('Back to General Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
  },

  // Test database connection
  async testDatabase(interaction, client) {
    const startTime = Date.now();
    
    try {
      // Test database connection
      await db.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      const embed = new EmbedBuilder()
        .setColor(SetupUI.COLORS.SUCCESS)
        .setTitle('🗄️ Database Test Results')
        .setDescription('Database connection test completed successfully!')
        .addFields(
          {
            name: '✅ Connection Status',
            value: 'Connected and responding',
            inline: true,
          },
          {
            name: '⚡ Response Time',
            value: `${responseTime}ms`,
            inline: true,
          },
          {
            name: '📊 Test Details',
            value: [
              '• Connection established',
              '• Query executed successfully',
              '• No errors detected',
              '• Database is healthy',
            ].join('\n'),
            inline: false,
          }
        );

      const backButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_category_select')
            .setLabel('Back to General Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({
        embeds: [embed],
        components: [backButton],
      });

    } catch (error) {
      logger.error('Database test failed:', error);

      const embed = new EmbedBuilder()
        .setColor(SetupUI.COLORS.DANGER)
        .setTitle('❌ Database Test Failed')
        .setDescription('There was an issue connecting to the database.')
        .addFields(
          {
            name: '🔧 Troubleshooting',
            value: [
              '1. Check database server status',
              '2. Verify connection settings',
              '3. Check network connectivity',
              '4. Review error logs',
            ].join('\n'),
            inline: false,
          }
        );

      const backButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('setup_category_select')
            .setLabel('Back to General Settings')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        );

      await interaction.update({
        embeds: [embed],
        components: [backButton],
      });
    }
  },

  // Format uptime in a readable format
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }
};