# agent-wrapped

[![skills.sh](https://skills.sh/b/vkpdeveloper/agent-wrapped)](https://skills.sh/vkpdeveloper/agent-wrapped)

Your year with coding agents, as a Spotify Wrapped-style video. Your agent reads
your session history and picks your best lines; the video gets its own soundtrack.

[![Demo: the 30 second social cut, with sound](docs/demo.gif)](docs/demo.mp4)

## Install

```sh
npx skills add vkpdeveloper/agent-wrapped
```

Then ask your agent:

- "make my agent wrapped"
- "make a short agent wrapped I can post"
- "make my agent wrapped, but blur my project names"
- "make my agent wrapped across all my machines"

The skill downloads the right binary for your machine on first use and keeps it
updated. Works on macOS, Linux and Windows.

## What you get

- **MP4** in vertical (1080x1920) or square (1080x1080), with a soundtrack timed to every cut
- **The full wrap**: hours, your #1 agent, top projects, 3am sessions, tools, and how often you told your agent "no"
- **Social cut**: 30 seconds, first person, no projects, tools or models, ending on "What's yours?"
- **Your own words**: your agent picks the lines you typed that sound most like you
- **Lessons and a persona**: the rules that would have saved you the trouble, and who that makes you
- **Every agent**: Claude Code, Codex, OpenCode, Pi, Amp, Cursor, Grok Build, and the threads T3 Code runs with them
- **Private**: nothing is uploaded, secrets show up as `********`, and `--blur-projects` hides project names

## CLI

```sh
curl -fsSL https://raw.githubusercontent.com/vkpdeveloper/agent-wrapped/main/skill/agent-wrapped/wrapped.sh | sh -s -- --version

agent-wrapped agents                          # agents found, most sessions first
agent-wrapped -o wrapped.mp4                  # this year, vertical
agent-wrapped --year 2025 --format square
agent-wrapped stats -o wrapped.json           # the numbers, to edit lessons, quotes or persona
agent-wrapped render wrapped.json --social    # the 30 second cut to post
agent-wrapped render wrapped.json --blur-projects
ssh laptop agent-wrapped sessions > laptop.json
agent-wrapped --add laptop.json               # another machine, duplicates counted once
```

Run `agent-wrapped --help` for everything else.

## License

MIT. Rendering uses [Remotion](https://www.remotion.dev/license), which is free
for individuals and small teams. Larger companies need a Remotion company license.
