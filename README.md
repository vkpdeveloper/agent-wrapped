# agent-wrapped

Your year with coding agents, as a Wrapped video. Hours, your #1 agent, top
projects, your 3am sessions, how often you told your agent "no", and the rules
that would have saved you the trouble.

## Install

```sh
npx skills add vkpdeveloper/agent-wrapped
```

Then ask your agent:

- "make my agent wrapped"
- "make a square agent wrapped for 2025"

The skill downloads the right binary for your machine on first use and keeps it
updated. Works on macOS, Linux and Windows.

## What it reads

T3 Code, Claude Code, Codex, OpenCode, Pi, Amp, Cursor and Grok Build, whichever
have history on your machine, ranked by how much you use them. Everything stays
local: nothing is uploaded, and secrets in prompts are masked.

Use more than one machine? Ask for "my agent wrapped across all my machines"
and the skill collects each one's sessions over SSH.

## CLI

```sh
curl -fsSL https://raw.githubusercontent.com/vkpdeveloper/agent-wrapped/main/skill/agent-wrapped/wrapped.sh | sh -s -- --version

agent-wrapped agents                     # agents found, most sessions first
agent-wrapped -o wrapped.mp4             # this year, vertical
agent-wrapped --year 2025 --format square
agent-wrapped stats -o wrapped.json      # the numbers, to edit lessons or persona
agent-wrapped render wrapped.json -o wrapped.mp4

ssh laptop agent-wrapped sessions > laptop.json   # another machine's sessions
agent-wrapped --add laptop.json                   # counted together, duplicates once
```

## License

MIT. Rendering uses [Remotion](https://www.remotion.dev/license), which is free
for individuals and small teams. Larger companies need a Remotion company license.
