import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { cleanPrompt, count, emptySummary, findFiles, lineCount, mapLimit, span, toolKind } from "./core.ts";

// Cursor's agent (the editor and the cursor-agent CLI alike) writes one
// transcript per chat to ~/.cursor/projects/<workspace>/agent-transcripts/<id>/<id>.jsonl.
// Subagents get their own files under <id>/subagents/, which the glob skips.
// Transcripts hold the user and assistant messages with tool calls, but no
// tool results, models, tokens or record timestamps: the only times are the
// <timestamp> tags Cursor puts in each user message, plus the file's mtime.
// The CLI also keeps ~/.cursor/chats/<hash>/<id>/store.db, whose meta row
// gives the chat's title and model.

interface CursorRecord {
  role?: string;
  message?: { content?: Block[] };
}

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; name: string; input?: Record<string, unknown> };

export interface ChatMeta {
  agentId?: string;
  name?: string;
  lastUsedModel?: string;
}

const KINDS: Record<string, string> = {
  strreplace: "edit",
  delete: "edit",
  callmcptool: "mcp",
};

// Messages Cursor sends as the user after a background task or subagent finishes.
const INJECTED = /^(Briefly inform the user about the task result|Perform any necessary follow-up actions in response to the subagent completion)/;

interface Transcript {
  id: string;
  path: string;
  lines: string[];
  mtime: number;
}

export async function sessions(): Promise<SessionSummary[]> {
  const root = join(homedir(), ".cursor");
  const chats = new Map<string, ChatMeta>();
  for (const path of await findFiles(join(root, "chats"), "*/*/store.db")) {
    const meta = chatMeta(path);
    if (meta) chats.set(meta.agentId ?? basename(dirname(path)), meta);
  }
  return readSessions(await findFiles(join(root, "projects"), "*/agent-transcripts/*/*.jsonl"), chats);
}

/**
 * A chat moved to another workspace leaves a copy of its transcript in each
 * one, and a duplicated chat starts with a copy of the original's history.
 * Both begin with the same first message, so transcripts are grouped by it
 * and each group is read as one session.
 */
export async function readSessions(paths: string[], chats = new Map<string, ChatMeta>()): Promise<SessionSummary[]> {
  const groups = new Map<string, Transcript[]>();
  for (const transcript of await mapLimit(paths, 8, loadTranscript)) {
    if (!transcript) continue;
    const key = transcript.lines[0] ?? "";
    groups.set(key, [...(groups.get(key) ?? []), transcript]);
  }
  return mapLimit([...groups.values()], 8, (group) => readSession(group, chats));
}

async function loadTranscript(path: string): Promise<Transcript | undefined> {
  try {
    const file = Bun.file(path);
    const lines = (await file.text()).split("\n").filter(Boolean);
    return { id: basename(path, ".jsonl"), path, lines, mtime: file.lastModified };
  } catch {
    return undefined;
  }
}

async function readSession(group: Transcript[], chats: Map<string, ChatMeta>): Promise<SessionSummary> {
  // The longest copy is the base; the others only add what follows their shared history.
  const copies = [...group].sort((a, b) => b.lines.length - a.lines.length);
  const [base, ...others] = copies;
  const lines = [...(base?.lines ?? [])];
  for (const other of others) {
    let shared = 0;
    while (shared < other.lines.length && other.lines[shared] === base?.lines[shared]) shared++;
    lines.push(...other.lines.slice(shared));
  }

  const summary = emptySummary("cursor", base?.id ?? "");
  const meta = group.map((transcript) => chats.get(transcript.id)).find(Boolean);
  const times = group.map((transcript) => transcript.mtime);
  const seenPrompts = new Set<string>();
  let renamedTo = "";
  let lastAt = 0;
  for (const copy of copies) {
    // <projectDir>/agent-transcripts/<id>/<id>.jsonl
    if (!summary.cwd) summary.cwd = await workspacePath(dirname(dirname(dirname(copy.path))));
  }

  for (const line of lines) {
    let record: CursorRecord | null;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!record) continue;
    const content = Array.isArray(record.message?.content) ? record.message.content : [];

    if (record.role === "user") {
      const raw = content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
      const at = timestampTag(raw);
      if (at) {
        times.push(at);
        lastAt = at;
      }
      const query = /<user_query>([\s\S]*?)<\/user_query>/.exec(raw)?.[1] ?? "";
      const text = cleanPrompt(query);
      // Cursor sometimes logs the same message twice, e.g. when a turn is retried.
      const key = `${lastAt} ${text}`;
      if (text && !INJECTED.test(text) && !seenPrompts.has(key)) {
        seenPrompts.add(key);
        summary.prompts.push({ at: lastAt, text });
      }
      continue;
    }
    if (record.role !== "assistant") continue;
    if (meta?.lastUsedModel) count(summary.models, meta.lastUsedModel);
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      const input = block.input ?? {};
      renamedTo = renameTitle(block.name, input) || renamedTo;
      const kind = kindOf(block.name, input);
      count(summary.tools, kind);
      if (kind === "shell" && typeof input.command === "string") summary.commands.push({ command: input.command, ok: true });
      if (block.name === "StrReplace" && typeof input.old_string === "string" && typeof input.new_string === "string") {
        summary.linesRemoved += lineCount(input.old_string);
        summary.linesAdded += lineCount(input.new_string);
      }
      if (block.name === "Write" && typeof input.contents === "string") summary.linesAdded += lineCount(input.contents);
    }
  }
  return { ...summary, title: meta?.name || renamedTo, ...span(times) };
}

/** CallDynamicTool wraps Cursor's own tools (namespace "cursor") as well as MCP servers. */
function kindOf(name: string, input: Record<string, unknown>): string {
  if (name === "CallDynamicTool") {
    if (input.namespace !== "cursor" || typeof input.toolName !== "string") return "mcp";
    return kindOf(input.toolName, {});
  }
  return KINDS[name.toLowerCase()] ?? toolKind(name);
}

/** The agent names its chat with the cursor-app-control MCP server's rename_chat tool. */
function renameTitle(name: string, input: Record<string, unknown>): string {
  if (name !== "CallMcpTool" && name !== "CallDynamicTool") return "";
  if (input.toolName !== "rename_chat") return "";
  const args = input.arguments;
  if (!args || typeof args !== "object" || !("title" in args)) return "";
  return typeof args.title === "string" ? args.title : "";
}

const MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";

/** "<timestamp>Friday, Jul 24, 2026, 4:06 PM (UTC+5:30)</timestamp>" -> epoch ms, or 0. */
export function timestampTag(text: string): number {
  const match = /<timestamp>\w+, (\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) ([AP]M) \(UTC(?:([+-])(\d{1,2})(?::(\d{2}))?)?\)/.exec(
    text,
  );
  if (!match) return 0;
  const [, month = "", day, year, hour, minute, half, sign, offsetHours, offsetMinutes] = match;
  const monthIndex = MONTHS.indexOf(month) / 3;
  if (!Number.isInteger(monthIndex)) return 0;
  const hours24 = (Number(hour) % 12) + (half === "PM" ? 12 : 0);
  const offset = (sign === "-" ? -1 : 1) * (Number(offsetHours ?? 0) * 60 + Number(offsetMinutes ?? 0));
  return Date.UTC(Number(year), monthIndex, Number(day), hours24, Number(minute) - offset);
}

const workspaces = new Map<string, Promise<string>>();

/** The workspace a projects/<slug> folder belongs to. */
function workspacePath(projectDir: string): Promise<string> {
  let path = workspaces.get(projectDir);
  if (!path) {
    path = Bun.file(join(projectDir, ".workspace-trusted"))
      .json()
      .then((trusted: { workspacePath?: unknown }) =>
        typeof trusted.workspacePath === "string" ? trusted.workspacePath : resolveSlug(basename(projectDir)),
      )
      .catch(() => resolveSlug(basename(projectDir)));
    workspaces.set(projectDir, path);
  }
  return path;
}

/**
 * Cursor names project folders after the path with "/" and "." turned into "-"
 * ("Users-me-.cursor-x" becomes "Users-me-cursor-x"), so the path is ambiguous.
 * Walk the filesystem, preferring the longest existing name at each level; any
 * part that no longer exists becomes the last path segment.
 */
function resolveSlug(slug: string): string {
  if (slug === "empty-window") return "";
  const parts = slug.split("-");
  let dir = "/";
  let i = 0;
  while (i < parts.length) {
    let next = "";
    for (let j = parts.length; j > i && !next; j--) {
      const name = parts.slice(i, j).join("-");
      if (existsSync(join(dir, name))) next = name;
      else if (existsSync(join(dir, `.${name}`))) next = `.${name}`;
      if (next) i = j;
    }
    if (!next) return join(dir, parts.slice(i).join("-"));
    dir = join(dir, next);
  }
  return dir;
}

/** The meta row of a CLI chat's store.db: hex-encoded JSON. */
function chatMeta(path: string): ChatMeta | undefined {
  try {
    const db = new Database(path, { readonly: true });
    try {
      const row = db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = '0'").get();
      return row ? (JSON.parse(Buffer.from(row.value, "hex").toString()) as ChatMeta) : undefined;
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}
