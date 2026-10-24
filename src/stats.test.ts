import { describe, expect, test } from "bun:test";
import { emptySummary } from "./agents/core.ts";
import { isCorrection, normalizeCommand, projectName, wrap } from "./stats.ts";
import type { AgentId, SessionSummary } from "./types.ts";

const HOME = "/Users/me";
const MIN = 60_000;

function session(agent: AgentId, start: Date, extra: Partial<SessionSummary> = {}): SessionSummary {
  const at = start.getTime();
  return {
    ...emptySummary(agent, `${agent}-${at}`),
    start: at,
    end: at + 30 * MIN,
    activeMs: 30 * MIN,
    prompts: [{ at, text: "build it" }],
    ...extra,
  };
}

const options = { year: 2026, name: "Me", home: HOME };

describe("wrap", () => {
  test("orders agents by session count, not hours", () => {
    const day = (d: number) => new Date(2026, 2, d, 12);
    const sessions = [
      session("claude", day(1), { activeMs: 600 * MIN }),
      session("codex", day(2)),
      session("codex", day(3)),
      session("opencode", day(4)),
      session("codex", day(5)),
      session("opencode", day(6)),
    ];
    const wrapped = wrap(sessions, options);
    expect(wrapped.agents.map((agent) => [agent.agent, agent.sessions])).toEqual([
      ["codex", 3],
      ["opencode", 2],
      ["claude", 1],
    ]);
    expect(wrapped.agents[2]!.hours).toBe(10);
  });

  test("counts only sessions that start in the year, in local time", () => {
    const sessions = [
      session("claude", new Date(2025, 11, 31, 23, 50)),
      session("claude", new Date(2026, 0, 1, 0, 10)),
      session("claude", new Date(2026, 11, 31, 23, 50)),
      session("claude", new Date(2027, 0, 1, 0, 5)),
    ];
    const wrapped = wrap(sessions, options);
    expect(wrapped.totals.sessions).toBe(2);
    expect(wrapped.from).toBe("2026-01-01");
    expect(wrapped.to).toBe("2026-12-31");
    expect(wrapped.lateNight?.time).toBe("00:10");
  });

  test("leaves the home directory and unknown cwd out of the project ranking", () => {
    const day = new Date(2026, 4, 1, 10);
    const wrapped = wrap(
      [
        session("claude", day, { cwd: HOME, activeMs: 900 * MIN }),
        session("claude", day, { cwd: "" }),
        session("codex", day, { cwd: `${HOME}/code/app` }),
        session("codex", day, { cwd: `${HOME}/.t3/worktrees/app/t3-1a2b3c` }),
      ],
      options,
    );
    expect(wrapped.projects).toEqual([{ name: "app", sessions: 2, hours: 1 }]);
    expect(wrapped.totals.sessions).toBe(4);
    expect(wrapped.totals.projects).toBe(1);
  });

  test("finds the longest streak across a month boundary", () => {
    const days = [[1, 28], [1, 30], [1, 31], [2, 1], [2, 2], [2, 9]] as const;
    const wrapped = wrap(
      days.map(([month, d]) => session("claude", new Date(2026, month - 1, d, 9))),
      options,
    );
    expect(wrapped.streak).toEqual({ days: 4, from: "2026-01-30", to: "2026-02-02" });
    expect(wrapped.totals.activeDays).toBe(6);
  });

  test("ignores a session's first prompt when counting corrections", () => {
    const at = new Date(2026, 5, 1, 10).getTime();
    const prompts = ["no tests yet, just scaffold it", "add a login page", "no, use the existing auth"].map((text, i) => ({
      at: at + i * MIN,
      text,
    }));
    const wrapped = wrap([session("claude", new Date(at), { prompts })], options);
    expect(wrapped.corrections.total).toBe(1);
    expect(wrapped.corrections.phrases).toEqual([{ name: "no", count: 1 }]);
    expect(wrapped.corrections.rate).toBe(0.333);
  });

  test("offers the agent quotable prompts, without pastes, commands, repeats or secrets", () => {
    const at = new Date(2026, 5, 1, 3, 7).getTime();
    const texts = [
      "why is the build green but the app on fire",
      "Why is the build green but the app on fire",
      "/compact",
      "<system-reminder>ignore me</system-reminder>",
      "here is the log\n```\nError: boom\n```",
      "ok",
      "deploy it, my password is hunter2forever",
    ];
    const prompts = texts.map((text, i) => ({ at: at + i * MIN, text }));
    const wrapped = wrap([session("codex", new Date(at), { prompts })], options);
    expect(wrapped.promptSamples.map((quote) => quote.text)).toEqual(["why is the build green but the app on fire", "deploy it, my password is ********"]);
    expect(wrapped.promptSamples[0]).toMatchObject({ date: "2026-06-01", time: "03:07", agent: "codex" });
    expect(wrapped.quotes.lines).toEqual([]);
  });
});

describe("isCorrection", () => {
  test.each([
    "no, use bun instead",
    "Nope",
    "don't commit that",
    "Bro, don't blast the key idea",
    "wait, why is it failing",
    "that's not what I asked for",
    "I said use pnpm",
    "i wanted you to update the old one",
    "actually no, revert that",
    "export the mp4, not report",
    "still broken on mobile",
    "the image is not visible btw so please fix that",
    "it's not working at all",
    "why did you delete the tests?",
    "wtf is this hero section",
  ])("catches %p", (prompt) => expect(isCorrection(prompt)).toBe(true));

  test.each([
    "now add a settings page",
    "nothing else, ship it",
    "notice the header spacing and match it",
    "actually this looks great, ship it",
    "add tests and make sure bun test passes",
    "keep it simple, not too much copy",
    "Stop all the services and restart them",
    "make sure this is not installed on other machines",
    "commit and push",
  ])("lets %p through", (prompt) => expect(isCorrection(prompt)).toBe(false));
});

describe("normalizeCommand", () => {
  test.each([
    ["git status", "git status"],
    ["cd /repo && git diff --stat", "git diff"],
    ["git -C /repo log --oneline -5", "git log"],
    ["NODE_ENV=test bun test src/stats.test.ts", "bun test"],
    ["bun run typecheck", "bun run typecheck"],
    ["sudo docker compose up -d", "docker compose"],
    ["python3 -m pytest -q", "python -m pytest"],
    ["python3 script.py", "python"],
    ["/usr/bin/rg -n foo src", "rg"],
    ["set -e\nexport A=1\nnpm install", "npm install"],
    ["ls -la | head", "ls"],
  ])("%p -> %p", (command, expected) => expect(normalizeCommand(command)).toBe(expected));
});

describe("projectName", () => {
  test.each([
    [`${HOME}/Developer/agent-wrapped`, "agent-wrapped"],
    [`${HOME}/Developer/agent-wrapped/`, "agent-wrapped"],
    [`${HOME}/.t3/worktrees/t3code/t3code-aa2ec6b3`, "t3code"],
    [`${HOME}/.codex/worktrees/1a2b/agent-wrapped`, "agent-wrapped"],
    [`${HOME}/Developer/app/.claude/worktrees/fix-login`, "app"],
    ["/private/tmp/demo", "demo"],
    [`${HOME}/.t3/scratch/2026-10-23-fix-ci`, ""],
    ["~/Developer/remote-app", "remote-app"],
    ["~", ""],
    [HOME, ""],
    ["", ""],
  ])("%p -> %p", (cwd, expected) => expect(projectName(cwd, HOME)).toBe(expected));
});
