import type { AgentId } from "../types.ts";

/** A flat color field for one card. `hi` is only for large type and shapes. */
export interface Field {
  bg: string;
  ink: string;
  hi: string;
}

/** Five fields per agent, so every card gets its own pairing within agents[0]'s family. */
export interface Palette {
  accent: Field;
  deep: Field;
  pale: Field;
  pop: Field;
  pop2: Field;
}

/** Each agent's own color, used for its bar and ring wherever agents appear side by side. */
export const AGENT_COLORS: Record<AgentId, string> = {
  claude: "#d97757",
  codex: "#19c37d",
  opencode: "#2f6bff",
  pi: "#ffb800",
  amp: "#ff3d6e",
  cursor: "#00b8c8",
  grok: "#8b5cff",
};

export const PALETTES: Record<AgentId, Palette> = {
  claude: {
    accent: { bg: "#d97757", ink: "#1f0f0a", hi: "#fff1e2" },
    deep: { bg: "#1f120e", ink: "#f7ebdd", hi: "#e8875f" },
    pale: { bg: "#f4ebdf", ink: "#1f120e", hi: "#c4532f" },
    pop: { bg: "#f6b3c7", ink: "#2a0f14", hi: "#b8432a" },
    pop2: { bg: "#f2c14e", ink: "#2a1608", hi: "#a8381c" },
  },
  codex: {
    accent: { bg: "#19c37d", ink: "#04140c", hi: "#f4fff9" },
    deep: { bg: "#0b0c0c", ink: "#f2f4f2", hi: "#2ee88f" },
    pale: { bg: "#f1f3ef", ink: "#0b0c0c", hi: "#0c9c60" },
    pop: { bg: "#cbff4d", ink: "#0b0c0c", hi: "#0a7a4b" },
    pop2: { bg: "#7f8cff", ink: "#070a1f", hi: "#f4f5ff" },
  },
  opencode: {
    accent: { bg: "#2f6bff", ink: "#ffffff", hi: "#ffd23f" },
    deep: { bg: "#081638", ink: "#eef2ff", hi: "#6d9bff" },
    pale: { bg: "#e8eeff", ink: "#081638", hi: "#2f5ff0" },
    pop: { bg: "#ffd23f", ink: "#081638", hi: "#2449c9" },
    pop2: { bg: "#ff6b5a", ink: "#1a0806", hi: "#fff3ef" },
  },
  pi: {
    accent: { bg: "#ffb800", ink: "#231800", hi: "#fffaf0" },
    deep: { bg: "#1e1600", ink: "#fff3d6", hi: "#ffc533" },
    pale: { bg: "#fff4d6", ink: "#231800", hi: "#d4570f" },
    pop: { bg: "#ff6a3d", ink: "#200a03", hi: "#fff2df" },
    pop2: { bg: "#8f7bff", ink: "#0d0826", hi: "#fff4d6" },
  },
  amp: {
    accent: { bg: "#ff3d6e", ink: "#ffffff", hi: "#ffe14d" },
    deep: { bg: "#2a0614", ink: "#ffe8ee", hi: "#ff5c86" },
    pale: { bg: "#ffe8ee", ink: "#2a0614", hi: "#e0184f" },
    pop: { bg: "#ffb000", ink: "#2a0614", hi: "#c4103f" },
    pop2: { bg: "#3dd6c6", ink: "#03201d", hi: "#ffffff" },
  },
  cursor: {
    accent: { bg: "#00b8c8", ink: "#03181c", hi: "#f0feff" },
    deep: { bg: "#04191d", ink: "#e4fbfd", hi: "#22d6e6" },
    pale: { bg: "#e4f8fa", ink: "#04191d", hi: "#00808c" },
    pop: { bg: "#ff6fae", ink: "#2a0616", hi: "#ffffff" },
    pop2: { bg: "#d6ff4a", ink: "#04191d", hi: "#007a85" },
  },
  // xAI is monochrome, so Grok Build is black and cool white with an electric violet edge.
  grok: {
    accent: { bg: "#8b5cff", ink: "#ffffff", hi: "#0a0a0c" },
    deep: { bg: "#0a0a0c", ink: "#eef0f5", hi: "#a585ff" },
    pale: { bg: "#eef0f5", ink: "#0a0a0c", hi: "#6a3cf0" },
    pop: { bg: "#ffffff", ink: "#0a0a0c", hi: "#6a3cf0" },
    pop2: { bg: "#3df2ff", ink: "#04121a", hi: "#0a0a0c" },
  },
};

/** `color` mixed into `base`, for tracks, rules and quiet shapes. */
export function mix(color: string, base: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}
