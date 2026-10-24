import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as amp from "./amp.ts";
import * as cursor from "./cursor.ts";
import * as grok from "./grok.ts";
import * as pi from "./pi.ts";

const root = mkdtempSync(join(tmpdir(), "agent-wrapped-others-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function write(path: string, content: string): string {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

const jsonl = (records: unknown[]) => records.map((record) => JSON.stringify(record)).join("\n") + "\n";

describe("pi", () => {
  test("reads prompts, tools, tokens and diffs, skipping copied parent entries and bare slash commands", async () => {
    const path = write(
      "pi/s1.jsonl",
      jsonl([
        { type: "session", id: "s1", timestamp: "2026-05-01T10:00:00.000Z", cwd: "/work", parentSession: "/old.jsonl" },
        // Copied from the parent session before the fork.
        { type: "message", timestamp: "2026-04-30T09:00:00.000Z", message: { role: "user", content: [{ type: "text", text: "old prompt" }] } },
        { type: "session_info", timestamp: "2026-05-01T10:00:01.000Z", name: "Fix the build" },
        { type: "message", timestamp: "2026-05-01T10:00:02.000Z", message: { role: "user", content: [{ type: "text", text: "/clear" }] } },
        { type: "message", timestamp: "2026-05-01T10:00:03.000Z", message: { role: "user", content: [{ type: "text", text: "fix the build" }] } },
        {
          type: "message",
          timestamp: "2026-05-01T10:00:05.000Z",
          message: {
            role: "assistant",
            model: "claude-opus-4-8",
            usage: { input: 10, output: 5, cacheRead: 100, cacheWrite: 20 },
            content: [
              { type: "toolCall", id: "c1", name: "bash", arguments: { command: "bun test" } },
              { type: "toolCall", id: "c2", name: "edit", arguments: { path: "a.ts" } },
            ],
          },
        },
        { type: "message", timestamp: "2026-05-01T10:00:06.000Z", message: { role: "toolResult", toolCallId: "c1", isError: true, content: [] } },
        {
          type: "message",
          timestamp: "2026-05-01T10:00:07.000Z",
          message: { role: "toolResult", toolCallId: "c2", isError: false, content: [], details: { diff: "  1 a\n- 2 b\n+ 2 c\n+ 3 d" } },
        },
      ]) + "{not json\nnull\n",
    );
    const session = await pi.readSession(path);
    expect(session).toMatchObject({
      id: "s1",
      title: "Fix the build",
      cwd: "/work",
      prompts: [{ text: "fix the build" }],
      models: { "claude-opus-4-8": 1 },
      tools: { shell: 1, edit: 1 },
      commands: [{ command: "bun test", ok: false }],
      tokens: { input: 130, output: 5 },
      linesAdded: 2,
      linesRemoved: 1,
      start: Date.parse("2026-05-01T10:00:01.000Z"),
      activeMs: 6000,
    });
  });
});

describe("amp", () => {
  test("skips empty thread stubs", async () => {
    const path = write("amp/T-stub.json", JSON.stringify({ v: 1, id: "T-stub", created: 1, messages: [] }));
    expect(await amp.readSession(path)).toBeUndefined();
  });

  test("reads a thread with tool results", async () => {
    const path = write(
      "amp/T-1.json",
      JSON.stringify({
        id: "T-1",
        created: 1_000_000,
        title: "Update deps",
        env: { initial: { trees: [{ uri: "file:///Users/me/app" }] } },
        messages: [
          { role: "user", meta: { sentAt: 1_001_000 }, content: [{ type: "text", text: "update the deps" }] },
          {
            role: "assistant",
            usage: { model: "claude-opus-4-6", inputTokens: 10, outputTokens: 7, cacheCreationInputTokens: 100, cacheReadInputTokens: 50, timestamp: new Date(1_005_000).toISOString() },
            content: [
              { type: "tool_use", id: "b1", name: "Bash", input: { cmd: "bun update" } },
              { type: "tool_use", id: "e1", name: "edit_file", input: { path: "a.ts" } },
              { type: "tool_use", id: "g1", name: "Grep", input: { pattern: "x" } },
            ],
          },
          {
            role: "user",
            content: [
              { type: "tool_result", toolUseID: "b1", run: { status: "done", result: { output: "", exitCode: 1 } } },
              { type: "tool_result", toolUseID: "e1", run: { status: "done", result: { diff: "```diff\n--- a\n+++ b\n@@ -1 +1,2 @@\n-x\n+y\n+z\n```" } } },
            ],
          },
        ],
      }),
    );
    expect(await amp.readSession(path)).toMatchObject({
      id: "T-1",
      title: "Update deps",
      cwd: "/Users/me/app",
      prompts: [{ at: 1_001_000, text: "update the deps" }],
      models: { "claude-opus-4-6": 1 },
      tools: { shell: 1, edit: 1, search: 1 },
      commands: [{ command: "bun update", ok: false }],
      tokens: { input: 160, output: 7 },
      linesAdded: 2,
      linesRemoved: 1,
      start: 1_000_000,
      end: 1_005_000,
    });
  });
});

describe("cursor", () => {
  test("parses the timestamp tag with its UTC offset", () => {
    expect(cursor.timestampTag("<timestamp>Friday, Jul 24, 2026, 4:06 PM (UTC+5:30)</timestamp>")).toBe(
      Date.parse("2026-07-24T10:36:00Z"),
    );
    expect(cursor.timestampTag("<timestamp>Monday, Jan 5, 2026, 12:15 AM (UTC-8)</timestamp>")).toBe(
      Date.parse("2026-01-05T08:15:00Z"),
    );
    expect(cursor.timestampTag("no tag")).toBe(0);
  });

  test("merges copies of a chat and keeps only typed queries", async () => {
    const user = (time: string, query: string) => ({
      role: "user",
      message: { content: [{ type: "text", text: `<timestamp>Friday, Jul 24, 2026, ${time} (UTC+5:30)</timestamp>\n<user_query>\n${query}\n</user_query>` }] },
    });
    const tool = (name: string, input: unknown) => ({ role: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
    const shared = [
      user("4:06 PM", "build the plan"),
      tool("Shell", { command: "ls" }),
      tool("CallMcpTool", { server: "cursor-app-control", toolName: "rename_chat", arguments: { title: "Seller plan" } }),
    ];
    const original = write(
      "cursor/projects/a/agent-transcripts/c1/c1.jsonl",
      jsonl([
        ...shared,
        tool("StrReplace", { path: "a.ts", old_string: "a\nb", new_string: "c" }),
        user("4:10 PM", "Briefly inform the user about the task result and perform any follow-up actions (if needed)."),
        user("4:12 PM", "ship it"),
        user("4:12 PM", "ship it"),
      ]),
    );
    // The same chat after it moved to another workspace: shared history, then new turns.
    const moved = write(
      "cursor/projects/b/agent-transcripts/c1/c1.jsonl",
      jsonl([...shared, user("4:20 PM", "now the docs"), tool("CallDynamicTool", { namespace: "cursor", toolName: "TodoWrite", arguments: {} })]),
    );
    const [session, ...rest] = await cursor.readSessions([original, moved]);
    expect(rest).toHaveLength(0);
    expect(session).toMatchObject({
      id: "c1",
      title: "Seller plan",
      prompts: [{ text: "build the plan" }, { text: "ship it" }, { text: "now the docs" }],
      tools: { shell: 1, mcp: 1, edit: 1, todo: 1 },
      commands: [{ command: "ls", ok: true }],
      linesAdded: 1,
      linesRemoved: 2,
      start: Date.parse("2026-07-24T10:36:00Z"),
    });
    expect(session?.prompts[0]?.at).toBe(Date.parse("2026-07-24T10:36:00Z"));
  });
});

describe("grok", () => {
  const update = (at: number, body: Record<string, unknown>) => ({
    timestamp: Math.floor(at / 1000),
    method: "session/update",
    params: { sessionId: "g1", update: body, _meta: { agentTimestampMs: at } },
  });

  test("skips subagent sessions", async () => {
    const dir = join(root, "grok/%2Fwork/sub");
    write("grok/%2Fwork/sub/summary.json", JSON.stringify({ info: { id: "sub", cwd: "/work" }, session_kind: "subagent" }));
    write("grok/%2Fwork/sub/updates.jsonl", "");
    expect(await grok.readSession(dir)).toBeUndefined();
  });

  test("reads prompts, commands, tokens and diffs from updates.jsonl", async () => {
    const dir = join(root, "grok/%2Fwork/g1");
    write("grok/%2Fwork/g1/summary.json", JSON.stringify({ info: { id: "g1", cwd: "/work" }, generated_title: "Fix login" }));
    const t = 1_790_000_000_000;
    write(
      "grok/%2Fwork/g1/updates.jsonl",
      jsonl([
        update(t, { sessionUpdate: "user_message_chunk", content: { type: "text", text: "fix the login" }, _meta: { promptIndex: 0 } }),
        update(t, {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "<runtime_info>running in T3 Code</runtime_info>\n<pull_request_linking>x</pull_request_linking>" },
          _meta: { promptIndex: 0 },
        }),
        // The reply streams in chunks until the first tool call; text after it is the work.
        update(t + 500, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "On it, " } }),
        update(t + 500, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "checking the tests." } }),
        update(t + 1000, { sessionUpdate: "tool_call", toolCallId: "c1", title: "run_terminal_command", rawInput: { command: "bun test" }, _meta: { "x.ai/tool": { name: "run_terminal_command" } } }),
        update(t + 1000, { sessionUpdate: "agent_message_chunk", content: { type: "text", text: " One fails." } }),
        update(t + 1000, { sessionUpdate: "tool_call", toolCallId: "c1", title: "run_terminal_command", rawInput: { command: "bun test" }, _meta: { "x.ai/tool": { name: "run_terminal_command" } } }),
        update(t + 2000, { sessionUpdate: "tool_call_update", toolCallId: "c1", status: "completed", rawOutput: { type: "Bash", exit_code: 1 } }),
        update(t + 3000, { sessionUpdate: "tool_call", toolCallId: "c2", title: "run_terminal_command", rawInput: { command: "bun dev" }, _meta: { "x.ai/tool": { name: "run_terminal_command" } } }),
        update(t + 4000, { sessionUpdate: "task_completed", task_snapshot: { task_id: "c2", exit_code: 0 } }),
        update(t + 5000, { sessionUpdate: "tool_call", toolCallId: "ws1", title: "Web search:", rawInput: { variant: "WebSearch" } }),
        update(t + 6000, { sessionUpdate: "tool_call", toolCallId: "e1", title: "search_replace", _meta: { "x.ai/tool": { name: "search_replace" } } }),
        update(t + 7000, { sessionUpdate: "tool_call_update", toolCallId: "e1", status: "completed", content: [{ type: "diff", path: "a.ts", oldText: "a\nb", newText: "c" }] }),
        update(t + 8000, {
          sessionUpdate: "turn_completed",
          usage: { inputTokens: 1000, outputTokens: 50, modelUsage: { "grok-4.6-build": { modelCalls: 3 } } },
        }),
        update(t + 60_000, {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "<t3_code_instructions>\nmode\n</t3_code_instructions>\n\n<user_request>\nship it\n</user_request>" },
          _meta: { promptIndex: 1 },
        }),
      ]),
    );
    expect(await grok.readSession(dir)).toMatchObject({
      id: "g1",
      title: "Fix login",
      cwd: "/work",
      prompts: [
        { at: t, text: "fix the login", reply: "On it, checking the tests." },
        { at: t + 60_000, text: "ship it" },
      ],
      models: { "grok-4.6-build": 3 },
      tools: { shell: 2, web: 1, edit: 1 },
      commands: [
        { command: "bun test", ok: false },
        { command: "bun dev", ok: true },
      ],
      tokens: { input: 1000, output: 50 },
      linesAdded: 1,
      linesRemoved: 2,
      start: t,
      end: t + 60_000,
      activeMs: 60_000,
    });
  });
});
