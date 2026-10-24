import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { addReply, cleanPrompt, count, diffLines, emptySummary, lineCount, span, toolKind } from "./core.ts";

// OpenCode keeps sessions in SQLite (~/.local/share/opencode/opencode.db): one
// `session_v2` row per session and one `session_message` row per user message,
// assistant step or idle marker, with the parts as JSON in `data`.

interface SessionRow {
  id: string;
  title: string | null;
  directory: string;
}

interface MessageRow {
  session_id: string;
  type: string;
  time_created: number;
  data: string;
}

interface Message {
  text?: string;
  model?: { id?: string };
  tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } };
  content?: Part[];
}

type Part =
  | {
      type: "tool";
      name: string;
      state: {
        status: string;
        input?: Record<string, unknown>;
        metadata?: { exit?: number | null; files?: { patch?: string }[] };
      };
    }
  | { type: "text"; text?: string }
  | { type: "reasoning" };

const FILE_TOOLS = new Set(["edit", "write", "patch", "apply_patch", "multiedit"]);

export async function sessions(): Promise<SessionSummary[]> {
  const path = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "opencode.db");
  if (!existsSync(path)) return [];
  const db = new Database(path, { readonly: true });
  try {
    // Older OpenCode versions kept sessions as JSON files; only the SQLite schema is read.
    if (!db.query("select 1 from sqlite_master where name = 'session_v2'").get()) return [];
    // Subagent sessions have a parent; their work is part of the parent session.
    const rows = db.query<SessionRow, []>("select id, title, directory from session_v2 where parent_id is null").all();
    const messages = db
      .query<MessageRow, []>(
        `select m.session_id, m.type, m.time_created, m.data from session_message m
         join session_v2 s on s.id = m.session_id where s.parent_id is null order by m.session_id, m.seq`,
      )
      .all();
    const bySession = new Map<string, MessageRow[]>();
    for (const message of messages) {
      const list = bySession.get(message.session_id);
      if (list) list.push(message);
      else bySession.set(message.session_id, [message]);
    }
    return rows.map((row) => summarize(row, bySession.get(row.id) ?? []));
  } finally {
    db.close();
  }
}

export function summarize(row: SessionRow, messages: MessageRow[]): SessionSummary {
  const summary = emptySummary("opencode", row.id);
  summary.title = row.title ?? "";
  summary.cwd = row.directory;
  const times: number[] = [];

  for (const row of messages) {
    times.push(row.time_created);
    let message: Message;
    try {
      message = JSON.parse(row.data) as Message;
    } catch {
      continue;
    }
    if (row.type === "user") {
      const text = cleanPrompt(message.text ?? "");
      if (text) summary.prompts.push({ at: row.time_created, text });
      continue;
    }
    if (row.type !== "assistant") continue;
    if (message.model?.id) count(summary.models, message.model.id);
    const tokens = message.tokens;
    if (tokens) {
      summary.tokens.input += (tokens.input ?? 0) + (tokens.cache?.read ?? 0) + (tokens.cache?.write ?? 0);
      summary.tokens.output += (tokens.output ?? 0) + (tokens.reasoning ?? 0);
    }
    for (const part of message.content ?? []) {
      if (part.type === "tool") addTool(summary, part);
      if (part.type === "text") addReply(summary, part.text ?? "");
    }
  }
  return { ...summary, ...span(times) };
}

function addTool(summary: SessionSummary, part: Extract<Part, { type: "tool" }>): void {
  const { state } = part;
  const kind = toolKind(part.name);
  count(summary.tools, kind);
  if (kind === "shell" && typeof state.input?.command === "string") {
    const failed = state.status === "error" || (state.metadata?.exit ?? 0) !== 0;
    summary.commands.push({ command: state.input.command, ok: !failed });
  }
  if (!FILE_TOOLS.has(part.name)) return;
  const files = state.metadata?.files ?? [];
  for (const file of files) {
    const { added, removed } = diffLines(file.patch ?? "");
    summary.linesAdded += added;
    summary.linesRemoved += removed;
  }
  if (!files.length && part.name === "write" && typeof state.input?.content === "string") {
    summary.linesAdded += lineCount(state.input.content);
  }
}
