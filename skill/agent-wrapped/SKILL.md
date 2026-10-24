---
name: agent-wrapped
description: Make a Spotify Wrapped-style video of the user's year with coding agents (Claude Code, Codex, OpenCode, Pi, Amp, Cursor, Grok Build, and the ones T3 Code runs) from the session history on this machine or several, with stats, their agent persona, and the lessons hidden in how often they corrected the agent, or a short format made to post (dev rage, the agent that would not listen, who signed their commits, the grind, managing a team of agents, the funniest things their agents said back). Use when the user asks for their agent wrapped, coding wrapped, AI wrapped, year in review with agents, a roast of how they use agents, their agents' group chat, or stats about how they use coding agents.
---

# Agent Wrapped

Run everything through `wrapped.sh` next to this file. On first use it downloads
the latest `agent-wrapped` release for this OS and CPU from GitHub into
`~/.local/share/agent-wrapped` (a 40 to 60 MB download), and it checks for a newer
release at most once a day, so never install anything by hand. The first video on
a machine also downloads Chrome Headless Shell, so allow a few minutes for it.

On Windows, `wrapped.sh` works from Git Bash. From PowerShell with no `sh`, run
`powershell -ExecutionPolicy Bypass -File <skill-dir>/wrapped.ps1` with the same
arguments everywhere below; both share one install.

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

## 2. Pick the video

Unless the user already said which one, offer the menu: for each format, what
it looks like, with their own numbers from the JSON as the hook. Recommend the
one whose numbers are most extreme, then stop and wait for them to pick one or
several. Never pick for them unless they told you to.

When they named a format, or told you not to ask, make that one, and in the
report list the other formats their numbers suit, a line each with its hook,
so they can ask for more. Nothing is recounted: each extra format is its own
jokes (step 5) and one render.

`previews/<cut>.jpg` next to this file is a frame of each format. If you can
show images, show the previews of the formats you offer.

| `--cut` | What it looks like | Music | Hook from the JSON |
| --- | --- | --- | --- |
| `full` | The whole year, about 50s, Spotify Wrapped style: big numbers on green, agent bars with their logos, projects, a 3am clock, lessons, persona | Future bass | `totals.hours`, `agents[0].name` |
| `social` | 30s, first person ("I spent 724 hours"): giant numbers on black and green, their own lines, ends on "What's yours?" | Big room EDM | `totals.hours`, `persona.title` |
| `rage` | A desk on fire, a swear counter, a censored leaderboard of their words, the peak month, air horns | Rage trap | `swears.total`, `swears.words` |
| `loop` | "I told my agent no 16 times": their pushback from that session as chat bubbles, then the retries | Glitch hop | `loop.corrections`, `loop.retries` |
| `credit` | Commits and pull requests, then bars of which agents co-signed them | Heist jazz | `git.commits`, `git.coAuthors` |
| `grind` | A city at night: the longest day, the streak, the latest night | Dark synthwave | `busiestDay.hours`, `streak.days` |
| `boss` | A penthouse office: the agents they manage, the tool calls, a graded performance review per agent | Mafia trap | `agents.length`, `totals.toolCalls` |
| `speedrun` | Pixel art and a speedrun timer: splits, skips used, deaths | Chiptune | `totals.hours`, `totals.failedCommands` |
| `genz` | A loud brainrot backdrop, huge captions one word at a time ("lowkey my roman empire", "aura") | Phonk | `swears.please`, `corrections.total` |
| `linkedin` | A fake LinkedIn post: "I'm humbled to announce", a stock photo of a man shaking a robot's hand, "Agree?" | Corporate ukulele | `totals.sessions`, `corrections.total` |
| `docu` | A jungle, a giant faded number, nature documentary subtitles about them | Orchestral | `lateNight`, `swears.words` |
| `news` | A TV studio: LIVE bug, a big number in a box, breaking news chyron, scrolling ticker | News theme | `swears.total`, `loop.retries` |
| `dating` | A sunset, their agents as dating profile cards: the main one, the ex, the talking stage, red flags | R&B slow jam | `agents` (needs 2 or more) |
| `tier` | An S to D tier list, agent logos dropping into the rows | Hard trap | `agents` (needs 3 or more) |
| `receipt` | A printed receipt on a counter, a line per stat, the persona as the total, a barcode | Elevator bossa | `totals` |
| `trailer` | A stormy city, spaced serif title cards ("In a world where agents write the code"), the persona as the title | Trailer braams | `totals.hours`, `persona.title` |
| `chat` | Their agents' group chat gossiping about them, logos as avatars | Lofi | `agents` (needs 2 or more), `swears.please` |
| `convo` | Their real messages with their agents, one per screen like a chat screenshot: their line types and sends, the agent's reply lands. Any language | Comedy hip hop | `exchangeSamples` (pick `convo`), `totals.prompts` |

Leave out a format whose numbers are zero or tiny (2 swears is not dev rage).
Every format but `full` is made to post: no projects, tools or models, and
swears are censored on screen. All are about 13 to 30 seconds.

## 3. Write the lessons

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
keep its number exactly as computed.

## 4. Pick the quotes

Read `promptSamples`: up to 200 short prompts the user typed, spread over the
year. Get a feel for how they talk to agents (blunt, polite, all caps, typos,
3am despair, tiny wins), then copy 3 or 4 that sound most like them into
`quotes.lines`, keeping each one's `date`, `time` and `agent`:

- Pick lines that are funny, oddly specific or very them. A stranger should
  get the joke without context. Mix moods; skip boring task descriptions.
- Keep their words, typos and casing. You may cut a quote down to its best
  part, at most 120 characters, but never add words.
- Skip anything with a secret, a `********`, a person's or client's name, or
  anything they would not want posted. With `--blur-projects`, also skip
  quotes that name a project.

Write `quotes.title`: at most 6 words, in the user's own tone, introducing
the quotes ("Things you said at 3am", "Your agent has receipts"). Leave
`quotes.lines` empty if nothing is worth posting; the card is then left out.

Only for the formats they picked:

- `loop`: `loop.lines` holds that session's pushback. Reorder it so the two
  funniest come first (the video shows two), by the same rules as the quotes.
- `convo`: read `exchangeSamples`, things they typed (`text`) with the
  agent's first words back (`reply`), and copy the 3 or 4 funniest pairs
  into `convo`, funniest first, keeping `date`, `time` and `agent`. The
  reply is the joke: an agent owning up ("Yes, I broke the status format."),
  "You're absolutely right", a deadpan answer to a rant. Cut the reply down to
  its funny part, at most 100 characters, and the text to at most 120, but
  never add or translate words: Hindi, Hinglish or any other language shows
  as typed. Same skips as the quotes. Leave `convo` empty to skip the cut.
- `boss`: write `reviews`, a performance review for each of the top 4 agents
  in `agents`: `name`, a `grade` ("A+", "B-", "C") and a `line` of at most 6
  words, a joke grounded in its real numbers ("969 sessions. Never sleeps.").
  Leave it empty to skip the card.

Save the edited JSON. Lessons only show in `full`, quotes in `full` and
`social`, and `convo` in its own cut, so skip the steps a picked format does not use.

## 5. Write the jokes

Every format but `full` is a meme, and the jokes on it should be about this
user, not anyone's. The user should not have to explain the joke: the brief
below carries it. For each format they picked, print its brief:

```sh
<skill-dir>/wrapped.sh lines "${TMPDIR:-/tmp}/wrapped.json" --cut <name>
```

Write the jokes from the brief alone; there is no need to read the JSON again.

- `Angle`: the format's comedy. Every line plays it.
- `Facts`: their numbers, already worked out: who they cheat on, who they
  ghosted, their worst hour, the pleases against the swears.
- `Their words`: their loudest prompts and the times an agent owned up,
  verbatim. A line they really typed beats any line you can write, so quote
  them (you may cut one down, never reword it).
- `Cards`: each card that takes a joke, what it already shows, and its limit.

Write one into `lines`, keyed by card id (`"lines": { "rageHook": "..." }`).
A card left out keeps its built-in joke, so skip any you cannot beat. For
`chat`, the thread goes in `chat` as `{ "from": "<agent id>" | "me", "text": "..." }`.

- Write like a meme page, not a report: roast them and their agents, be
  specific and a little unhinged, end on the punch. Use their own slang and
  language (Hinglish stays Hinglish).
- Never invent or change a number; the video prints what you write.
- Call the user "I", "me" or "they", never "he" or "she": the
  history does not say who they are.
- No project, client or person names, no secrets, nothing they would not
  post. Swears are censored on screen anyway.

Then check every line and rewrite each one that fails:

1. It holds a number from `Facts` or words from `Their words`.
2. It would be wrong about any other user. A line that fits everyone is a miss.
3. It adds what the card does not already say: a sticker under "350 times"
   brings a new fact or the punch, not the 350 again.
4. A stranger would laugh, or wince, without context.
5. No two lines lean on the same quote or fact; each card gets its own joke.
6. It is within its limit.

## 6. Render

```sh
<skill-dir>/wrapped.sh render "${TMPDIR:-/tmp}/wrapped.json" -o ~/Desktop/agent-wrapped-<year>.mp4
```

Use `~/Desktop` when it exists, otherwise the current directory, unless the user
names a place. `--format square` (1080x1080) for the X or LinkedIn feed; the
default is vertical (1080x1920) for Stories, Reels and TikTok. Add
`--blur-projects` when the user wants project names and session titles hidden.
Add `--cut <name>` for the format they picked, and render each one they
picked to its own file (`agent-wrapped-<year>-<cut>.mp4`); the JSON is read
again each time, nothing is recounted. Every format has its own music track,
on the same beat as the cuts, with sound effects on every hit.

## Report

Give the video paths, the other formats worth making (see step 2), the headline
numbers (hours, sessions, the #1 agent), the persona, the lessons and the quotes
you picked. Offer to add the lessons to their CLAUDE.md or AGENTS.md. Remind
them that `full` shows project names (unless blurred), and every format can show
lines they typed, so they should watch it before posting.