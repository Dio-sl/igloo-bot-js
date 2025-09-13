const { logger } = require('./logger');

function validateEnv() {
  const requiredEnvVars = [
    { name: 'DISCORD_TOKEN', required: true },
    { name: 'CLIENT_ID', required: true },
    { name: 'DATABASE_URL', required: true },
    { name: 'NODE_ENV', required: false, defaultValue: 'development' },
    { name: 'DEV_GUILD_ID', required: false },
    { name: 'LOG_LEVEL', required: false, defaultValue: 'info' },
    { name: 'OWNER_IDS', required: false },
    { name: 'SUPPORT_SERVER', required: false },
  ];

  const missingVars = [];
  
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    
    if (envVar.required && !value) {
      missingVars.push(envVar.name);
    } else if (!value && envVar.defaultValue) {
      process.env[envVar.name] = envVar.defaultValue;
      logger.info(`Using default value for ${envVar.name}: ${envVar.defaultValue}`);
    }
  }
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please create a .env file with the required variables');
    process.exit(1);
  }
  
  // Validate specific formats
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    logger.error('DATABASE_URL must be a valid PostgreSQL connection string');
    process.exit(1);
  }
  
  if (process.env.OWNER_IDS) {
    const ownerIds = process.env.OWNER_IDS.split(',');
    for (const id of ownerIds) {
      if (!/^\d{17,19}$/.test(id.trim())) {
        logger.error(`Invalid Discord ID in OWNER_IDS: ${id}`);
        process.exit(1);
      }
    }
  }
  
  logger.info('Environment variables validated successfully');
}

function getOwnerIds() {
  if (!process.env.OWNER_IDS) return [];
  return process.env.OWNER_IDS.split(',').map(id => id.trim());
}

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

module.exports = {
  validateEnv,
  getOwnerIds,
  isDevelopment,
  isProduction
};
