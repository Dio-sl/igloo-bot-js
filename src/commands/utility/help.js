const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

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

    if (commandName) {
      // Show specific command help
      const command = client.commands.get(commandName);
      
      if (!command) {
        await interaction.reply({
          content: `Command \`${commandName}\` not found!`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📖 Command: /${command.data.name}`)
        .setDescription(command.data.description)
        .setColor(0x5865F2)
        .addFields(
          { name: 'Category', value: command.category || 'General', inline: true },
          { name: 'Cooldown', value: `${command.cooldown || 3} seconds`, inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      // Show general help
      const embed = new EmbedBuilder()
        .setTitle('🏔️ Igloo Bot Help')
        .setDescription('Igloo is a complete e-commerce automation bot for Discord communities.')
        .setColor(0x5865F2)
        .setThumbnail(client.user?.displayAvatarURL() || '')
        .addFields(
          {
            name: '🎫 Ticket Commands',
            value: '`/ticket` - Create a support ticket\n`/close` - Close current ticket (Coming soon)',
          },
          {
            name: '🛍️ Shop Commands',
            value: '`/shop` - View available products (Coming soon)\n`/order` - View your orders (Coming soon)',
          },
          {
            name: '🔧 Utility Commands',
            value: '`/help` - Show this help menu\n`/ping` - Check bot latency (Coming soon)',
          },
          {
            name: '👮 Admin Commands',
            value: '`/setup` - Configure bot for your server (Coming soon)\n`/panel` - Access admin panel (Coming soon)',
          }
        )
        .addFields(
          {
            name: '📊 Bot Statistics',
            value: `**Servers:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}\n**Uptime:** ${formatUptime(client.uptime || 0)}`,
            inline: true,
          },
          {
            name: '🔗 Quick Links',
            value: '[Support Server](https://discord.gg/your-invite)\n[Documentation](https://docs.igloo.bot)\n[Dashboard](https://igloo.bot)',
            inline: true,
          }
        )
        .setFooter({
          text: 'Igloo Bot • Version 0.1.0 • Phase 1',
          iconURL: client.user?.displayAvatarURL(),
        })
        .setTimestamp();

      // Create action buttons
      const row = new ActionRowBuilder()
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

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  }
};

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
