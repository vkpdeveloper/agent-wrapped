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
 * the agent's own session file when it still exists, else T3's thread.
 */
export async function allSessions(): Promise<SessionSummary[]> {
  const [t3, ...read] = await Promise.all([
    attempt("t3code", () => t3code.read(), { sessions: [], native: new Map() }),
    ...Object.entries(READERS).map(([agent, sessions]) => attempt(agent as AgentId, sessions, [])),
  ]);
  const linked = new Set<string>();
  const native = read.flat().map((session) => {
    const thread = t3.native.get(session.id);
    if (!thread) return session;
    linked.add(thread.thread);
    return { ...session, agent: "t3code" as const, id: thread.thread, title: thread.title || session.title };
  });
  const threads = t3.sessions.filter((session) => !linked.has(session.id));
  return unique([...native, ...threads].filter((session) => session.prompts.length > 0));
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

async function attempt<T>(agent: AgentId, read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`warning: could not read ${AGENT_NAMES[agent]} sessions: ${reason}\n`);
    return fallback;
  }
}
