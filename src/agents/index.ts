import { AGENT_NAMES, type AgentId, type SessionSummary } from "../types.ts";
import * as amp from "./amp.ts";
import * as claude from "./claude.ts";
import * as codex from "./codex.ts";
import * as cursor from "./cursor.ts";
import * as grok from "./grok.ts";
import * as opencode from "./opencode.ts";
import * as pi from "./pi.ts";
import * as t3code from "./t3code.ts";

const READERS: Record<Exclude<AgentId, "t3code">, () => Promise<SessionSummary[]>> = {
  claude: claude.sessions,
  codex: codex.sessions,
  opencode: opencode.sessions,
  pi: pi.sessions,
  amp: amp.sessions,
  cursor: cursor.sessions,
  grok: grok.sessions,
};

/**
 * Every local session from every agent that has at least one prompt. One broken agent only costs its own sessions.
 * Sessions T3 Code ran count as T3 Code once, under the T3 thread id so other machines' copies dedupe:
 * the agent's own session file when it still exists, else T3's thread. Native sessions of threads T3
 * skipped (subagents, delegated tasks) are child work and dropped.
 */
export async function allSessions(): Promise<SessionSummary[]> {
  const [t3, ...read] = await Promise.all([
    attempt("t3code", () => t3code.read(), { sessions: [], native: new Map<string, string>() }),
    ...Object.entries(READERS).map(([agent, sessions]) => attempt(agent as AgentId, sessions, [])),
  ]);
  const threads = new Map(t3.sessions.map((thread) => [thread.id, thread]));
  const linked = new Set<string>();
  const native: SessionSummary[] = [];
  for (const session of read.flat()) {
    const threadId = t3.native.get(session.id);
    if (!threadId) {
      native.push(session);
      continue;
    }
    linked.add(threadId);
    const thread = threads.get(threadId);
    if (thread) native.push({ ...session, agent: "t3code", id: thread.id, title: thread.title || session.title, prompts: thread.prompts });
  }
  const unlinked = t3.sessions.filter((thread) => !linked.has(thread.id));
  return unique([...native, ...unlinked].filter((session) => session.prompts.length > 0));
}

async function attempt<T>(agent: AgentId, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`warning: could not read ${AGENT_NAMES[agent]} sessions: ${reason}\n`);
    return fallback;
  }
}

/** One session per agent and id, the first one seen: the same session can come from two machines or two links. */
export function unique(sessions: SessionSummary[]): SessionSummary[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    const key = `${session.agent}:${session.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
