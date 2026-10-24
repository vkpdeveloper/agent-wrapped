import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { addReply, cleanPrompt, count, diffLines, emptySummary, findFiles, jsonl, lineCount, mapLimit, span, toolKind } from "./core.ts";

// Pi writes ~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<id>.jsonl. The
// first line is a session header ({type: "session", cwd, parentSession?});
// every other line is an entry, and conversation turns are {type: "message"}
// entries wrapping a user, assistant or toolResult message.

interface PiRecord {
  type?: string;
  id?: string;
  timestamp?: string;
  cwd?: string;
  parentSession?: string;
  name?: string;
  message?: PiMessage;
}

interface PiMessage {
  role?: string;
  content?: string | Block[];
  model?: string;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
  toolCallId?: string;
  isError?: boolean;
  details?: { diff?: string };
  command?: string;
  exitCode?: number;
}

type Block =
  | { type: "text"; text: string }
  | { type: "toolCall"; id: string; name: string; arguments?: Record<string, unknown> }
  | { type: "thinking" | "image" };

export async function sessions(): Promise<SessionSummary[]> {
  const files = await findFiles(join(homedir(), ".pi", "agent", "sessions"), "*/*.jsonl");
  return mapLimit(files, 8, readSession);
}

export async function readSession(path: string): Promise<SessionSummary> {
  // Fall back to the file name's id (after the timestamp) if the header is missing.
  const summary = emptySummary("pi", basename(path, ".jsonl").split("_").pop() ?? "");
  const times: number[] = [];
  // toolCall id -> index into summary.commands, so the result can mark failures.
  const shellCalls = new Map<string, number>();
  // A forked session starts with a copy of its parent's entries; skip them so they are not counted twice.
  let forkedAt = 0;

  for await (const record of jsonl<PiRecord | null>(path)) {
    if (!record) continue;
    const at = record.timestamp ? Date.parse(record.timestamp) : 0;
    if (record.type === "session") {
      if (record.id) summary.id = record.id;
      summary.cwd = record.cwd ?? "";
      if (record.parentSession) forkedAt = at;
      continue;
    }
    if (record.type === "session_info" && record.name) summary.title = record.name;
    if (at < forkedAt) continue;
    times.push(at);

    const message = record.message;
    if (record.type !== "message" || !message) continue;
    const content = message.content;

    if (message.role === "user") {
      const raw = typeof content === "string" ? content : textOf(content);
      const text = cleanPrompt(raw);
      // Bare slash commands like "/clear" drive the TUI, they are not requests.
      if (text && !/^\/[\w:-]+$/.test(text)) summary.prompts.push({ at, text });
    } else if (message.role === "assistant") {
      if (message.model) count(summary.models, message.model);
      const usage = message.usage;
      if (usage) {
        summary.tokens.input += (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0);
        summary.tokens.output += usage.output ?? 0;
      }
      for (const block of Array.isArray(content) ? content : []) {
        if (block.type === "toolCall") addToolCall(summary, block, shellCalls);
        if (block.type === "text") addReply(summary, block.text);
      }
    } else if (message.role === "toolResult") {
      const index = shellCalls.get(message.toolCallId ?? "");
      const call = index === undefined ? undefined : summary.commands[index];
      if (call && message.isError) call.ok = false;
      // Edit diffs prefix each line with "+", "-" or " " and then the line number.
      if (!message.isError && message.details?.diff) {
        const { added, removed } = diffLines(message.details.diff);
        summary.linesAdded += added;
        summary.linesRemoved += removed;
      }
    } else if (message.role === "bashExecution" && message.command) {
      // Commands the person ran themselves with "!" in the editor.
      count(summary.tools, "shell");
      summary.commands.push({ command: message.command, ok: (message.exitCode ?? 0) === 0 });
    }
  }
  return { ...summary, ...span(times) };
}

function textOf(content: Block[] | undefined): string {
  const texts: string[] = [];
  for (const block of content ?? []) if (block.type === "text") texts.push(block.text);
  return texts.join("\n");
}

function addToolCall(
  summary: SessionSummary,
  block: Extract<Block, { type: "toolCall" }>,
  shellCalls: Map<string, number>,
): void {
  const kind = toolKind(block.name);
  count(summary.tools, kind);
  const args = block.arguments ?? {};
  if (kind === "shell" && typeof args.command === "string") {
    shellCalls.set(block.id, summary.commands.length);
    summary.commands.push({ command: args.command, ok: true });
  }
  // `write` records no diff, so count the whole file as added.
  if (block.name === "write" && typeof args.content === "string") summary.linesAdded += lineCount(args.content);
}
