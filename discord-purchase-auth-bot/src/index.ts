import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import { loadState, saveState, type BotState } from "./storage.js";

const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

const buttonIds = {
  script: "purchase-auth:get-script",
  role: "purchase-auth:get-role",
  reset: "purchase-auth:reset-hwid"
} as const;

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the purchase access panel (owner only).")
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName("title").setDescription("Panel title.").setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Panel description.")
        .setMaxLength(4000)
    )
    .addRoleOption((option) =>
      option.setName("buyer_role").setDescription("Role granted by Get Role.")
    )
    .addRoleOption((option) =>
      option
        .setName("developer_role")
        .setDescription("Role allowed to manage the whitelist.")
    )
    .addStringOption((option) =>
      option
        .setName("script")
        .setDescription("Loadstring sent privately by Get Script.")
        .setMaxLength(6000)
    ),
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a configured panel.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("panel")
        .setDescription("Send the purchase access panel in this channel.")
    ),
  new SlashCommandBuilder()
    .setName("whitelist")
    .setDescription("Manage users allowed to use the panel.")
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Whitelist a user.")
        .addUserOption((option) =>
          option.setName("user").setDescription("User to whitelist.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a user from the whitelist.")
        .addUserOption((option) =>
          option.setName("user").setDescription("User to remove.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("Show the current whitelist.")
    )
].map((command) => command.toJSON());

function isOwner(interaction: ChatInputCommandInteraction, state: BotState) {
  const configuredOwner = process.env.DISCORD_OWNER_ID?.trim();
  return (
    interaction.user.id === configuredOwner ||
    (state.ownerId !== null && interaction.user.id === state.ownerId)
  );
}

function hasDeveloperRole(
  interaction: ChatInputCommandInteraction,
  state: BotState
) {
  const roleId = state.panel.developerRoleId;
  if (!roleId || !interaction.member) return false;
  const roles = interaction.member.roles;
  return Array.isArray(roles) ? roles.includes(roleId) : roles.cache.has(roleId);
}

function panelMessage(state: BotState) {
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(state.panel.title)
    .setDescription(state.panel.description)
    .setFooter({ text: "Private access • Whitelisted users only" });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonIds.script)
      .setLabel("Get Script")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(buttonIds.role)
      .setLabel("Get Role")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buttonIds.reset)
      .setLabel("Reset HWID")
      .setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row] };
}

async function setup(
  interaction: ChatInputCommandInteraction,
  state: BotState
) {
  if (!isOwner(interaction, state)) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      ephemeral: true
    });
    return;
  }

  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const buyerRole = interaction.options.getRole("buyer_role");
  const developerRole = interaction.options.getRole("developer_role");
  const script = interaction.options.getString("script");

  if (
    title === null &&
    description === null &&
    buyerRole === null &&
    developerRole === null &&
    script === null
  ) {
    await interaction.reply({
      content: "Provide at least one option in `/setup` to make a change.",
      ephemeral: true
    });
    return;
  }

  if (title !== null) state.panel.title = title;
  if (description !== null) state.panel.description = description;
  if (buyerRole !== null) state.panel.buyerRoleId = buyerRole.id;
  if (developerRole !== null) state.panel.developerRoleId = developerRole.id;
  if (script !== null) state.panel.script = script;
  await saveState(state);
  await interaction.reply({
    content: "Settings saved. Use `/send panel` to post the updated panel.",
    ephemeral: true
  });
}

async function sendPanel(
  interaction: ChatInputCommandInteraction,
  state: BotState
) {
  if (!isOwner(interaction, state)) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      ephemeral: true
    });
    return;
  }
  if (!interaction.channel?.isSendable()) {
    await interaction.reply({
      content: "I cannot send a panel in this channel.",
      ephemeral: true
    });
    return;
  }
  await interaction.channel.send(panelMessage(state));
  await interaction.reply({ content: "Panel sent.", ephemeral: true });
}

async function whitelist(
  interaction: ChatInputCommandInteraction,
  state: BotState
) {
  if (!isOwner(interaction, state) && !hasDeveloperRole(interaction, state)) {
    await interaction.reply({
      content: "Only the bot owner or configured developer role can use this command.",
      ephemeral: true
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "list") {
    const users =
      state.whitelist.length === 0
        ? "No users are currently whitelisted."
        : state.whitelist.map((id) => `<@${id}>`).join("\n");
    await interaction.reply({
      content: `Whitelisted users (${state.whitelist.length}):\n${users}`,
      ephemeral: true
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  if (subcommand === "add") {
    if (!state.whitelist.includes(user.id)) {
      state.whitelist.push(user.id);
      await saveState(state);
    }
    await interaction.reply({ content: `${user} is whitelisted.`, ephemeral: true });
    return;
  }

  state.whitelist = state.whitelist.filter((id) => id !== user.id);
  await saveState(state);
  await interaction.reply({
    content: `${user} was removed from the whitelist.`,
    ephemeral: true
  });
}

async function button(interaction: ButtonInteraction, state: BotState) {
  if (!state.whitelist.includes(interaction.user.id)) {
    await interaction.reply({
      content: "You are not whitelisted to use this panel.",
      ephemeral: true
    });
    return;
  }

  if (interaction.customId === buttonIds.reset) {
    await interaction.reply({ content: "ERROR 609, INVALID KEY", ephemeral: true });
    return;
  }

  if (interaction.customId === buttonIds.role) {
    if (!state.panel.buyerRoleId || !interaction.guild) {
      await interaction.reply({
        content: "The Buyer role is not configured. Ask the owner to run `/setup`.",
        ephemeral: true
      });
      return;
    }
    const role = await interaction.guild.roles.fetch(state.panel.buyerRoleId);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const botMember = interaction.guild.members.me;
    if (!role) {
      await interaction.reply({
        content: "The configured Buyer role no longer exists.",
        ephemeral: true
      });
      return;
    }
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: "I need the Manage Roles permission to grant the Buyer role.",
        ephemeral: true
      });
      return;
    }
    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: "My highest role must be above the configured Buyer role.",
        ephemeral: true
      });
      return;
    }
    await member.roles.add(role, "Whitelisted user requested Buyer access");
    await interaction.reply({
      content: `You now have the ${role} role.`,
      ephemeral: true
    });
    return;
  }

  if (
    state.panel.script.trim() === "" ||
    state.panel.script === "YOUR_LOADSTRING_HERE"
  ) {
    await interaction.reply({
      content:
        "The script is not configured yet. Ask the owner to add it with `/setup script`.",
      ephemeral: true
    });
    return;
  }
  if (state.panel.script.length <= 1900) {
    await interaction.reply({ content: state.panel.script, ephemeral: true });
    return;
  }
  await interaction.reply({
    content: "Your script is attached privately as a text file.",
    files: [
      {
        attachment: Buffer.from(state.panel.script, "utf8"),
        name: "loadstring.txt"
      }
    ],
    ephemeral: true
  });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (readyClient) => {
  try {
    const application = await readyClient.application.fetch();
    const state = await loadState();
    if (!process.env.DISCORD_OWNER_ID?.trim() && application.owner) {
      state.ownerId = application.owner.id;
      await saveState(state);
    }
    const rest = new REST({ version: "10" }).setToken(token);
    const guildId = process.env.DISCORD_GUILD_ID?.trim();
    const route = guildId
      ? Routes.applicationGuildCommands(readyClient.user.id, guildId)
      : Routes.applicationCommands(readyClient.user.id);
    await rest.put(route, { body: commands });
    console.info(
      `Discord bot online as ${readyClient.user.tag} (${guildId ? "guild" : "global"} commands).`
    );
  } catch (error) {
    console.error("Discord bot startup configuration failed:", error);
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  void (async () => {
    const state = await loadState();
    if (interaction.isButton()) {
      await button(interaction, state);
    } else if (interaction.commandName === "setup") {
      await setup(interaction, state);
    } else if (
      interaction.commandName === "send" &&
      interaction.options.getSubcommand() === "panel"
    ) {
      await sendPanel(interaction, state);
    } else if (interaction.commandName === "whitelist") {
      await whitelist(interaction, state);
    }
  })().catch(async (error) => {
    console.error("Discord interaction failed:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Something went wrong while handling that request.",
        ephemeral: true
      });
    }
  });
});

void client.login(token);