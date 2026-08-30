# Discord Purchase Auth Bot

This is a standalone export of the purchase/authentication Discord bot.

## Setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set the bot token as an environment variable. Do not put it in this folder:

   ```bash
   export DISCORD_BOT_TOKEN="your-token-here"
   ```

4. Start the bot:

   ```bash
   npm start
   ```

## Optional environment variables

- `DISCORD_OWNER_ID` — manually set the owner user ID. If omitted, the bot detects the Discord application owner automatically.
- `DISCORD_GUILD_ID` — register commands to one server immediately. If omitted, commands are registered globally and may take longer to appear.

## Commands

- `/setup` — owner-only configuration for the title, description, Buyer role, developer role, and loadstring.
- `/send panel` — owner-only command that posts the panel.
- `/whitelist add @user` — owner or configured developer role.
- `/whitelist remove @user` — owner or configured developer role.
- `/whitelist list` — owner or configured developer role.

Only whitelisted users can use the panel buttons. `Get Script` replies privately, `Get Role` grants the configured Buyer role, and `Reset HWID` replies privately with `ERROR 609, INVALID KEY`.

The bot needs the `applications.commands` scope and `Manage Roles` permission. Its highest role must be above the configured Buyer role.

The whitelist and panel settings are stored locally in `data/bot-config.json`. The bot token is never stored in this folder.