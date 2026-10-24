import { homedir } from "node:os";
import { join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { cleanPrompt, count, diffLines, emptySummary, findFiles, jsonl, lineCount, mapLimit, span } from "./core.ts";

// Codex writes ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl (and moves archived
// ones to ~/.codex/archived_sessions). `event_msg/item_completed` records carry
// the structured items the TUI renders, so we read those plus token counts and
// skip the raw model I/O (`response_item`, `compacted`), about half the bytes.

interface CodexRecord {
  timestamp?: string;
  type?: string;
  payload?: {
    type?: string;
    id?: string;
    cwd?: string;
    source?: unknown;
    model?: string;
    item?: CodexItem;
    info?: { total_token_usage?: { input_tokens?: number; output_tokens?: number } } | null;
  };
}

type CodexItem =
  | { type: "UserMessage"; content: { type: string; text?: string }[] }
  | { type: "CommandExecution"; command: string[] | string; parsed_cmd?: { type: string }[]; exit_code?: number | null }
  | { type: "FileChange"; changes: Record<string, { type: string; content?: string; unified_diff?: string }> }
  | { type: "McpToolCall" }
  | { type: "Extension"; kind?: string }
  | { type: "SubAgentActivity"; kind?: string }
  | { type: "ImageView" }
  | { type: "AgentMessage" | "Reasoning" | "ContextCompaction" };

const KEPT = /"type":"(session_meta|turn_context|event_msg)"/;

export async function sessions(): Promise<SessionSummary[]> {
  const root = process.env.CODEX_HOME || join(homedir(), ".codex");
  const files = [
    ...(await findFiles(join(root, "sessions"), "**/rollout-*.jsonl")),
    ...(await findFiles(join(root, "archived_sessions"), "**/rollout-*.jsonl")),
  ];
  const titles = await threadNames(join(root, "session_index.jsonl"));
  const read = await mapLimit(files, 8, readSession);
  return read.flatMap((session) => (session ? [{ ...session, title: titles.get(session.id) ?? session.title }] : []));
}

/** Codex keeps thread names in a side index; later lines win. */
async function threadNames(path: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    for await (const entry of jsonl<{ id?: string; thread_name?: string }>(path)) {
      if (entry.id && entry.thread_name) names.set(entry.id, entry.thread_name);
    }
  } catch {
    // No index.
  }
  return names;
}

/** A session summary, or undefined for subagent threads (their own parent session covers them). */
export async function readSession(path: string): Promise<SessionSummary | undefined> {
  const summary = emptySummary("codex", "");
  const times: number[] = [];
  let model = "";
  let tokens = { input: 0, output: 0 };

  // The type field sits right after the timestamp and ordinal, near the start of the line.
  for await (const record of jsonl<CodexRecord>(path, (line) => KEPT.test(line.slice(0, 120)))) {
    const payload = record.payload;
    if (!payload) continue;
    const at = record.timestamp ? Date.parse(record.timestamp) : 0;
    times.push(at);

    if (record.type === "session_meta") {
      if (typeof payload.source === "object" && payload.source && "subagent" in payload.source) return undefined;
      summary.id ||= payload.id ?? "";
      summary.cwd ||= payload.cwd ?? "";
      continue;
    }
    if (record.type === "turn_context") {
      model = payload.model ?? model;
      continue;
    }
    if (payload.type === "token_count") {
      // Totals are cumulative: the last one is the session's total.
      const total = payload.info?.total_token_usage;
      if (!total) continue;
      // OpenAI's input_tokens already includes cached input; output includes reasoning.
      tokens = { input: total.input_tokens ?? 0, output: total.output_tokens ?? 0 };
      if (model) count(summary.models, model);
      continue;
    }
    const item = payload.type === "item_completed" ? payload.item : undefined;
    if (item) addItem(summary, item, at);
  }
  return { ...summary, tokens, ...span(times) };
}

function addItem(summary: SessionSummary, item: CodexItem, at: number): void {
  switch (item.type) {
    case "UserMessage": {
      const text = cleanPrompt(item.content.map((part) => part.text ?? "").join("\n"));
      if (text) summary.prompts.push({ at, text });
      break;
    }
    case "CommandExecution": {
      // Codex runs reads and searches through the shell too; parsed_cmd says which they were.
      const parsed = (item.parsed_cmd ?? []).map((cmd) => cmd.type);
      if (parsed.length && parsed.every((type) => type === "read")) count(summary.tools, "read");
      else if (parsed.length && parsed.every((type) => ["read", "search", "list_files"].includes(type))) {
        count(summary.tools, "search");
      } else {
        count(summary.tools, "shell");
        summary.commands.push({ command: commandText(item.command), ok: item.exit_code === 0 || item.exit_code == null });
      }
      break;
    }
    case "FileChange":
      count(summary.tools, "edit");
      for (const change of Object.values(item.changes)) {
        if (change.unified_diff) {
          const { added, removed } = diffLines(change.unified_diff);
          summary.linesAdded += added;
          summary.linesRemoved += removed;
        } else if (change.type === "add") {
          summary.linesAdded += lineCount(change.content ?? "");
        }
      }
      break;
    case "McpToolCall":
      count(summary.tools, "mcp");
      break;
    case "Extension": {
      // Kinds look like "web.search", "image_gen.generation", "clock.sleep".
      const kind = (item.kind ?? "extension").split(".")[0]!;
      count(summary.tools, kind === "web" ? "web" : kind);
      break;
    }
    case "SubAgentActivity":
      if (item.kind === "started") count(summary.tools, "task");
      break;
    case "ImageView":
      count(summary.tools, "read");
      break;
  }
}

/** ["/bin/zsh", "-lc", "<script>"] -> "<script>" */
function commandText(command: string[] | string): string {
  if (!Array.isArray(command)) return command;
  const [shell, flag, script] = command;
  if (command.length === 3 && /sh$/.test(shell ?? "") && flag?.startsWith("-") && script) return script;
  return command.join(" ");
}
