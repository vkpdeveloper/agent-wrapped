import { basename } from "node:path";
import { redactDeep } from "./redact.ts";
import { AGENT_NAMES, type AgentId, type AgentStat, type Moment, type Quote, type Ranked, type SessionSummary, type Wrapped } from "./types.ts";

const HOUR = 3_600_000;

export function wrap(all: SessionSummary[], options: { year: number; name: string; home: string }): Wrapped {
  const { year, name, home } = options;
  const sessions = all.filter((session) => new Date(session.start).getFullYear() === year).sort((a, b) => a.start - b.start);
  const prompts = sessions.flatMap((session) => session.prompts);
  const commands = sessions.flatMap((session) => session.commands);

  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const byMonth = new Array<number>(12).fill(0);
  for (const session of sessions) {
    // Active time is spread over the session's prompts: they mark when the person was there.
    const times = session.prompts.length ? session.prompts.map((prompt) => prompt.at) : [session.start];
    const share = session.activeMs / HOUR / times.length;
    for (const at of times) {
      // A session that runs past New Year's Eve still counts toward the year it started in.
      const date = new Date(new Date(at).getFullYear() === year ? at : session.start);
      byHour[date.getHours()]! += share;
      byWeekday[date.getDay()]! += share;
      byMonth[date.getMonth()]! += share;
    }
  }

  const days = new Map<string, { sessions: number; ms: number }>();
  for (const session of sessions) {
    const day = days.get(localDate(session.start)) ?? { sessions: 0, ms: 0 };
    days.set(localDate(session.start), { sessions: day.sessions + 1, ms: day.ms + session.activeMs });
  }

  const projects = new Map<string, { sessions: number; ms: number }>();
  for (const session of sessions) {
    const project = projectName(session.cwd, home);
    if (!project) continue;
    const entry = projects.get(project) ?? { sessions: 0, ms: 0 };
    projects.set(project, { sessions: entry.sessions + 1, ms: entry.ms + session.activeMs });
  }

  const tools: Record<string, number> = {};
  for (const session of sessions) {
    for (const [kind, calls] of Object.entries(session.tools)) tools[kind] = (tools[kind] ?? 0) + calls;
  }

  // A session's first prompt has nothing to push back on yet.
  const corrections = sessions.flatMap((session) => session.prompts.slice(1).map((prompt) => prompt.text).filter(isCorrection));
  const normalized = commands.map((command) => normalizeCommand(command.command));
  const failed = commands.filter((command) => !command.ok);
  const totalMs = sum(sessions, (session) => session.activeMs);
  const agents = agentStats(sessions);
  const busiest = [...days].sort(([, a], [, b]) => b.ms - a.ms || b.sessions - a.sessions)[0];
  const longest = sessions.reduce<SessionSummary | undefined>((best, session) => (!best || session.activeMs > best.activeMs ? session : best), undefined);
  const lateNight = sessions
    .filter((session) => new Date(session.start).getHours() < 5)
    .sort((a, b) => minuteOfDay(b.start) - minuteOfDay(a.start))[0];

  const totals = {
    sessions: sessions.length,
    hours: hours(totalMs),
    prompts: prompts.length,
    toolCalls: sum(Object.values(tools), (calls) => calls),
    failedCommands: failed.length,
    tokens: sum(sessions, (session) => session.tokens.input + session.tokens.output),
    linesAdded: sum(sessions, (session) => session.linesAdded),
    linesRemoved: sum(sessions, (session) => session.linesRemoved),
    projects: projects.size,
    activeDays: days.size,
  };

  const wrapped: Wrapped = {
    name,
    year,
    from: sessions[0] ? localDate(sessions[0].start) : "",
    to: sessions.length ? localDate(sessions[sessions.length - 1]!.start) : "",
    agents,
    totals,
    projects: [...projects]
      .sort(([, a], [, b]) => b.ms - a.ms || b.sessions - a.sessions)
      .slice(0, 5)
      .map(([project, entry]) => ({ name: project, sessions: entry.sessions, hours: hours(entry.ms) })),
    tools: rank(Object.entries(tools)).slice(0, 6),
    commands: tally(normalized).slice(0, 5),
    failures: tally(failed.map((command) => normalizeCommand(command.command))).slice(0, 3),
    byHour: byHour.map(round1),
    byWeekday: byWeekday.map(round1),
    byMonth: byMonth.map(round1),
    longestSession: longest ? moment(longest, home) : { date: "", time: "", agent: "claude", title: "", project: "", hours: 0 },
    lateNight: lateNight && moment(lateNight, home),
    busiestDay: busiest ? { date: busiest[0], sessions: busiest[1].sessions, hours: hours(busiest[1].ms) } : { date: "", sessions: 0, hours: 0 },
    streak: longestStreak([...days.keys()]),
    corrections: {
      total: corrections.length,
      rate: prompts.length ? Math.round((corrections.length / prompts.length) * 1000) / 1000 : 0,
      phrases: tally(corrections.map(openingWords)).slice(0, 5),
      samples: samples(corrections.slice(-150), prompts, home),
    },
    promptSamples: promptSamples(sessions, prompts, home),
    quotes: { title: "", lines: [] },
    lessons: [],
    persona: { title: "", line: "" },
  };
  return { ...wrapped, persona: persona(wrapped, normalized) };
}

function agentStats(sessions: SessionSummary[]): AgentStat[] {
  const byAgent = new Map<AgentId, SessionSummary[]>();
  for (const session of sessions) {
    const list = byAgent.get(session.agent);
    if (list) list.push(session);
    else byAgent.set(session.agent, [session]);
  }
  return [...byAgent]
    .map(([agent, list]): AgentStat & { ms: number } => {
      const models: Record<string, number> = {};
      for (const session of list) {
        for (const [model, turns] of Object.entries(session.models)) models[model] = (models[model] ?? 0) + turns;
      }
      const ms = sum(list, (session) => session.activeMs);
      return {
        agent,
        name: AGENT_NAMES[agent],
        sessions: list.length,
        hours: hours(ms),
        prompts: sum(list, (session) => session.prompts.length),
        toolCalls: sum(list, (session) => sum(Object.values(session.tools), (calls) => calls)),
        tokens: sum(list, (session) => session.tokens.input + session.tokens.output),
        models: rank(Object.entries(models)),
        ms,
      };
    })
    .sort((a, b) => b.sessions - a.sessions || b.ms - a.ms)
    .map(({ ms: _, ...stat }) => stat);
}

/**
 * Basename of the working directory, or "" for none and for the home directory
 * itself. Worktrees that agent apps create in their own folders are named after
 * the repository rather than the random worktree id.
 */
export function projectName(cwd: string, home: string): string {
  const path = cwd.replace(/\/+$/, "");
  // Other machines' sessions arrive with their home as ~. T3 Code's scratch threads have no project.
  if (!path || path === "~" || path === home.replace(/\/+$/, "") || /\/\.t3\/scratch(\/|$)/.test(path)) return "";
  const worktree =
    /\/\.t3\/worktrees\/([^/]+)\//.exec(path) ??
    /\/\.codex\/worktrees\/[^/]+\/([^/]+)/.exec(path) ??
    /\/([^/]+)\/\.claude\/worktrees\//.exec(path);
  return worktree?.[1] ?? basename(path);
}

// Tools whose second word says what actually ran ("git status", "bun test").
const MULTI_WORD = new Set(
  "git bun bunx npm npx pnpm pnpx yarn cargo go docker kubectl gh uv uvx pip pip3 brew deno make swift xcrun".split(" "),
);
// Package-manager scripts read better with the script name: "bun run build".
const RUNNERS = new Set(["bun", "npm", "pnpm", "yarn", "uv", "deno"]);
// Flags that take a value, so the value is not mistaken for the subcommand ("git -C dir status").
const VALUE_FLAGS = new Set(["-C", "-c", "--cwd", "--prefix", "--dir", "--filter", "--manifest-path", "-f", "--file", "-w", "--workspace"]);
const PREFIXES = new Set(["sudo", "env", "time", "command", "exec", "nohup", "caffeinate"]);

/** First word of a shell command, or two or three for well-known tools: "git status", "bun run dev", "python -m pytest". */
export function normalizeCommand(command: string): string {
  // The first segment that does real work: skip `cd x &&`, exports and shell options.
  const segments = command.split(/\n|&&|\|\||;/).map((segment) => segment.trim());
  const segment = segments.find((part) => part && !/^(cd|pushd|export|set|source|\.|#)(\s|$)/.test(part)) ?? "";
  const words = segment.split(/\s+/).filter(Boolean);
  while (words.length && (PREFIXES.has(words[0]!) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]!) || words[0]!.startsWith("-"))) {
    words.shift();
  }
  const first = basename(words[0]?.replace(/^["'(]+|["')]+$/g, "") ?? "");
  if (!first) return "";
  if (/^python[\d.]*$/.test(first)) return words[1] === "-m" && words[2] ? `python -m ${words[2]}` : "python";
  if (!MULTI_WORD.has(first)) return first;

  const rest: string[] = [];
  for (let i = 1; i < words.length && rest.length < 2; i++) {
    const word = words[i]!;
    if (VALUE_FLAGS.has(word)) i++;
    else if (word.startsWith("-") || /[|<>]/.test(word)) continue;
    else rest.push(word);
  }
  const [sub, script] = rest;
  if (!sub) return first;
  if (sub === "run" && RUNNERS.has(first) && script) return `${first} run ${script}`;
  return `${first} ${sub}`;
}

// Corrections, tuned against real prompts. Openers must start the prompt (after
// filler like "bro," or "ok so"); the second list can appear anywhere. Both need
// a word boundary, so "now" or "nothing" do not count as "no".
const OPENERS = [
  "no", "nope", "nah", "not", "wait", "hold on", "don't", "dont", "do not", "wrong", "undo", "revert",
  "that's not", "thats not", "that is not", "this is not", "this isn't", "it's not", "why not", "why did you",
  "why are you", "why would you", "why is it not", "i said", "i told you", "i asked", "i meant", "i wanted",
  "i didn't ask", "you didn't", "you did not", "you just", "you missed", "you forgot", "you broke", "you removed",
  "still", "again", "ugh",
];
const ANYWHERE = [
  "you didn't", "you did not", "that's wrong", "that is wrong", "i told you", "i already told you", "i said",
  "i meant", "i wanted you to", "you broke", "you removed", "why did you", "why would you", "please don't",
  "not what i (asked|wanted|said|meant)", "stop (it|that|doing|adding|using|changing)",
  "(not|isn't|doesn't|didn't|did not|does not) (work|working|visible|showing|loading|rendering|fixed)",
  "still (not|broken|failing|wrong|doesn't|isn't|the same|there|happening|seeing)", "(is|keeps) crashing",
  ", not(?! too)", "wtf", "wth", "fuck", "fucking", "bs", "sucks", "dumb", "stupid", "garbage", "useless",
];
const FILLER = /^((ok(ay)?|bro|dude|man|umm+|hmm+|uh+|oh|see|so|yeah|well|hey)\b[\s,.!]*)+/i;
const words = (list: string[]) => list.join("|").replace(/'/g, "['’]");
const OPENER = new RegExp(`^(${words(OPENERS)})\\b`, "i");
// "actually" and "instead" open plenty of ordinary follow-ups, so they only count when they redirect.
const REDIRECT = /^(actually|instead)\b[\s,]*(no|don't|do not|not|revert|undo|i (said|meant|want|asked)|we (should|need)|use|let's|just)\b/i;
const PUSHBACK = new RegExp(`\\b(${words(ANYWHERE)})\\b`, "i");

/** Whether a prompt pushes back on what the agent just did. */
export function isCorrection(prompt: string): boolean {
  const text = prompt.trim().replace(FILLER, "");
  return OPENER.test(text) || REDIRECT.test(text) || PUSHBACK.test(text);
}

/** The pushback words a correction leads with: "No, use bun" -> "no", "Bro, don't" -> "don't", "it's still broken" -> "still broken". */
function openingWords(prompt: string): string {
  const text = prompt.trim().replace(FILLER, "").toLowerCase().replace(/’/g, "'");
  const phrase = OPENER.exec(text)?.[1] ?? REDIRECT.exec(text)?.[1] ?? PUSHBACK.exec(text)?.[1] ?? "";
  return phrase === "dont" ? "don't" : phrase.replace(/^[\s,]+/, "");
}

function persona(wrapped: Wrapped, commands: string[]): Wrapped["persona"] {
  const { totals } = wrapped;
  const night = sum(wrapped.byHour.slice(0, 5), (h) => h);
  const weekend = (wrapped.byWeekday[0] ?? 0) + (wrapped.byWeekday[6] ?? 0);
  const perPrompt = totals.prompts ? totals.toolCalls / totals.prompts : 0;
  const tests = commands.filter((command) => /\b(test|pytest|vitest|jest|playwright)\b/.test(command)).length;
  const meaningful = wrapped.agents.filter((agent) => agent.sessions >= Math.max(3, totals.sessions * 0.1));
  const share = (part: number, whole: number) => (whole ? part / whole : 0);
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  // Each candidate scores how far past its threshold the year went; the biggest overshoot wins.
  const candidates = [
    {
      score: share(night, totals.hours) / 0.2,
      title: "The Night Shipper",
      line: `${pct(share(night, totals.hours))} of your agent hours happened between midnight and 5am.`,
    },
    {
      score: share(weekend, totals.hours) / 0.4,
      title: "The Weekend Warrior",
      line: `${pct(share(weekend, totals.hours))} of your agent hours happened on weekends.`,
    },
    {
      score: wrapped.corrections.rate / 0.15,
      title: "The Micromanager",
      line: `You pushed back on ${pct(wrapped.corrections.rate)} of your prompts.`,
    },
    {
      score: perPrompt / 30,
      title: "The Delegator",
      line: `Your agents ran ${Math.round(perPrompt)} tool calls for every prompt you typed.`,
    },
    {
      score: wrapped.longestSession.hours / 6,
      title: "The Marathoner",
      line: `Your longest session ran ${wrapped.longestSession.hours} hours.`,
    },
    {
      score: meaningful.length / 3,
      title: "The Polyglot",
      line: `You split your year across ${meaningful.length} agents.`,
    },
    {
      score: commands.length >= 20 ? share(tests, commands.length) / 0.2 : 0,
      title: "The Test Runner",
      line: `${pct(share(tests, commands.length))} of your shell commands ran tests.`,
    },
  ];
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 1) return { title: best.title, line: best.line };
  return {
    title: "The Builder",
    line: `You typed ${totals.prompts.toLocaleString("en-US")} prompts across ${totals.projects} projects.`,
  };
}

/** Redacted, single-line and without attachment markers, which carry no meaning for the reader. */
/** Clipped, masked samples. Masked with every prompt, so a password given away in one masks it in all. */
function samples(texts: string[], prompts: { text: string }[], home: string): string[] {
  const bare = texts.map((text) => text.replace(/\[(Attached image|Image)[^\]]*\]/g, "").replace(/\s+/g, " ").trim());
  return redactDeep({ bare, all: prompts.map((prompt) => prompt.text) }, home).bare.map((text) => clip(text, 200));
}

/**
 * Prompts short enough to quote, spread evenly over the year so every month gets a say.
 * Pastes, slash commands and injected context are skipped: they are not the person's voice.
 */
function promptSamples(sessions: SessionSummary[], prompts: { text: string }[], home: string, limit = 200): Quote[] {
  const seen = new Set<string>();
  const candidates = sessions
    .flatMap((session) => session.prompts.map((prompt) => ({ ...prompt, agent: session.agent })))
    .filter(({ text }) => {
      const line = text.replace(/\s+/g, " ").trim();
      const key = line.toLowerCase();
      if (line.length < 12 || line.length > 240 || /^[</]/.test(line) || text.includes("```") || text.split("\n").length > 4 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.at - b.at);
  const step = Math.max(1, candidates.length / limit);
  const picked = Array.from({ length: Math.min(limit, candidates.length) }, (_, i) => candidates[Math.floor(i * step)]!);
  const texts = samples(picked.map((prompt) => prompt.text), prompts, home);
  return picked.map((prompt, i) => {
    const at = new Date(prompt.at);
    return { text: texts[i]!, date: localDate(prompt.at), time: `${pad(at.getHours())}:${pad(at.getMinutes())}`, agent: prompt.agent };
  });
}

function moment(session: SessionSummary, home: string): Moment {
  const start = new Date(session.start);
  return {
    date: localDate(session.start),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    agent: session.agent,
    title: session.title || clip(session.prompts[0]?.text.split("\n")[0] ?? "", 80),
    project: projectName(session.cwd, home),
    hours: hours(session.activeMs),
  };
}

function longestStreak(dates: string[]): Wrapped["streak"] {
  const sorted = [...new Set(dates)].sort();
  let best = { days: 0, from: "", to: "" };
  let run = { days: 0, from: "", to: "" };
  for (const date of sorted) {
    run = run.days && nextDay(run.to) === date ? { ...run, days: run.days + 1, to: date } : { days: 1, from: date, to: date };
    if (run.days > best.days) best = run;
  }
  return best;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y!, m! - 1, d! + 1).getTime());
}

/** YYYY-MM-DD in local time. */
export function localDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function minuteOfDay(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

function tally(values: string[]): Ranked[] {
  const counts: Record<string, number> = {};
  for (const value of values) if (value) counts[value] = (counts[value] ?? 0) + 1;
  return rank(Object.entries(counts));
}

function rank(entries: [string, number][]): Ranked[] {
  return entries.map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function sum<T>(items: T[], value: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += value(item);
  return total;
}

const hours = (ms: number) => round1(ms / HOUR);
const round1 = (value: number) => Math.round(value * 10) / 10;
const pad = (value: number) => String(value).padStart(2, "0");
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
