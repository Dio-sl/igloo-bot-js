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
    
    // Create branded embed
    const panelEmbed = new EmbedBuilder()
      .setTitle('🏔️ Igloo Support System')
      .setDescription(
        '**Welcome to our support system!**\n\n' +
        'Need help? Have a question? Want to report an issue?\n' +
        'Click the button below to create a private support ticket.\n\n' +
        '**What happens next:**\n' +
        '• A private ticket channel will be created\n' +
        '• Our support team will be notified\n' +
        '• You\'ll receive assistance as soon as possible\n\n' +
        '**Ticket Categories:**\n' +
        '🛍️ **General Support** - General questions and help\n' +
        '📦 **Order Issues** - Problems with orders\n' +
        '💳 **Payment Problems** - Billing and payment issues\n' +
        '⚙️ **Technical Support** - Technical difficulties\n' +
        '❓ **Other** - Everything else'
      )
      .setColor(0x5865F2) // Discord blurple
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setImage('https://i.imgur.com/AfFp7pu.png') // Add your banner image URL here
      .setFooter({ 
        text: 'Igloo E-Commerce Bot • Click below to create a ticket',
        iconURL: interaction.client.user.displayAvatarURL()
      });

    // Create button
    const button = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setEmoji('🎫')
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