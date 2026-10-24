// The user's commits this year in the repos their sessions ran in, with the
// agents that co-signed each one. Read with `git log` on this machine only.
import { existsSync } from "node:fs";
import type { Commit } from "./types.ts";

/** Co-author trailers that name an agent, and the name the video shows. People are not counted. */
const AGENTS: [RegExp, string][] = [
  [/claude|anthropic/i, "Claude"],
  [/cursor/i, "Cursor"],
  [/codex|openai|chatgpt/i, "Codex"],
  [/copilot/i, "Copilot"],
  [/gemini|google-labs-jules/i, "Gemini"],
  [/devin/i, "Devin"],
  [/grok|xai/i, "Grok"],
  [/\bamp\b|ampcode/i, "Amp"],
  [/opencode/i, "OpenCode"],
  [/aider/i, "Aider"],
];

async function git(cwd: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", "-C", cwd, ...args], { stdout: "pipe", stderr: "ignore" });
  const out = await new Response(proc.stdout).text();
  return (await proc.exited) === 0 ? out : "";
}

export async function commits(cwds: string[], year: number): Promise<Commit[]> {
  const roots = new Set(
    await Promise.all([...new Set(cwds)].filter((cwd) => existsSync(cwd)).map(async (cwd) => (await git(cwd, ["rev-parse", "--show-toplevel"])).trim())),
  );
  roots.delete("");
  const found = new Map<string, Commit>();
  await Promise.all(
    [...roots].map(async (root) => {
      const email = (await git(root, ["config", "user.email"])).trim();
      if (!email) return;
      const log = await git(root, ["log", "--all", `--since=${year}-01-01`, `--until=${year + 1}-01-01`, `--author=${email}`, "--format=%H%x1f%(trailers:key=Co-authored-by,valueonly,separator=%x1d)%x1e"]);
      for (const entry of log.split("\x1e")) {
        const [hash, trailers = ""] = entry.trim().split("\x1f");
        if (!hash) continue;
        const names = trailers.split("\x1d").flatMap((trailer) => AGENTS.find(([pattern]) => pattern.test(trailer))?.[1] ?? []);
        found.set(hash, { hash, coAuthors: [...new Set(names)] });
      }
    }),
  );
  return [...found.values()];
}
