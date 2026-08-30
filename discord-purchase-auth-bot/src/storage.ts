import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PanelConfig = {
  title: string;
  description: string;
  buyerRoleId: string | null;
  developerRoleId: string | null;
  script: string;
};

export type BotState = {
  ownerId: string | null;
  whitelist: string[];
  panel: PanelConfig;
};

const defaults: BotState = {
  ownerId: null,
  whitelist: [],
  panel: {
    title: "Buyer Access",
    description:
      "Use the buttons below to manage your access. Only whitelisted users can use these actions.",
    buyerRoleId: null,
    developerRoleId: null,
    script: "YOUR_LOADSTRING_HERE"
  }
};

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data"
);
const stateFile = path.join(dataDir, "bot-config.json");

function normalize(input: Partial<BotState>): BotState {
  const panel = (input.panel ?? {}) as Partial<PanelConfig>;
  return {
    ownerId: typeof input.ownerId === "string" ? input.ownerId : null,
    whitelist: Array.isArray(input.whitelist)
      ? input.whitelist.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
    panel: {
      title: typeof panel.title === "string" ? panel.title : defaults.panel.title,
      description:
        typeof panel.description === "string"
          ? panel.description
          : defaults.panel.description,
      buyerRoleId:
        typeof panel.buyerRoleId === "string" ? panel.buyerRoleId : null,
      developerRoleId:
        typeof panel.developerRoleId === "string"
          ? panel.developerRoleId
          : null,
      script: typeof panel.script === "string" ? panel.script : defaults.panel.script
    }
  };
}

export async function loadState(): Promise<BotState> {
  try {
    return normalize(JSON.parse(await readFile(stateFile, "utf8")) as Partial<BotState>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const state = normalize({});
    await saveState(state);
    return state;
  }
}

export async function saveState(state: BotState): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const tempFile = `${stateFile}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempFile, stateFile);
}