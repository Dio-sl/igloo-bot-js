const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { db } = require('../../database/Database');
const { logger } = require('../../utils/logger');

// Ice theme colors
const IGLOO_COLORS = {
  PRIMARY: 0x0CAFFF,    // Bright cyan blue - primary color
  SECONDARY: 0x87CEEB,  // Sky blue - secondary color
  SUCCESS: 0x7FFFD4,    // Aquamarine - success indicators
  DANGER: 0xE91E63,     // Pink-ish - danger/warning color
  DARK: 0x0A5C7A,       // Dark blue - background/text color
};

/**
 * Creates a ticket welcome embed with improved layout
 * 
 * @param {Object} ticketData Ticket information
 * @param {Object} client Discord client
 * @returns {Object} The embed and action row
 */
function createTicketWelcomeEmbed(ticketData, client) {
  const { 
    ticketId, 
    userId, 
    category, 
    description = 'No description provided',
    guildIcon = null
  } = ticketData;
  
  // Get category info
  const categoryInfo = getCategoryInfo(category);
  
  // Create a more visually appealing embed
  const welcomeEmbed = new EmbedBuilder()
    .setAuthor({ 
      name: `TICKET: ${ticketId}`, 
      iconURL: guildIcon || client.user.displayAvatarURL() 
    })
    .setTitle(`${categoryInfo.emoji} ${categoryInfo.label} Support`)
    .setDescription(
      `### Welcome <@${userId}>!\n` +
      `Thank you for contacting Igloo Support. Our team will assist you as soon as possible.\n\n` +
      `**Your request:**\n` +
      `${description}\n\n` +
      `Please provide any additional details that might help us assist you better.`
    )
    .setColor(IGLOO_COLORS.PRIMARY)
    .setThumbnail('attachment://category_icon.png') // Will attach a custom category icon
    .addFields([
      {
        name: 'Ticket Information',
        value: 
          `**ID:** \`${ticketId}\`\n` +
          `**Status:** 🔵 Open\n` +
          `**Priority:** Normal\n` +
          `**Created:** <t:${Math.floor(Date.now() / 1000)}:R>`
      }
    ])
    .setFooter({ 
      text: 'Igloo Support System • Respond below to continue', 
      iconURL: client.user.displayAvatarURL() 
    });
  
  // Create action buttons with improved layout
  const actionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Claim')
        .setEmoji('👋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_priority')
        .setLabel('Set Priority')
        .setEmoji('🔼')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

  // Create second row with helpful buttons for the user
  const userActionRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_add_info')
        .setLabel('Add Information')
        .setEmoji('ℹ️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_faq')
        .setLabel('View FAQs')
        .setEmoji('❓')
        .setStyle(ButtonStyle.Secondary)
    );
    
  return { 
    welcomeEmbed, 
    components: [actionRow, userActionRow],
    categoryInfo
  };
}

// Function to get category information and styling
function getCategoryInfo(categoryValue) {
  const categories = {
    'buy': { 
      label: 'Purchase', 
      emoji: '🛒', 
      description: 'Making a purchase',
      color: 0x4CAF50 // Green
    },
    'general': { 
      label: 'General Support', 
      emoji: '📞', 
      description: 'General questions and help',
      color: 0x2196F3 // Blue
    },
    'order': { 
      label: 'Order Issues', 
      emoji: '📦', 
      description: 'Problems with orders',
      color: 0xFF9800 // Orange
    },
    'technical': { 
      label: 'Technical Support', 
      emoji: '⚙️', 
      description: 'Technical difficulties',
      color: 0x9C27B0 // Purple
    }
  };
  
  return categories[categoryValue] || categories['general'];
}

// Example usage in your ticket creation code:
/*
// In your ticket creation function:
const { welcomeEmbed, components, categoryInfo } = createTicketWelcomeEmbed({
  ticketId: 'TICKET-0001',
  userId: interaction.user.id,
  category: ticketCategory,
  description: description,
  guildIcon: interaction.guild.iconURL({ dynamic: true })
}, client);

// Generate a category icon image using canvas (similar to banner generation)
const categoryIconBuffer = await generateCategoryIcon(categoryInfo);
const attachment = new AttachmentBuilder(categoryIconBuffer, { name: 'category_icon.png' });

// Send welcome message to ticket channel
await ticketChannel.send({
  content: config.support_role_id ? `<@&${config.support_role_id}>` : undefined,
  embeds: [welcomeEmbed],
  components: components,
  files: [attachment]
});
*/

// This would be implemented in your utils directory
async function generateCategoryIcon(categoryInfo) {
  const { createCanvas } = require('canvas');
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  
  // Draw circular background
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  
  // Use the category color with a gradient
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
  gradient.addColorStop(0, '#FFFFFF');
  
  // Convert hex color to RGB for the gradient
  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.toString(16), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  };
  
  const rgbColor = hexToRgb(categoryInfo.color);
  gradient.addColorStop(1, `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.8)`);
  
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw category emoji (simplified - in actual implementation you'd use an image)
  ctx.font = '120px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(categoryInfo.emoji, 128, 128);
  
  // Add a border
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Add ice/snow effect
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = Math.random() * 4 + 1;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  return canvas.toBuffer('image/png');
}

module.exports = {
  createTicketWelcomeEmbed,
  generateCategoryIcon,
  getCategoryInfo
};