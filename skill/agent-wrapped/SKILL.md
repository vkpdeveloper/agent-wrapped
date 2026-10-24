---
name: agent-wrapped
description: Make a Spotify Wrapped-style video of the user's year with coding agents (Claude Code, Codex, OpenCode, Pi, Amp, Cursor, Grok Build, and the ones T3 Code runs) from the session history on this machine or several, with stats, their agent persona, and the lessons hidden in how often they corrected the agent. Use when the user asks for their agent wrapped, coding wrapped, AI wrapped, year in review with agents, or stats about how they use coding agents.
---

# Agent Wrapped

Run everything through `wrapped.sh` next to this file. On first use it downloads
the latest `agent-wrapped` release for this OS and CPU from GitHub into
`~/.local/share/agent-wrapped` (a 40 to 60 MB download), and it checks for a newer
release at most once a day, so never install anything by hand. The first video on
a machine also downloads Chrome Headless Shell, so allow a few minutes for it.

Everything is read and rendered locally. Nothing is uploaded.

## 1. Read the history

```sh
<skill-dir>/wrapped.sh stats -o "${TMPDIR:-/tmp}/wrapped.json"
```

It finds every supported agent with local history, ranks them by session count,
and prints a one-line summary. Add `--year 2025` for another year and
`--name "..."` if the user gives a name for the first card. The JSON holds
prompt excerpts, so keep it in the temp directory, never in a project.

T3 Code is an app that runs these harnesses, not an agent: each T3 thread
counts once, as the harness that ran it.

### Other machines

When the user wants every machine counted, export each one's sessions over SSH
(it installs the binary there the same way) and add them:

```sh
ssh <host> 'curl -fsSL https://raw.githubusercontent.com/vkpdeveloper/agent-wrapped/main/skill/agent-wrapped/wrapped.sh | sh -s -- sessions --year <year>' > "${TMPDIR:-/tmp}/wrapped-<host>.json"
<skill-dir>/wrapped.sh stats --add "${TMPDIR:-/tmp}/wrapped-<host>.json" --add ... -o "${TMPDIR:-/tmp}/wrapped.json"
```

Use only hosts the user named or already reaches by SSH alias. Exports mask
secrets and show the home directory as `~`. A session found on two machines
counts once.

## 2. Write the lessons

Read `corrections.samples` in the JSON: real prompts where the user pushed back
on their agent. Group them by what the agent kept getting wrong and write up to
3 `lessons`, most frequent first:

- `rule`: an instruction the user could paste into CLAUDE.md or AGENTS.md, at
  most 8 words, imperative and concrete ("Use bun, never npm", "Run the tests
  before saying done", "Ask before deleting files").
- `count`: how many of the samples that rule covers. Count honestly; the
  video prints it.

Skip one-off complaints and anything that names a person, client or secret.
Leave `lessons` empty if no pattern repeats. You may sharpen `persona.line`, but
keep its number exactly as computed. Save the edited JSON.

## 3. Render

```sh
<skill-dir>/wrapped.sh render "${TMPDIR:-/tmp}/wrapped.json" -o ~/Desktop/agent-wrapped-<year>.mp4
```

Use `~/Desktop` when it exists, otherwise the current directory, unless the user
names a place. `--format square` (1080x1080) for the X or LinkedIn feed; the
default is vertical (1080x1920) for Stories, Reels and TikTok.

## Report

Give the video path, the headline numbers (hours, sessions, the #1 agent), the
persona, and the lessons. Offer to add the lessons to their CLAUDE.md or
AGENTS.md. Remind them that the video shows project names and their top
phrases, so they should watch it before posting.
