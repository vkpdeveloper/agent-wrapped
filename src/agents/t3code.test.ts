import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readDatabase } from "./t3code.ts";

function database() {
  const db = new Database(":memory:");
  db.run(`create table orchestration_v2_projection_threads (thread_id text, project_id text, title text, payload_json text)`);
  db.run(`create table projection_projects (project_id text, workspace_root text)`);
  db.run(`create table orchestration_v2_projection_provider_threads (thread_id text, payload_json text)`);
  db.run(`create table provider_session_runtime (thread_id text, resume_cursor_json text)`);
  db.run(`create table orchestration_v2_projection_turn_items (turn_item_id text, thread_id text, ordinal integer, type text, status text, payload_json text)`);
  db.run(`insert into projection_projects values ('p', '/Users/me/app')`);
  return db;
}

function thread(db: Database, id: string, payload: Record<string, unknown>) {
  db.run(`insert into orchestration_v2_projection_threads values (?, 'p', ?, ?)`, [id, `Thread ${id}`, JSON.stringify(payload)]);
}

let ordinal = 0;
function item(db: Database, threadId: string, type: string, payload: Record<string, unknown>, status = "completed") {
  ordinal++;
  db.run(`insert into orchestration_v2_projection_turn_items values (?, ?, ?, ?, ?, ?)`, [
    `item-${ordinal}`,
    threadId,
    ordinal,
    type,
    status,
    JSON.stringify({ startedAt: new Date(Date.UTC(2026, 0, 1, 10, ordinal)).toISOString(), ...payload }),
  ]);
}

test("reads typed prompts, commands, edits and tools from T3 threads", () => {
  const db = database();
  thread(db, "t1", { creationSource: "web", modelSelection: { model: "gpt-5.5" } });
  item(db, "t1", "user_message", { createdBy: "user", text: "fix the build" });
  item(db, "t1", "user_message", { createdBy: "system", text: "Scheduled run" });
  item(db, "t1", "command_execution", { input: "/bin/zsh -lc 'bun test'", exitCode: 1 });
  item(db, "t1", "command_execution", { input: "ls" }, "failed");
  item(db, "t1", "command_execution", { input: "git status", exitCode: 0 });
  item(db, "t1", "file_change", { diffStr: "@@ -1,2 +1,2 @@\n-a\n+b\n c" });
  item(db, "t1", "file_change", { diffStr: "new\nfile\n" });
  item(db, "t1", "dynamic_tool", { toolName: "t3-code.preview_open" });
  item(db, "t1", "dynamic_tool", { toolName: "Updating plan", input: { variant: "TodoWrite" } });
  item(db, "t1", "user_message", { createdBy: "user", text: "no, use bun" });

  const [session] = readDatabase(db).sessions;
  expect(session?.agent).toBe("t3code");
  expect(session?.cwd).toBe("/Users/me/app");
  expect(session?.prompts.map((p) => p.text)).toEqual(["fix the build", "no, use bun"]);
  expect(session?.commands).toEqual([
    { command: "bun test", ok: false },
    { command: "ls", ok: false },
    { command: "git status", ok: true },
  ]);
  expect([session?.linesAdded, session?.linesRemoved]).toEqual([3, 1]);
  expect(session?.tools).toEqual({ shell: 3, edit: 2, mcp: 1, todo: 1 });
  expect(session?.models).toEqual({ "gpt-5.5": 2 });
  expect(session?.activeMs).toBe(9 * 60_000);
});

test("skips child threads and maps native sessions to their thread", () => {
  const db = database();
  thread(db, "subagent", { creationSource: "provider" });
  thread(db, "delegated", { creationSource: "mcp" });
  thread(db, "main", { creationSource: "web", worktreePath: "/Users/me/.t3/worktrees/app/fix" });
  for (const id of ["subagent", "delegated", "main"]) item(db, id, "user_message", { createdBy: "user", text: "go" });
  db.run(`insert into orchestration_v2_projection_provider_threads values ('main', '{"nativeThreadRef":{"nativeId":"codex-1"}}')`);
  db.run(`insert into provider_session_runtime values ('main', '{"threadId":"main","resume":"claude-1"}')`);

  const { sessions, native } = readDatabase(db);
  expect(sessions.map((s) => [s.id, s.cwd])).toEqual([["main", "/Users/me/.t3/worktrees/app/fix"]]);
  expect(native.get("codex-1")).toEqual({ thread: "main", title: "Thread main" });
  expect(native.get("claude-1")?.thread).toBe("main");
});
