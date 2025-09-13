// MODIFICATION FOR YOUR create.js FILE
// This is the part you need to change in your /ticket command

// Inside your execute function, replace the welcomeEmbed creation with this:

// CATEGORY COLORS - ADD THESE NEAR THE TOP OF YOUR FILE
const CATEGORY_COLORS = {
  'Buy': 0x4CAF50,           // Green
  'General Support': 0x2196F3, // Blue
  'Order Issues': 0xFF9800,    // Orange
  'Technical Support': 0x9C27B0 // Purple
};

// Then in your execute function, replace the welcomeEmbed creation:

// Get category info
const categoryInfo = getCategoryInfo(ticketCategory);
const categoryColor = CATEGORY_COLORS[categoryInfo.label] || IGLOO_COLORS.PRIMARY;

// Create IMPROVED welcome embed
const timestamp = Math.floor(Date.now() / 1000);
const welcomeEmbed = new EmbedBuilder()
  .setAuthor({ 
    name: ticketId, 
    iconURL: client.user.displayAvatarURL() 
  })
  .setTitle(`${categoryInfo.emoji} ${categoryInfo.label} Support`)
  .setDescription(
    config.welcome_message || 
    `Thank you for creating a ticket! Our support team will be with you shortly.\n\n` +
    `Please provide any additional details that might help us assist you better.`
  )
  .setColor(categoryColor)
  .addFields([
    {
      name: 'Ticket Information',
      value: 
        `**Category:** ${categoryInfo.label}\n` +
        `**Created by:** <@${userId}>\n` +
        `**Status:** 🔵 Open\n` +
        `**Created:** <t:${timestamp}:R>`
    },
    {
      name: 'Description',
      value: description
    }
  ])
  .setFooter({ 
    text: 'Igloo Support System',
    iconURL: client.user.displayAvatarURL() 
  })
  .setTimestamp();

// If you don't already have a getCategoryInfo function, add this:
function getCategoryInfo(categoryValue) {
  const categories = {
    'buy': { 
      label: 'Buy', 
      emoji: '🛒', 
      description: 'Click for making a purchase'
    },
    'general': { 
      label: 'General Support', 
      emoji: '📞', 
      description: 'General questions and help'
    },
    'order': { 
      label: 'Order Issues', 
      emoji: '📦', 
      description: 'Problems with orders'
    },
    'technical': { 
      label: 'Technical Support', 
      emoji: '⚙️', 
      description: 'Technical difficulties'
    }
  };
  
  return categories[categoryValue] || categories['general'];
}