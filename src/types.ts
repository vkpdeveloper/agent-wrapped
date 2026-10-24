// The two shapes everything else is built around:
//   agents/*.ts  read one agent's local history  -> SessionSummary[]
//   stats.ts     folds every summary for a year  -> Wrapped
//   video/*      renders a Wrapped as cards
// wrapped.json is a serialized Wrapped. The skill lets the agent edit
// `persona` and `lessons` in it before rendering, so it is part of the CLI's API.

export type AgentId = "claude" | "codex" | "opencode" | "pi" | "amp" | "cursor" | "grok";

export const AGENT_NAMES: Record<AgentId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  pi: "Pi",
  amp: "Amp",
  cursor: "Cursor",
  grok: "Grok Build",
};

/** One agent session, reduced to what the stats need. */
export interface SessionSummary {
  agent: AgentId;
  id: string;
  /** The agent's own title for the session, or "" if it has none. */
  title: string;
  /** Absolute working directory, or "" if unknown. */
  cwd: string;
  /** Epoch ms of the first and last record. */
  start: number;
  end: number;
  /** Sum of gaps of at most 10 minutes between consecutive records: time actually spent. */
  activeMs: number;
  /** What the person typed, in order. No tool results, system reminders, or injected context. */
  prompts: { at: number; text: string }[];
  /** Model id -> assistant turns that used it. */
  models: Record<string, number>;
  /** Tool kind -> calls. Kinds: shell, edit, read, search, web, task, todo, mcp, or the tool's own lowercased name. */
  tools: Record<string, number>;
  /** Every shell command run, and whether it succeeded. */
  commands: { command: string; ok: boolean }[];
  /** Token totals where the agent records them, otherwise 0. `input` includes cached input. */
  tokens: { input: number; output: number };
  /** Lines added and removed by edit tools, where the agent records diffs, otherwise 0. */
  linesAdded: number;
  linesRemoved: number;
}

export interface Ranked {
  name: string;
  count: number;
}

export interface AgentStat {
  agent: AgentId;
  name: string;
  sessions: number;
  hours: number;
  prompts: number;
  toolCalls: number;
  tokens: number;
  /** Most-used models first. */
  models: Ranked[];
}

export interface Moment {
  /** YYYY-MM-DD, local time. */
  date: string;
  /** HH:MM, local time. */
  time: string;
  agent: AgentId;
  title: string;
  /** Basename of the working directory. */
  project: string;
  hours: number;
}

export interface Wrapped {
  /** Shown on the first card, e.g. "Vaibhav". */
  name: string;
  year: number;
  /** YYYY-MM-DD of the first and last session counted. */
  from: string;
  to: string;
  /** Every agent with at least one session this year, most sessions first. agents[0] sets the video's accent. */
  agents: AgentStat[];
  totals: {
    sessions: number;
    hours: number;
    prompts: number;
    toolCalls: number;
    failedCommands: number;
    tokens: number;
    linesAdded: number;
    linesRemoved: number;
    projects: number;
    activeDays: number;
  };
  /** Top 5 by hours. */
  projects: { name: string; sessions: number; hours: number }[];
  /** Top 6 tool kinds. */
  tools: Ranked[];
  /** Top 5 shell commands, normalized to their first word or two ("bun test", "git status"). */
  commands: Ranked[];
  /** Top 3 commands by failures, normalized the same way. */
  failures: Ranked[];
  /** Active hours per hour of day (0-23) and per weekday (0 = Sunday), local time. */
  byHour: number[];
  byWeekday: number[];
  /** Active hours per month, 0 = January. */
  byMonth: number[];
  longestSession: Moment;
  /** The latest-in-the-night session start between midnight and 5am, if any. */
  lateNight?: Moment;
  busiestDay: { date: string; sessions: number; hours: number };
  /** Longest run of consecutive days with at least one session. */
  streak: { days: number; from: string; to: string };
  corrections: {
    /** Prompts that push back on the agent ("no", "stop", "that's wrong", "I said"). */
    total: number;
    /** Share of all prompts, 0 to 1. */
    rate: number;
    /** Most common opening words of those prompts, e.g. "no", "actually", "don't". */
    phrases: Ranked[];
    /** Up to 150 of them, redacted and clipped to 200 characters, for the agent to read. */
    samples: string[];
  };
  /** Up to 3 rules that would have prevented the most corrections. The skill's agent writes these. */
  lessons: { rule: string; count: number }[];
  persona: { title: string; line: string };
}
