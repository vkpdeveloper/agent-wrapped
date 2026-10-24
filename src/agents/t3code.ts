import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentId, SessionSummary } from "../types.ts";
import { addReply, cleanPrompt, count, diffLines, emptySummary, lineCount, span, toolKind } from "./core.ts";

// T3 Code is an app that drives harnesses (Codex, Claude Code, Grok Build,
// OpenCode and more), so it is not counted as an agent itself: every thread
// counts as the harness that ran it. T3 keeps each thread in
// ~/.t3/userdata/statev2.sqlite as normalized turn items: typed prompts, shell
// commands with exit codes, file changes, tools. The harness usually also wrote
// its own session file. Those are richer (tokens, models per turn), so `native`
// maps each native session id to its T3 thread and index.ts keeps the native
// session with T3's prompts: T3 knows which messages the person typed and which
// an agent or automation sent. A thread's own summary is used when no native
// session survives (Claude Code deletes its history after 30 days, and some
// harnesses T3 drives have no reader here).

export interface T3Code {
  /** Every top-level thread of a known harness, including ones with no typed prompt. */
  sessions: SessionSummary[];
  /** Native session id (a Codex rollout, a Claude Code session, ...) -> id of the T3 thread that ran it. */
  native: Map<string, string>;
}

interface ThreadRow {
  id: string;
  title: string;
  source: string | null;
  driver: string | null;
  cwd: string | null;
  model: string | null;
}

interface ItemRow {
  thread: string;
  type: string;
  started: string | null;
  completed: string | null;
  by: string | null;
  text: string | null;
  exit: number | null;
  status: string;
  diff: string | null;
  tool: string | null;
  variant: string | null;
}

const ITEM_KINDS: Record<string, string> = {
  file_change: "edit",
  file_search: "search",
  web_search: "web",
  subagent: "task",
  todo_list: "todo",
};

/** T3's provider drivers -> the harness they run. */
const DRIVERS: Record<string, AgentId> = {
  claudeAgent: "claude",
  codex: "codex",
  opencode: "opencode",
  pi: "pi",
  amp: "amp",
  cursor: "cursor",
  grok: "grok",
  devin: "devin",
  muse: "muse",
};

export const DATABASE = join(homedir(), ".t3", "userdata", "statev2.sqlite");

export async function read(path = DATABASE): Promise<T3Code> {
  if (!existsSync(path)) return { sessions: [], native: new Map() };
  const db = new Database(path, { readonly: true });
  try {
    return readDatabase(db);
  } finally {
    db.close();
  }
}

export function readDatabase(db: Database): T3Code {
  const threads = db
    .query<ThreadRow, []>(
      `select t.thread_id as id, t.title,
         json_extract(t.payload_json, '$.creationSource') as source,
         coalesce(
           (select json_extract(payload_json, '$.driver') from orchestration_v2_projection_provider_threads
             where thread_id = t.thread_id order by last_run_ordinal desc limit 1),
           (select provider_name from provider_session_runtime where thread_id = t.thread_id),
           json_extract(t.payload_json, '$.modelSelection.instanceId')
         ) as driver,
         coalesce(json_extract(t.payload_json, '$.worktreePath'), p.workspace_root) as cwd,
         json_extract(t.payload_json, '$.modelSelection.model') as model
       from orchestration_v2_projection_threads t
       left join projection_projects p on p.project_id = t.project_id`,
    )
    .all();

  const native = new Map<string, string>();
  const links = db
    .query<{ native: string | null; thread: string | null }, []>(
      `select json_extract(payload_json, '$.nativeThreadRef.nativeId') as native, thread_id as thread
         from orchestration_v2_projection_provider_threads
       union all
       select coalesce(json_extract(resume_cursor_json, '$.resume'), json_extract(resume_cursor_json, '$.threadId'),
                       json_extract(resume_cursor_json, '$.sessionId')), thread_id
         from provider_session_runtime`,
    )
    .all();
  for (const link of links) {
    if (link.native && link.thread) native.set(link.native, link.thread);
  }

  const items = Map.groupBy(
    db
      .query<ItemRow, []>(
        `select thread_id as thread, type, status,
           json_extract(payload_json, '$.startedAt') as started,
           json_extract(payload_json, '$.completedAt') as completed,
           json_extract(payload_json, '$.createdBy') as by,
           case when type in ('user_message', 'assistant_message') then json_extract(payload_json, '$.text')
                when type = 'command_execution' then json_extract(payload_json, '$.input') end as text,
           json_extract(payload_json, '$.exitCode') as exit,
           case type when 'file_change' then json_extract(payload_json, '$.diffStr') end as diff,
           json_extract(payload_json, '$.toolName') as tool,
           json_extract(payload_json, '$.input.variant') as variant
         from orchestration_v2_projection_turn_items
         where turn_item_id not like '%workspace-preparation%'
         order by thread_id, ordinal`,
      )
      .all(),
    (item) => item.thread,
  );

  const sessions: SessionSummary[] = [];
  for (const thread of threads) {
    // Subagents an agent spawned and tasks delegated over T3's MCP tools are child work, not sessions.
    if (thread.source === "provider" || thread.source === "mcp") continue;
    const agent = DRIVERS[thread.driver ?? ""];
    if (agent) sessions.push(summarize(agent, thread, items.get(thread.id) ?? []));
  }
  return { sessions, native };
}

function summarize(agent: AgentId, thread: ThreadRow, items: ItemRow[]): SessionSummary {
  const summary = emptySummary(agent, thread.id);
  summary.title = thread.title;
  summary.cwd = thread.cwd ?? "";
  const times: number[] = [];
  for (const item of items) {
    times.push(Date.parse(item.started ?? ""), Date.parse(item.completed ?? ""));
    switch (item.type) {
      case "user_message": {
        // Automations and agents post messages too.
        const text = item.by === "user" ? cleanPrompt(item.text ?? "") : "";
        if (text) summary.prompts.push({ at: Date.parse(item.started ?? ""), text });
        break;
      }
      case "assistant_message":
        addReply(summary, item.text ?? "");
        break;
      case "command_execution":
        count(summary.tools, "shell");
        summary.commands.push({ command: unwrapShell(item.text ?? ""), ok: item.status !== "failed" && (item.exit ?? 0) === 0 });
        break;
      case "dynamic_tool":
        count(summary.tools, dynamicKind(item));
        break;
      case "file_change": {
        count(summary.tools, "edit");
        // Edits are unified diffs; new files are their whole content.
        const diff = item.diff ?? "";
        const lines = /^@@|\n@@/.test(diff) ? diffLines(diff) : { added: lineCount(diff), removed: 0 };
        summary.linesAdded += lines.added;
        summary.linesRemoved += lines.removed;
        break;
      }
      default: {
        const kind = ITEM_KINDS[item.type];
        if (kind) count(summary.tools, kind);
      }
    }
  }
  if (thread.model) count(summary.models, thread.model, Math.max(summary.prompts.length, 1));
  return { ...summary, ...span(times) };
}

/** Tools an agent reports through T3 as-is: MCP calls are "server.tool" or "mcp__server__tool". */
function dynamicKind(item: ItemRow): string {
  if (item.variant === "UseTool" || item.tool?.includes(".")) return "mcp";
  if (item.variant === "TodoWrite") return "todo";
  return toolKind(item.tool ?? "unknown");
}

/** Codex reports `/bin/zsh -lc '<script>'`. */
function unwrapShell(command: string): string {
  return /^\/bin\/(?:ba|z)?sh -lc '([\s\S]*)'$/.exec(command)?.[1] ?? command;
}
