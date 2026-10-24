import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commits } from "./git.ts";

test("finds the user's commits from a session's folder, and the agents that co-signed them", async () => {
  const repo = await mkdtemp(join(tmpdir(), "aw-git-"));
  const git = (...args: string[]) => Bun.spawnSync(["git", "-C", repo, ...args], { env: { ...process.env, GIT_AUTHOR_DATE: "2026-05-01T12:00:00", GIT_COMMITTER_DATE: "2026-05-01T12:00:00" } });
  git("init", "-q");
  git("config", "user.email", "me@example.com");
  git("config", "user.name", "Me");
  git("commit", "-q", "--allow-empty", "-m", "feat: one\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>\nCo-authored-by: Cursor Agent <cursoragent@cursor.com>");
  git("commit", "-q", "--allow-empty", "-m", "fix: two\n\nCo-authored-by: Sam <sam@example.com>");
  git("-c", "user.email=other@example.com", "commit", "-q", "--allow-empty", "-m", "not mine");
  await Bun.write(join(repo, "src", "x.ts"), "");

  const found = await commits([join(repo, "src"), repo, "/no/such/folder"], 2026);
  expect(found.map((commit) => commit.coAuthors).sort()).toEqual([[], ["Claude", "Cursor"]]);
  expect(await commits([repo], 2025)).toEqual([]);
});
