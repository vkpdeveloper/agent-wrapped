// What `agent-wrapped lines` prints: everything the skill's agent needs to write
// one cut's jokes without reading wrapped.json. The angle is the format's comedy,
// the facts are this user's extremes already worked out, the words are their
// loudest lines, and each card says what it shows with the real values filled in.
// Picking extremes is data work, so code does it the same way for every agent;
// the agent only writes the jokes.
import { SWEARS } from "./stats.ts";
import { AGENT_NAMES, type Wrapped } from "./types.ts";
import { big, clock, day, hourLabel, hours, int, MONTHS } from "./video/format.ts";
import { planCards, type CardId, type Cut } from "./video/plan.ts";

type Slot = (w: Wrapped) => string;

const ANGLES: Record<Exclude<Cut, "full">, string> = {
  social: "Them flexing the year in first person, half brag, half confession. Each sticker undercuts the big number above it.",
  rage: "A dev losing it at a machine that stays polite. The joke is the gap: the swears vs the pleases, the rage vs the agent's calm reply.",
  loop: "Groundhog Day. They say no, the agent says they're absolutely right, then does it again. Quote the pushback.",
  credit: "A heist. The agents wrote the code and signed the commits, they take the credit. Who is the senior dev now?",
  grind: "Concerning dedication. Treat the hours like a cry for help and their sleep schedule like a crime scene.",
  boss: "A mafia boss who delegates everything, blame included, to a team that never sleeps and never says no.",
  speedrun: "A world record run, commentated straight: failed commands are deaths, skipped steps are glitches.",
  genz: "A brainrot narrator: lowercase, \"not me\", \"lowkey\", \"the aura\". An affectionate roast.",
  linkedin: "A cringe thought leader turning rage, failures and 3am sessions into leadership lessons. Agree?",
  docu: "Attenborough narrating a rare nocturnal species in its habitat, dead serious about absurd facts.",
  news: "Breaking news covering their habits like a national crisis, with sources close to the agent.",
  dating: "Their agents as their love life: the main one is the tired partner, the ex knows too much, the talking stage got ghosted.",
  tier: "A hater ranking agents, every hot take justified with a session count.",
  receipt: "An itemized bill for the year. The total is what it cost them as a person.",
  trailer: "An epic movie trailer about mundane dev work, played completely straight.",
  chat: "Their agents' group chat behind their back. The main agent is the tired spouse, the one that co-signs commits is smug, the barely used one is ghosted and salty. They quote things the user really typed and roast the real numbers. The user crashes the chat at the end.",
  convo: "Screenshots of real exchanges. The agent's deadpan reply is the joke; the hook and the ask frame it.",
};

const peak = (values: number[]) => values.indexOf(Math.max(...values));
const weekend = (w: Wrapped) => hours((w.byWeekday[0] ?? 0) + (w.byWeekday[6] ?? 0));
const late = (w: Wrapped) => (w.lateNight ? `${clock(w.lateNight.time).time} ${clock(w.lateNight.time).half}` : "");
const name = (w: Wrapped, index: number) => w.agents.at(index)?.name ?? "";

const sticker = (card: string) => `the punchline stamped under "${card}", at most 8 words`;
const ASK = "the closing question to the viewer, at most 6 words";
const genz = (about: string) => `the whole caption about ${about}, lowercase brainrot, at most 14 words, keeping the number`;
const docu = (about: string) => `the narrator's subtitle about ${about}, Attenborough voice, at most 18 words`;
const news = (about: string) => `the chyron headline about ${about} (the number in the box), ALL CAPS, at most 12 words`;
const trailer = (about: string) => `the title card${about}, ALL CAPS, at most 8 words`;
const bio = (agent: string) => `the dating bio of ${agent}, at most 8 words`;

/** The joke each card takes from `lines`, and what the card already shows, so the joke can land on it. Cards not listed take none. */
export const LINES: Partial<Record<CardId, Slot>> = {
  hook: (w) => sticker(`I spent ${hours(w.totals.hours)} hours with AI agents`),
  ride: (w) => `the jab under "My ride or die: ${name(w, 0)}", at most 8 words`,
  night: (w) => sticker(`Latest night: ${late(w)}, still prompting`),
  no: (w) => sticker(`I told my agent no ${int(w.corrections.total)} times`),
  ask: () => ASK,
  rageHook: (w) => sticker(`I swore at my AI ${int(w.swears.total)} times this year`),
  ragePeak: (w) => sticker(`Peak rage: ${MONTHS[peak(w.swears.byMonth)]}`),
  rageWorst: () => "the agent's reply under their worst swear (below), at most 6 words",
  polite: (w) => sticker(`I said please ${int(w.swears.please)} times`),
  rageAsk: () => ASK,
  loopHook: (w) => sticker(`I told my agent no ${int(w.loop.corrections)} times in one session`),
  retries: (w) => sticker(`It ran the same broken command ${int(w.loop.retries)} times`),
  failed: (w) => sticker(`My agents ran ${int(w.totals.failedCommands)} commands that failed`),
  loopAsk: () => ASK,
  creditHook: (w) => sticker(`I made ${int(w.git.commits)} commits this year`),
  prs: (w) => sticker(`My agents opened ${int(w.git.prs)} pull requests`),
  coauthors: (w) => sticker(`the agents that co-signed their commits: ${w.git.coAuthors.map((a) => `${a.name} ${int(a.count)}`).join(", ")}`),
  wrote: (w) => sticker(`It wrote +${int(w.totals.linesAdded)} lines`),
  creditAsk: () => ASK,
  grindHook: (w) => sticker(`I worked ${hours(w.busiestDay.hours)} hours in one day`),
  streak: (w) => sticker(`My streak: ${w.streak.days} days in a row`),
  longest: (w) => sticker(`Longest session: ${hours(w.longestSession.hours)} hours`),
  weekends: (w) => sticker(`On weekends: ${weekend(w)} hours with my agents`),
  grindAsk: () => ASK,
  bossHook: (w) => sticker(`I managed ${w.agents.length} AI agents this year`),
  delegated: (w) => sticker(`They made ${int(w.totals.toolCalls)} tool calls for me`),
  bossAsk: () => ASK,
  srHook: (w) => sticker(`World record: ${hours(w.totals.hours)} hours, AGENT% ANY%`),
  skips: () => sticker("Skips used"),
  deaths: (w) => sticker(`Deaths: ${int(w.totals.failedCommands)} failed commands`),
  srAsk: () => ASK,
  zPov: (w) => genz(`${hours(w.totals.hours)} hours with AI`),
  zRoman: (w) => genz(`${name(w, 0)}, ${int(w.agents[0]?.sessions ?? 0)} sessions`),
  zDuality: (w) => genz(`${int(w.swears.please)} pleases vs ${int(w.swears.total)} swears`),
  zSkill: (w) => genz(`${int(w.totals.failedCommands)} failed commands`),
  zSleep: (w) => genz(w.lateNight ? `prompting at ${late(w)}` : `${weekend(w)} weekend hours`),
  zAura: (w) => genz(`telling the agent no ${int(w.corrections.total)} times`),
  zAsk: () => ASK,
  post: () => 'the whole LinkedIn post, 4 to 6 short lines joined with "\\n", humblebrag voice, with their real numbers; the last line is the big sign-off',
  liAsk: () => ASK,
  docHook: (w) => docu(w.lateNight ? `it prompting at ${late(w)}` : `its ${hours(w.totals.hours)} hours`),
  docNo: (w) => docu(`it telling its agent no ${int(w.corrections.total)} times`),
  docTongue: (w) => docu(`its swear words: ${w.swears.words.map((s) => s.name).join(", ")}`),
  docPlease: (w) => docu(`it saying please ${int(w.swears.please)} times`),
  docName: (w) => docu(`the species name, ${w.persona.title}`),
  docAsk: () => ASK,
  newsHook: (w) => news(w.swears.total ? `${int(w.swears.total)} swears` : `${int(w.corrections.total)} noes`),
  newsRetry: (w) => news(`${int(w.loop.retries)} retries of one broken command`),
  newsNight: (w) => news(`prompting at ${late(w)}`),
  newsCredit: (w) => news(`${w.git.coAuthors[0]?.name ?? "AI"} signing ${int(w.git.coAuthors[0]?.count ?? 0)} commits`),
  newsHours: (w) => news(`${hours(w.totals.hours)} hours`),
  newsAsk: () => ASK,
  dateHook: () => sticker("My relationship status with AI: It's complicated"),
  dateMain: (w) => bio(`${name(w, 0)}, the main one`),
  dateEx: (w) => bio(`${name(w, 1)}, the ex`),
  dateTalking: (w) => bio(`${name(w, -1)}, the talking stage`),
  dateFlags: (w) => sticker(`Red flags: told them no ${int(w.corrections.total)} times`),
  dateAsk: () => ASK,
  tierHook: (w) => sticker(`Ranking every AI agent I used: ${w.agents.length}`),
  tierAsk: () => ASK,
  receipt: () => 'the footer under the itemized year, 1 or 2 lines joined with "\\n", at most 22 characters each',
  receiptAsk: () => ASK,
  trailerWorld: () => trailer(' opening "IN A WORLD WHERE..."'),
  trailerOne: () => trailer(' introducing the hero, "ONE DEVELOPER"'),
  trailerHours: (w) => trailer(`, keeping ${hours(w.totals.hours)} HOURS`),
  trailerSessions: (w) => trailer(`, keeping ${int(w.totals.sessions)} SESSIONS`),
  trailerNo: (w) => trailer(`, keeping the ${int(w.corrections.total)} times they said no`),
  trailerTitle: (w) => `the tagline under the title ${w.persona.title}, at most 6 words`,
  trailerAsk: () => ASK,
  chatHook: () => sticker("I found my agents' group chat"),
  chat: (w) => `the whole thread, in \`chat\` (not \`lines\`): 8 to 10 messages of at most 60 characters, "from" one of ${w.agents.map((a) => a.agent).join(", ")}, and the last from "me"`,
  chatAsk: () => ASK,
  convoHook: (w) => sticker(`I sent my AI ${int(w.totals.prompts)} messages. It answered back.`),
  convoAsk: () => ASK,
};

/** Every number worth a joke, worked out and formatted as the cards print it. Zero facts are left out. */
function facts(w: Wrapped): [string, string][] {
  const t = w.totals;
  const share = (sessions: number) => `${Math.round((sessions / Math.max(t.sessions, 1)) * 100)}%`;
  const rows: [string, string | false | undefined][] = [
    ["year", `${hours(t.hours)} hours, ${int(t.sessions)} sessions, ${int(t.prompts)} prompts, ${t.activeDays} active days`],
    ["agents", w.agents.map((a) => `${a.name} ${int(a.sessions)} (${share(a.sessions)})`).join(", ")],
    ["ghosted", w.agents.length > 2 && `${name(w, -1)}, ${int(w.agents.at(-1)?.sessions ?? 0)} sessions all year`],
    ["peak hour", w.byHour.some(Boolean) && hourLabel(peak(w.byHour))],
    ["latest night", w.lateNight && `${late(w)} on ${day(w.lateNight.date)}, with ${AGENT_NAMES[w.lateNight.agent]}`],
    ["grind", `${hours(w.busiestDay.hours)} hours on ${day(w.busiestDay.date)}, ${w.streak.days}-day streak, longest session ${hours(w.longestSession.hours)} hours, ${weekend(w)} weekend hours`],
    ["said no", w.corrections.total > 0 && `${int(w.corrections.total)} times (${(w.corrections.rate * 100).toFixed(1)}% of prompts), mostly opening with ${w.corrections.phrases.slice(0, 3).map((p) => `"${p.name}"`).join(", ")}`],
    ["one session", w.loop.corrections > 0 && `told it no ${w.loop.corrections} times; one broken command ran ${w.loop.retries} times in a session`],
    ["failed", t.failedCommands > 0 && `${int(t.failedCommands)} failed commands`],
    ["swears", w.swears.total > 0 && `${int(w.swears.total)} (${w.swears.words.map((s) => `${s.name} ${s.count}`).join(", ")}), peak ${MONTHS[peak(w.swears.byMonth)]}, worst hour ${hourLabel(peak(w.swears.byHour))}`],
    ["please", (w.swears.please > 0 || w.swears.total > 0) && `${int(w.swears.please)} pleases vs ${int(w.swears.total)} swears`],
    ["git", w.git.commits > 0 && `${int(w.git.commits)} commits, ${int(w.git.prs)} PRs opened by agents; co-signed by ${w.git.coAuthors.map((a) => `${a.name} ${int(a.count)}`).join(", ") || "nobody"}`],
    ["code", `+${int(t.linesAdded)} / -${int(t.linesRemoved)} lines, ${int(t.toolCalls)} tool calls, ${big(t.tokens)} tokens`],
    ["persona", `${w.persona.title}: ${w.persona.line}`],
  ];
  return rows.filter((row): row is [string, string] => Boolean(row[1]));
}

const OWNING_UP = /\byou('re| are) (absolutely |totally |completely )?right\b|good catch|my (bad|mistake)|\bsorry\b|apologi|i broke|i was wrong|fair point/i;

/** How much a line yells: swears, all caps, !?. */
function loudness(text: string): number {
  const swears = SWEARS.reduce((n, [, pattern]) => n + (text.match(pattern)?.length ?? 0), 0);
  const letters = text.replace(/[^a-z]/gi, "");
  const shouting = letters.length >= 8 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6 ? 3 : 0;
  return swears * 2 + shouting + (text.match(/[!?]+/g)?.length ?? 0);
}

// Masked secrets show as runs of *, and a quote with one is not worth the risk.
const postable = (text: string, max: number) => text.length <= max && !text.includes("\n") && !text.includes("***");

/** Their loudest prompts, and the exchanges where the agent owned up, from the samples. */
function words(w: Wrapped): [string, string][] {
  const loudest = [...new Set([...w.corrections.samples, ...w.promptSamples.map((q) => q.text)])]
    .filter((text) => postable(text, 120) && loudness(text) > 0)
    .sort((a, b) => loudness(b) - loudness(a))
    .slice(0, 6);
  const comebacks = w.exchangeSamples
    .filter((e) => postable(e.text, 120) && OWNING_UP.test(e.reply))
    .sort((a, b) => loudness(b.text) - loudness(a.text))
    .slice(0, 4)
    .map((e) => `"${e.text}" -> ${AGENT_NAMES[e.agent]}: "${e.reply.length > 100 ? `${e.reply.slice(0, 99)}…` : e.reply}"`);
  return [
    ...(w.swears.worst ? [["worst swear", `"${w.swears.worst}"`] as [string, string]] : []),
    ...w.loop.lines.slice(0, 3).map((text): [string, string] => ["that session", `"${text}"`]),
    ...loudest.map((text): [string, string] => ["loudest", `"${text}"`]),
    ...comebacks.map((text): [string, string] => ["owned up", text]),
  ];
}

/** A titled block of aligned rows, or nothing when there are no rows. */
const section = (title: string, rows: [string, string][]) => (rows.length ? [title, ...rows.map(([label, value]) => `  ${label.padEnd(16)} ${value}`), ""] : []);

export function brief(w: Wrapped, cut: Cut): string {
  if (cut === "full") return "The full cut takes no jokes.";
  const cards = planCards(w, cut).flatMap(({ id }): [string, string][] => {
    const slot = LINES[id];
    return slot ? [[id, slot(w)]] : [];
  });
  return [
    `Angle: ${ANGLES[cut]}`,
    "",
    ...section("Facts (real numbers, use them exactly as written)", facts(w)),
    ...section("Their words (verbatim and masked: quote them, never reword; skip any with a name)", words(w)),
    ...section("Cards (write each into `lines`, keyed by id)", cards),
  ]
    .join("\n")
    .trimEnd();
}
