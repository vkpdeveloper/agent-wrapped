import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionSummary } from "../types.ts";
import { cleanPrompt, count, diffLines, emptySummary, findFiles, lineCount, mapLimit, span, toolKind } from "./core.ts";

// Amp keeps one JSON file per thread in ~/.local/share/amp/threads/T-<id>.json.
// Most of a thread lives on Amp's servers, and threads that were opened but
// never used are tiny stubs with no messages. history.jsonl next to it only
// has prompt text and cwd with no timestamps, so it is not read.

interface AmpThread {
  id?: string;
  created?: number;
  title?: string;
  messages?: AmpMessage[];
  env?: { initial?: { trees?: { uri?: string }[] } };
}

interface AmpMessage {
  role?: string;
  content?: Block[];
  meta?: { sentAt?: number };
  usage?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    timestamp?: string;
  };
}

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input?: Record<string, unknown> }
  | { type: "tool_result"; toolUseID: string; run?: ToolRun }
  | { type: "thinking" | "image" };

interface Call {
  name: string;
  input: Record<string, unknown>;
  /** Index into summary.commands for shell calls. */
  command?: number;
}

interface ToolRun {
  status?: string;
  result?: unknown;
}

const KINDS: Record<string, string> = {
  edit_file: "edit",
  create_file: "edit",
  finder: "search",
  read_web_page: "web",
  todo_write: "todo",
  todo_read: "todo",
};

export async function sessions(): Promise<SessionSummary[]> {
  const files = await findFiles(join(homedir(), ".local", "share", "amp", "threads"), "*.json");
  const read = await mapLimit(files, 8, readSession);
  return read.filter((session) => session !== undefined);
}

export async function readSession(path: string): Promise<SessionSummary | undefined> {
  let thread: AmpThread | null;
  try {
    thread = await Bun.file(path).json();
  } catch {
    return undefined;
  }
  if (!thread?.messages?.length) return undefined;

  const summary = emptySummary("amp", thread.id ?? basename(path, ".json"));
  summary.title = thread.title ?? "";
  const uri = thread.env?.initial?.trees?.[0]?.uri;
  if (uri?.startsWith("file://")) summary.cwd = fileURLToPath(uri);
  const times = [thread.created ?? 0];
  // tool_use id -> its call, so the result can mark failures and count lines.
  const calls = new Map<string, Call>();

  for (const message of thread.messages) {
    const content = message.content ?? [];
    if (message.role === "user") {
      const at = message.meta?.sentAt ?? 0;
      times.push(at);
      const texts: string[] = [];
      for (const block of content) {
        if (block.type === "text") texts.push(block.text);
        if (block.type === "tool_result") addResult(summary, calls.get(block.toolUseID), block.run);
      }
      const text = cleanPrompt(texts.join("\n"));
      if (text) summary.prompts.push({ at, text });
      continue;
    }
    if (message.role !== "assistant") continue;
    const usage = message.usage;
    if (usage) {
      times.push(usage.timestamp ? Date.parse(usage.timestamp) : 0);
      if (usage.model) count(summary.models, usage.model);
      summary.tokens.input +=
        (usage.inputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0);
      summary.tokens.output += usage.outputTokens ?? 0;
    }
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      const kind = KINDS[block.name] ?? toolKind(block.name);
      count(summary.tools, kind);
      const input = block.input ?? {};
      const call: Call = { name: block.name, input };
      if (kind === "shell" && typeof input.cmd === "string") {
        call.command = summary.commands.length;
        summary.commands.push({ command: input.cmd, ok: true });
      }
      calls.set(block.id, call);
    }
  }
  return { ...summary, ...span(times) };
}

function addResult(summary: SessionSummary, call: Call | undefined, run: ToolRun | undefined): void {
  if (!call || !run) return;
  const result = run.result && typeof run.result === "object" ? (run.result as Record<string, unknown>) : {};
  if (call.command !== undefined) {
    const exitCode = typeof result.exitCode === "number" ? result.exitCode : 0;
    const command = summary.commands[call.command];
    if (command && (run.status === "error" || exitCode !== 0)) command.ok = false;
  }
  if (run.status !== "done") return;
  // edit_file returns a unified diff (inside a ```diff fence); create_file only says it succeeded.
  if (call.name === "edit_file" && typeof result.diff === "string") {
    const { added, removed } = diffLines(result.diff);
    summary.linesAdded += added;
    summary.linesRemoved += removed;
  } else if (call.name === "create_file" && typeof call.input.content === "string") {
    summary.linesAdded += lineCount(call.input.content);
  }
}
