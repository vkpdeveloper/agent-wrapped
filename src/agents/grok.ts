import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { cleanPrompt, count, emptySummary, findFiles, jsonl, lineCount, mapLimit, span, toolKind } from "./core.ts";

// Grok Build keeps a folder per session in ~/.grok/sessions/<url-encoded cwd>/<id>/.
// summary.json has the cwd, title and session kind. updates.jsonl is the
// timestamped ACP event stream (prompts, tool calls and their results, per-turn
// token usage), so it is the one file read for the conversation;
// chat_history.jsonl has the same messages without times. Many folders are
// stubs with no prompt. Subagents get their own folder with session_kind
// "subagent" (or "subagent_resume") and are skipped.

interface GrokSummary {
  info?: { id?: string; cwd?: string };
  generated_title?: string;
  session_summary?: string;
  session_kind?: string;
}

interface GrokRecord {
  params?: {
    update?: GrokUpdate;
    _meta?: { agentTimestampMs?: number };
  };
}

interface GrokUpdate {
  sessionUpdate?: string;
  toolCallId?: string;
  title?: string;
  status?: string;
  content?: unknown;
  rawInput?: Record<string, unknown>;
  rawOutput?: { type?: string; exit_code?: number | null; timed_out?: boolean };
  usage?: Usage;
  task_snapshot?: { task_id?: string; exit_code?: number | null };
  _meta?: { promptIndex?: number; "x.ai/tool"?: { name?: string } };
}

interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  modelUsage?: Record<string, { modelCalls?: number }>;
}

interface Diff {
  type?: string;
  oldText?: string;
  newText?: string;
}

// use_tool calls a deferred tool, in practice an MCP server's ("server__tool").
const KINDS: Record<string, string> = { spawn_subagent: "task", web_fetch: "web", use_tool: "mcp" };

export async function sessions(): Promise<SessionSummary[]> {
  const files = await findFiles(join(homedir(), ".grok", "sessions"), "*/*/summary.json");
  const read = await mapLimit(files, 8, (path) => readSession(dirname(path)));
  return read.filter((session) => session !== undefined);
}

export async function readSession(dir: string): Promise<SessionSummary | undefined> {
  let meta: GrokSummary | null;
  try {
    meta = await Bun.file(join(dir, "summary.json")).json();
  } catch {
    return undefined;
  }
  if (!meta || meta.session_kind?.startsWith("subagent")) return undefined;

  const summary = emptySummary("grok", meta.info?.id ?? basename(dir));
  summary.title = meta.generated_title || meta.session_summary || "";
  summary.cwd = meta.info?.cwd ?? "";
  const times: number[] = [];
  // A prompt arrives as several chunks (the typed text, images, injected context) sharing a promptIndex.
  const prompts = new Map<number, { at: number; texts: string[] }>();
  // Tool call id -> index into summary.commands, so results can mark failures.
  const shellCalls = new Map<string, number>();
  const seenCalls = new Set<string>();

  for await (const record of jsonl<GrokRecord | null>(join(dir, "updates.jsonl"))) {
    const update = record?.params?.update;
    if (!update) continue;
    const at = record?.params?._meta?.agentTimestampMs ?? 0;
    times.push(at);

    switch (update.sessionUpdate) {
      case "user_message_chunk": {
        const index = update._meta?.promptIndex ?? prompts.size;
        const prompt = prompts.get(index) ?? { at, texts: [] };
        prompts.set(index, prompt);
        const content = update.content;
        if (!content || typeof content !== "object" || !("text" in content) || typeof content.text !== "string") break;
        const text = cleanPrompt(content.text);
        if (text) prompt.texts.push(text);
        break;
      }
      case "tool_call": {
        const id = update.toolCallId ?? "";
        // A call can be announced more than once as it streams in.
        if (seenCalls.has(id)) break;
        seenCalls.add(id);
        const kind = kindOf(update);
        count(summary.tools, kind);
        const command = update.rawInput?.command;
        if (kind === "shell" && typeof command === "string") {
          shellCalls.set(id, summary.commands.length);
          summary.commands.push({ command, ok: true });
        }
        break;
      }
      case "tool_call_update": {
        const output = update.rawOutput;
        const failed =
          update.status === "failed" ||
          output?.timed_out === true ||
          (output?.type === "Bash" && typeof output.exit_code === "number" && output.exit_code !== 0);
        if (failed) markFailed(summary, shellCalls.get(update.toolCallId ?? ""));
        if (update.status === "completed") addDiffs(summary, update.content);
        break;
      }
      case "task_completed": {
        // Backgrounded commands report their exit code when they finish; the task id is the tool call id.
        const task = update.task_snapshot;
        if (typeof task?.exit_code === "number" && task.exit_code !== 0) markFailed(summary, shellCalls.get(task.task_id ?? ""));
        break;
      }
      case "turn_completed": {
        const usage = update.usage;
        summary.tokens.input += usage?.inputTokens ?? 0;
        summary.tokens.output += usage?.outputTokens ?? 0;
        for (const [model, used] of Object.entries(usage?.modelUsage ?? {})) count(summary.models, model, used.modelCalls ?? 1);
        break;
      }
    }
  }

  for (const prompt of prompts.values()) {
    if (prompt.texts.length) summary.prompts.push({ at: prompt.at, text: prompt.texts.join("\n") });
  }
  if (!summary.prompts.length && !seenCalls.size) return undefined;
  return { ...summary, ...span(times) };
}

/** Grok's own tools carry their name in _meta; server-side web and X searches only have a variant. */
function kindOf(update: GrokUpdate): string {
  const name = update._meta?.["x.ai/tool"]?.name;
  if (name) return KINDS[name] ?? toolKind(name);
  const variant = update.rawInput?.variant;
  if (variant === "WebSearch" || variant === "XSearch") return "web";
  return toolKind(update.title ?? "unknown");
}

function markFailed(summary: SessionSummary, index: number | undefined): void {
  const command = index === undefined ? undefined : summary.commands[index];
  if (command) command.ok = false;
}

/** Edits and writes finish with ACP diff content: the replaced snippet and its replacement. */
function addDiffs(summary: SessionSummary, content: unknown): void {
  if (!Array.isArray(content)) return;
  for (const part of content as Diff[]) {
    if (part?.type !== "diff") continue;
    summary.linesRemoved += lineCount(part.oldText ?? "");
    summary.linesAdded += lineCount(part.newText ?? "");
  }
}
