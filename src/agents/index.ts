import { AGENT_NAMES, type AgentId, type SessionSummary } from "../types.ts";
import * as amp from "./amp.ts";
import * as claude from "./claude.ts";
import * as codex from "./codex.ts";
import * as cursor from "./cursor.ts";
import * as grok from "./grok.ts";
import * as opencode from "./opencode.ts";
import * as pi from "./pi.ts";

const READERS: Record<AgentId, () => Promise<SessionSummary[]>> = {
  claude: claude.sessions,
  codex: codex.sessions,
  opencode: opencode.sessions,
  pi: pi.sessions,
  amp: amp.sessions,
  cursor: cursor.sessions,
  grok: grok.sessions,
};

/** Every local session from every agent that has at least one prompt. One broken agent only costs its own sessions. */
export async function allSessions(): Promise<SessionSummary[]> {
  const read = await Promise.all(
    Object.entries(READERS).map(async ([agent, sessions]) => {
      try {
        return await sessions();
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        process.stderr.write(`warning: could not read ${AGENT_NAMES[agent as AgentId]} sessions: ${reason}\n`);
        return [];
      }
    }),
  );
  return read.flat().filter((session) => session.prompts.length > 0);
}
