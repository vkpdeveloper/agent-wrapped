import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSession as readClaude } from "./claude.ts";
import { readSession as readCodex } from "./codex.ts";
import { cleanPrompt, span } from "./core.ts";

const dir = mkdtempSync(join(tmpdir(), "agent-wrapped-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function fixture(name: string, records: unknown[]): Promise<string> {
  const path = join(dir, name);
  await Bun.write(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n");
  return path;
}

const at = (minutes: number) => new Date(Date.UTC(2026, 4, 1, 10, minutes)).toISOString();

describe("span", () => {
  test("only counts gaps of at most 10 minutes as active", () => {
    const min = 60_000;
    // 0 -> 5 (5 min) -> 15 (10 min) -> 40 (idle) -> 42 (2 min)
    expect(span([0 + 1, 5 * min + 1, 15 * min + 1, 40 * min + 1, 42 * min + 1])).toEqual({
      start: 1,
      end: 42 * min + 1,
      activeMs: 17 * min,
    });
  });
});

describe("cleanPrompt", () => {
  test.each([
    "<system-reminder>Today is Monday</system-reminder>",
    "<task-notification>\n<task-id>b1</task-id>\n</task-notification>",
    "This session is being continued from a previous conversation that ran out of context.",
    "# AGENTS.md instructions for /repo\n\n<INSTRUCTIONS>be nice</INSTRUCTIONS>",
    "<environment_context>\n  <cwd>/repo</cwd>\n</environment_context>",
    "Background command completed (exit 0): /bin/zsh -lc \"ls\"",
    "Act as the implementation sub-agent for this task.\n\nUpdate the CLIs.",
  ])("drops injected %p", (text) => expect(cleanPrompt(text)).toBe(""));

  test("keeps the person's words around a system reminder", () => {
    expect(cleanPrompt("fix the header<system-reminder>ignore</system-reminder>")).toBe("fix the header");
  });
});

describe("claude", () => {
  test("counts each message's usage once, finds failed commands and keeps only typed prompts", async () => {
    const usage = { input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 5 };
    const assistant = (minute: number, id: string, content: unknown[]) => ({
      type: "assistant",
      timestamp: at(minute),
      message: { id, model: "claude-opus-5-5", usage, content },
    });
    const path = await fixture("claude.jsonl", [
      { type: "user", timestamp: at(0), cwd: "/repo", message: { content: "add a login page" } },
      { type: "user", timestamp: at(0), isMeta: true, message: { content: "<local-command-caveat>Caveat</local-command-caveat>" } },
      // One message, written as three records (thinking, text, tool_use) that repeat the same usage.
      assistant(1, "msg_1", [{ type: "thinking", thinking: "hm" }]),
      assistant(1, "msg_1", [{ type: "text", text: "Running tests" }]),
      assistant(1, "msg_1", [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "bun test" } }]),
      {
        type: "user",
        timestamp: at(2),
        message: { content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "Exit code 1" }] },
      },
      assistant(3, "msg_2", [{ type: "tool_use", id: "t2", name: "Edit", input: { file_path: "a.ts" } }]),
      {
        type: "user",
        timestamp: at(3),
        message: { content: [{ type: "tool_result", tool_use_id: "t2" }] },
        toolUseResult: { structuredPatch: [{ lines: [" keep", "-old", "+new", "+more"] }] },
      },
      { type: "user", timestamp: at(4), isSidechain: true, message: { content: "subagent prompt" } },
      { type: "user", timestamp: at(5), isCompactSummary: true, message: { content: "Summary of earlier work" } },
      { type: "user", timestamp: at(6), message: { content: "no, keep the old one<system-reminder>x</system-reminder>" } },
      { type: "ai-title", aiTitle: "Login page" },
    ]);

    const session = await readClaude(path);
    expect(session.prompts.map((prompt) => prompt.text)).toEqual(["add a login page", "no, keep the old one"]);
    expect(session.tokens).toEqual({ input: 2 * 1110, output: 2 * 5 });
    expect(session.models).toEqual({ "claude-opus-5-5": 2 });
    expect(session.tools).toEqual({ shell: 1, edit: 1 });
    expect(session.commands).toEqual([{ command: "bun test", ok: false }]);
    expect([session.linesAdded, session.linesRemoved]).toEqual([2, 1]);
    expect(session.title).toBe("Login page");
    expect(session.cwd).toBe("/repo");
    expect(session.activeMs).toBe(6 * 60_000);
  });
});

describe("codex", () => {
  const meta = (source: unknown) => ({
    timestamp: at(0),
    type: "session_meta",
    payload: { id: "thread-1", cwd: "/repo", source },
  });
  const tokens = (minute: number, input: number, output: number) => ({
    timestamp: at(minute),
    type: "event_msg",
    payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, output_tokens: output } } },
  });
  const item = (minute: number, value: unknown) => ({ timestamp: at(minute), type: "event_msg", payload: { type: "item_completed", item: value } });

  test("uses the final cumulative token count and skips injected context", async () => {
    const path = await fixture("rollout-main.jsonl", [
      meta("vscode"),
      { timestamp: at(0), type: "turn_context", payload: { model: "gpt-6-sol" } },
      item(0, { type: "UserMessage", content: [{ type: "text", text: "<environment_context>\n<cwd>/repo</cwd>" }] }),
      item(1, { type: "UserMessage", content: [{ type: "text", text: "run the tests" }] }),
      tokens(2, 1000, 50),
      item(3, { type: "CommandExecution", command: ["/bin/zsh", "-lc", "bun test"], exit_code: 1, parsed_cmd: [{ type: "unknown" }] }),
      item(3, { type: "CommandExecution", command: ["/bin/zsh", "-lc", "rg foo"], exit_code: 0, parsed_cmd: [{ type: "search" }] }),
      tokens(4, 3000, 120),
    ]);
    const session = await readCodex(path);
    expect(session?.prompts.map((prompt) => prompt.text)).toEqual(["run the tests"]);
    expect(session?.tokens).toEqual({ input: 3000, output: 120 });
    expect(session?.models).toEqual({ "gpt-6-sol": 2 });
    expect(session?.tools).toEqual({ shell: 1, search: 1 });
    expect(session?.commands).toEqual([{ command: "bun test", ok: false }]);
  });

  test("skips subagent threads", async () => {
    const path = await fixture("rollout-sub.jsonl", [
      meta({ subagent: { thread_spawn: { parent_thread_id: "thread-0", depth: 1 } } }),
      item(1, { type: "UserMessage", content: [{ type: "text", text: "review the PR" }] }),
    ]);
    expect(await readCodex(path)).toBeUndefined();
  });
});
