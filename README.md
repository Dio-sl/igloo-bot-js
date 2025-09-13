# Igloo Discord Bot (JavaScript Version)

Complete E-Commerce Automation for Discord Communities

## Features

- 🎫 **Ticket System**: Create, claim, close, and manage support tickets
- 📊 **Database Integration**: PostgreSQL with full schema management
- 🔐 **Permission System**: Role-based access control
- 📝 **Logging System**: Comprehensive logging with Winston
- ⚡ **JavaScript**: No compilation needed!

## Requirements

- Node.js 18.0.0 or higher
- PostgreSQL 15 or higher
- Discord Bot Token

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/igloo_bot
```

### 3. Setup Database

Create the database in PostgreSQL:

```sql
CREATE DATABASE igloo_bot;
```

### 4. Run the Bot

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

## Commands

- `/help` - Get help with bot commands
- `/ticket` - Create a support ticket

## Project Structure

```
igloo-bot-js/
├── src/
│   ├── commands/        # Bot commands
│   ├── events/          # Discord events
│   ├── database/        # Database connection
│   ├── handlers/        # Command & event handlers
│   └── utils/           # Utilities
├── .env.example         # Example configuration
├── package.json         # Dependencies
└── README.md            # This file
```

## Windows Setup

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
2. Create database using pgAdmin
3. Update `.env` file with your credentials
4. Run `npm install`
5. Run `npm start`

## License

MIT
