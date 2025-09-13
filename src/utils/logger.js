const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log colors
const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[34m',
  debug: '\x1b[35m',
  reset: '\x1b[0m',
  gray: '\x1b[90m'
};

// Custom console format
const consoleFormat = winston.format.printf((info) => {
  const timestamp = info.timestamp ? info.timestamp.slice(0, 19).replace('T', ' ') : '';
  const level = info.level || 'info';
  const message = info.message || '';
  
  const colorCode = colors[level] || colors.info;
  const coloredLevel = `${colorCode}${level.toUpperCase()}${colors.reset}`;
  
  return `${colors.gray}${timestamp}${colors.reset} [${coloredLevel}]: ${message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        consoleFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

module.exports = { logger };
