import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { SessionSummary } from "../types.ts";
import { addReply, cleanPrompt, count, emptySummary, findFiles, jsonl, lineCount, mapLimit, span, toolKind } from "./core.ts";

// Claude Code writes one JSON record per line to
// ~/.claude/projects/<cwd>/<session>.jsonl. Subagent transcripts live one level
// deeper (<session>/subagents/*.jsonl), so the */*.jsonl glob leaves them out.

interface ClaudeRecord {
  type?: string;
  timestamp?: string;
  cwd?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  aiTitle?: string;
  customTitle?: string;
  message?: {
    id?: string;
    model?: string;
    content?: string | Block[];
    usage?: Usage;
  };
  toolUseResult?: unknown;
}

interface Usage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; is_error?: boolean }
  | { type: "thinking" | "image" | "redacted_thinking" };

interface EditResult {
  type?: string;
  content?: string;
  structuredPatch?: { lines: string[] }[];
}

// Records we never read. Checked on the raw line so they are not parsed.
const SKIPPED = /"type":"(api-request|api-request-blob|api-request-shape|attachment|atis-latch|queue-operation|last-prompt|file-history-snapshot|progress)"/;

export async function sessions(): Promise<SessionSummary[]> {
  const root = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
  const files = await findFiles(root, "*/*.jsonl");
  return mapLimit(files, 8, readSession);
}

export async function readSession(path: string): Promise<SessionSummary> {
  const summary = emptySummary("claude", basename(path, ".jsonl"));
  const times: number[] = [];
  const seenMessages = new Set<string>();
  let customTitle = "";
  // tool_use id -> index into summary.commands, to mark failures from the result.
  const shellCalls = new Map<string, number>();

  for await (const record of jsonl<ClaudeRecord>(path, (line) => !SKIPPED.test(line.slice(0, 400)))) {
    if (record.aiTitle) summary.title = record.aiTitle;
    if (record.customTitle) customTitle = record.customTitle;
    if (record.isSidechain) continue;
    if (!summary.cwd && record.cwd) summary.cwd = record.cwd;
    const at = record.timestamp ? Date.parse(record.timestamp) : 0;
    const content = record.message?.content;

    if (record.type === "user" && content !== undefined) {
      times.push(at);
      if (record.isMeta || record.isCompactSummary) continue;
      if (typeof content === "string") {
        const text = promptText(content);
        if (text) summary.prompts.push({ at, text });
        continue;
      }
      const texts: string[] = [];
      for (const block of content) {
        if (block.type === "text") texts.push(block.text);
        if (block.type !== "tool_result") continue;
        const index = shellCalls.get(block.tool_use_id);
        const call = index === undefined ? undefined : summary.commands[index];
        if (call && block.is_error) call.ok = false;
        addLines(summary, record.toolUseResult);
      }
      const text = promptText(texts.join("\n"));
      if (text) summary.prompts.push({ at, text });
      continue;
    }

    if (record.type !== "assistant" || !Array.isArray(content)) continue;
    times.push(at);
    // Claude writes one record per content block, each repeating the message's usage.
    const id = record.message?.id;
    if (id && !seenMessages.has(id)) {
      seenMessages.add(id);
      const model = record.message?.model;
      if (model && model !== "<synthetic>") count(summary.models, model);
      const usage = record.message?.usage;
      if (usage) {
        summary.tokens.input +=
          (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
        summary.tokens.output += usage.output_tokens ?? 0;
      }
    }
    for (const block of content) {
      if (block.type === "text") addReply(summary, block.text);
      if (block.type !== "tool_use") continue;
      const kind = toolKind(block.name);
      count(summary.tools, kind);
      if (kind === "shell" && typeof block.input.command === "string") {
        shellCalls.set(block.id, summary.commands.length);
        summary.commands.push({ command: block.input.command, ok: true });
      }
    }
  }
  // A title the person set with /rename beats the generated one.
  return { ...summary, title: customTitle || summary.title, ...span(times) };
}

// Built-in commands that only change Claude Code's UI or settings. They are typed, but not asked of the agent.
const LOCAL_COMMANDS = new Set(
  "add-dir agents autocompact bug clear compact config context cost doctor effort exit export fast help hooks ide login logout mcp memory model output-style permissions plugin privacy-settings release-notes rename resume status statusline terminal-setup theme upgrade usage vim".split(
    " ",
  ),
);

/** Slash commands become "/name args"; everything else goes through the shared filter. */
function promptText(raw: string): string {
  const command = /<command-name>\/?([\s\S]*?)<\/command-name>/.exec(raw);
  if (command) {
    const name = command[1]?.trim() ?? "";
    if (LOCAL_COMMANDS.has(name)) return "";
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(raw)?.[1]?.trim();
    return [`/${name}`, args].filter(Boolean).join(" ");
  }
  return cleanPrompt(raw);
}

/** Edit and Write results carry a structured patch, or the whole file for a new one. */
function addLines(summary: SessionSummary, result: unknown): void {
  if (!result || typeof result !== "object") return;
  const edit = result as EditResult;
  if (edit.structuredPatch?.length) {
    for (const line of edit.structuredPatch.flatMap((hunk) => hunk.lines)) {
      if (line.startsWith("+")) summary.linesAdded++;
      else if (line.startsWith("-")) summary.linesRemoved++;
    }
  } else if (edit.type === "create" && typeof edit.content === "string") {
    summary.linesAdded += lineCount(edit.content);
  }
}
