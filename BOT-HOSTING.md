# Hosting the Discord Bot

This repository now has a root-level `package.json`, so Node.js bot hosting services can install and start it automatically.

## Hosting settings

Use these settings when the host asks for them:

- Runtime: Node.js 20 or newer
- Install command: `npm install`
- Start command: `npm start`
- Repository directory: the repository root

Add this environment variable in the hosting provider's secret/environment settings:

```text
DISCORD_BOT_TOKEN=your Discord bot token
```

Never commit the token to GitHub or put it in `.env` inside the repository.

Optional variables:

- `DISCORD_GUILD_ID` registers commands to one server immediately. Without it, commands are registered globally and may take longer to appear.
- `DISCORD_OWNER_ID` manually sets the owner user ID. Normally the bot detects the Discord application owner automatically.

The bot needs the `applications.commands` scope and `Manage Roles` permission. Its highest Discord role must be above the configured Buyer role.