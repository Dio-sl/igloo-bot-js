const { Events, ActivityType } = require('discord.js');
const { logger } = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    if (!client.user) return;

    logger.info(`Bot logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);

    // Set bot status
    client.user.setPresence({
      activities: [
        {
          name: 'Support Tickets',
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });

    // Set status rotation
    const activities = [
      { name: 'Support Tickets', type: ActivityType.Watching },
      { name: '/ticket to get help', type: ActivityType.Playing },
      { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
      { name: 'your orders', type: ActivityType.Watching },
    ];

    let currentActivity = 0;
    setInterval(() => {
      const activity = activities[currentActivity];
      client.user.setActivity(activity.name, { type: activity.type });
      currentActivity = (currentActivity + 1) % activities.length;
    }, 30000); // Change every 30 seconds

    logger.info('Bot is ready and operational!');
  }
};
