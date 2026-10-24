#!/usr/bin/env bun
import { homedir, hostname, userInfo } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { version } from "../package.json";
import { allSessions, unique } from "./agents/index.ts";
import { redact } from "./redact.ts";
import { wrap } from "./stats.ts";
import { AGENT_NAMES, type AgentId, type SessionSummary, type Wrapped } from "./types.ts";

const HELP = `agent-wrapped: your year with coding agents, as a Wrapped video

Usage
  agent-wrapped [options]                  Read your sessions and render the video
  agent-wrapped stats [options]            Write the stats as JSON (edit lessons and persona there)
  agent-wrapped render <wrapped.json>      Render a video from that JSON
  agent-wrapped agents                     Agents with local history, most sessions first
  agent-wrapped sessions [-o file]         This machine's sessions as JSON, for --add on another machine

Reads T3 Code, Claude Code, Codex, OpenCode, Pi, Amp, Cursor and Grok Build
history on this machine. Nothing is uploaded. Secrets in prompts are masked.

Options
  -o, --out <file>       Output path. Default: wrapped-<year>.mp4 (stats: wrapped-<year>.json)
      --year <n>         Default: this year.
      --name <text>      Name on the first card. Default: your git user.name.
      --format <name>    vertical (1080x1920, default) or square (1080x1080).
      --add <file>       Also count another machine's \`agent-wrapped sessions\` output. Repeatable.
  -v, --version
  -h, --help`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    year: { type: "string" },
    name: { type: "string" },
    format: { type: "string" },
    add: { type: "string", multiple: true },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
});

if (values.version) {
  console.log(version);
  process.exit(0);
}
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const command = positionals[0];
const year = Number(values.year ?? new Date().getFullYear());
const format = values.format ?? "vertical";
if (format !== "vertical" && format !== "square") fail(`--format expects vertical or square, got "${format}"`);

if (command === "agents") {
  const sessions = await allSessions();
  if (!sessions.length) console.log("No agent sessions found on this machine.");
  for (const [agent, list] of byAgent(sessions)) {
    const first = day(Math.min(...list.map((s) => s.start)));
    const last = day(Math.max(...list.map((s) => s.end)));
    const hours = list.reduce((sum, s) => sum + s.activeMs, 0) / 3_600_000;
    console.log(`${AGENT_NAMES[agent].padEnd(12)} ${String(list.length).padStart(5)} sessions  ${hours.toFixed(0).padStart(5)}h  ${first} to ${last}`);
  }
  process.exit(0);
}

if (command === "render") {
  const path = positionals[1];
  if (!path) fail("render expects a wrapped.json path, from `agent-wrapped stats`");
  const wrapped = (await Bun.file(path).json()) as Wrapped;
  if (!Array.isArray(wrapped.agents) || !wrapped.totals) fail(`${path} is not a wrapped.json from \`agent-wrapped stats\``);
  await render(wrapped, resolve(values.out ?? `wrapped-${wrapped.year}.mp4`));
  process.exit(0);
}

if (command === "sessions") {
  // Leaves this machine, so home paths become ~ and secrets are masked here.
  const home = homedir();
  const sessions = (await allSessions())
    .filter((session) => new Date(session.start).getFullYear() === year)
    .map((session) => ({
      ...session,
      cwd: session.cwd === home || session.cwd.startsWith(`${home}/`) ? `~${session.cwd.slice(home.length)}` : session.cwd,
      prompts: session.prompts.map((prompt) => ({ ...prompt, text: redact(prompt.text, home) })),
    }));
  const json = JSON.stringify({ machine: hostname(), sessions } satisfies Export);
  if (values.out) {
    await Bun.write(resolve(values.out), json);
    console.log(`${resolve(values.out)}  (${sessions.length} sessions from ${year})`);
  } else {
    process.stdout.write(json);
  }
  process.exit(0);
}

if (command !== undefined && command !== "stats") fail(`Unknown command "${command}". Run agent-wrapped --help.`);

const started = performance.now();
const machines = [{ machine: hostname(), sessions: await allSessions() }, ...(await Promise.all((values.add ?? []).map(readExport)))];
const wrapped = wrap(unique(machines.flatMap((m) => m.sessions)), { year, name: values.name ?? (await defaultName()), home: homedir() });
if (!wrapped.totals.sessions) fail(`No agent sessions from ${year} on this machine.`);
const took = ((performance.now() - started) / 1000).toFixed(1);

const agents = wrapped.agents.map((a) => `${a.name} ${a.sessions}`).join(", ");
const machineCount = new Set(machines.map((m) => m.machine)).size;
const across = machineCount > 1 ? ` on ${machineCount} machines` : "";
const summary = `${wrapped.totals.sessions} sessions${across} (${agents}), ${Math.round(wrapped.totals.hours)}h, ${wrapped.totals.prompts} prompts, ${wrapped.corrections.total} corrections`;

if (command === "stats") {
  const out = resolve(values.out ?? `wrapped-${year}.json`);
  await Bun.write(out, JSON.stringify(wrapped, null, 2));
  console.log(`${out}  (${summary}, read in ${took}s)`);
  process.exit(0);
}

console.log(`${summary}, read in ${took}s`);
await render(wrapped, resolve(values.out ?? `wrapped-${year}.mp4`));

/** What `agent-wrapped sessions` writes. */
interface Export {
  machine: string;
  sessions: SessionSummary[];
}

async function readExport(path: string): Promise<Export> {
  let data: Export;
  try {
    data = await Bun.file(path).json();
  } catch {
    fail(`could not read ${path}`);
  }
  if (!Array.isArray(data?.sessions)) fail(`${path} is not the output of \`agent-wrapped sessions\``);
  return data;
}

async function render(wrapped: Wrapped, out: string) {
  const { renderVideo } = await import("./render.ts");
  const rendering = performance.now();
  // The \r progress line only makes sense in a terminal. Agents capture stderr.
  const tty = process.stderr.isTTY;
  let shown = -1;
  await renderVideo(wrapped, format as "vertical" | "square", out, (progress) => {
    const percent = Math.floor(progress * 100);
    if (tty && percent !== shown && percent % 5 === 0) {
      shown = percent;
      process.stderr.write(`\rRendering ${percent}%`);
    }
  });
  if (tty) process.stderr.write("\n");
  console.log(`${out}  (rendered in ${((performance.now() - rendering) / 1000).toFixed(1)}s)`);
}

function byAgent(sessions: SessionSummary[]): [AgentId, SessionSummary[]][] {
  const groups = Map.groupBy(sessions, (s) => s.agent);
  return [...groups].sort((a, b) => b[1].length - a[1].length);
}

async function defaultName(): Promise<string> {
  const git = Bun.spawnSync(["git", "config", "--global", "user.name"], { stderr: "ignore" });
  const name = git.success ? git.stdout.toString().trim().split(/\s+/)[0] : "";
  return name || userInfo().username;
}

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fail(message: string): never {
  console.error(`agent-wrapped: ${message}`);
  process.exit(1);
}
