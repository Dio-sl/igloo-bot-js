const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Create a ticket panel for users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the panel to')
        .setRequired(true)
    ),
  
  category: 'admin',
  
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    // Ice theme colors
    const IGLOO_BLUE = 0x0CAFFF;  // Bright cyan/blue
    const IGLOO_DARK = 0x0A5C7A;  // Darker blue for elements
    
    // Custom igloo banner image URL - replace with an actual ice/igloo themed image
    const IGLOO_BANNER = 'https://i.imgur.com/pHFs0GE.png'; // Ice-themed banner
    
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
        iconURL: interaction.client.user.displayAvatarURL()
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

    await interaction.reply({
      content: `✅ Ticket panel created in ${channel}`,
      ephemeral: true
    });
  }
};