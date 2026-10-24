// Which cards a Wrapped gets and when each starts. Shared by the composition
// (for its duration) and the renderer, so it must stay free of React.
import type { Wrapped } from "../types.ts";

export const COMPOSITION_ID = "Wrapped";
export const FPS = 30;
/** The soundtrack's tempo. Cards last whole beats, so every cut lands on the music. */
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM;
/** Frames two neighbouring cards overlap while one wipes over the other: one beat. */
export const TRANSITION = BEAT;

export type Format = "vertical" | "square";
/**
 * `full` is the whole year for the user. `social` is a short, first-person cut to post: no projects, titles, tools or models.
 * The rest are one-joke social formats (see SKILL.md for what each is).
 */
export const CUT_NAMES = ["full", "social", "rage", "loop", "credit", "grind", "boss", "speedrun", "genz", "linkedin", "docu", "news", "dating", "tier", "receipt", "trailer", "chat", "convo"] as const;
export type Cut = (typeof CUT_NAMES)[number];

export const FORMATS: Record<Format, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

// A type alias, not an interface: Remotion needs props assignable to Record<string, unknown>.
export type WrappedProps = {
  wrapped: Wrapped;
  format: Format;
  cut: Cut;
  /** Shows project names and session titles as blurred stand-ins. */
  blurProjects?: boolean;
  /** URL of the soundtrack WAV, served by the renderer. */
  soundtrack?: string;
};

export type CardId =
  | "intro"
  | "hours"
  | "agents"
  | "projects"
  | "clock"
  | "records"
  | "tools"
  | "corrections"
  | "quotes"
  | "lessons"
  | "persona"
  // The social cut's own cards.
  | "hook"
  | "ride"
  | "night"
  | "no"
  | "said"
  | "reveal"
  | "ask"
  // The one-joke formats.
  | "rageHook"
  | "swears"
  | "ragePeak"
  | "rageWorst"
  | "polite"
  | "rageAsk"
  | "loopHook"
  | "loopLines"
  | "retries"
  | "failed"
  | "loopAsk"
  | "creditHook"
  | "prs"
  | "coauthors"
  | "wrote"
  | "creditAsk"
  | "grindHook"
  | "streak"
  | "longest"
  | "weekends"
  | "grindAsk"
  | "bossHook"
  | "delegated"
  | "review"
  | "bossAsk"
  | "srHook"
  | "splits"
  | "skips"
  | "deaths"
  | "srAsk"
  | "zPov"
  | "zRoman"
  | "zDuality"
  | "zSkill"
  | "zSleep"
  | "zAura"
  | "zAsk"
  | "post"
  | "liAsk"
  | "docHook"
  | "docNo"
  | "docTongue"
  | "docPlease"
  | "docName"
  | "docAsk"
  | "newsHook"
  | "newsRetry"
  | "newsNight"
  | "newsCredit"
  | "newsHours"
  | "newsAsk"
  | "dateHook"
  | "dateMain"
  | "dateEx"
  | "dateTalking"
  | "dateFlags"
  | "dateAsk"
  | "tierHook"
  | "tierList"
  | "tierAsk"
  | "receipt"
  | "receiptAsk"
  | "trailerWorld"
  | "trailerOne"
  | "trailerHours"
  | "trailerSessions"
  | "trailerNo"
  | "trailerTitle"
  | "trailerAsk"
  | "chatHook"
  | "chat"
  | "chatAsk"
  | "convoHook"
  | "convo0"
  | "convo1"
  | "convo2"
  | "convo3"
  | "convoAsk";

/** Beats into the quotes card where each quote starts typing, and how long it types. The soundtrack clicks along. */
export const QUOTE_BEATS = [1, 3.5, 6, 8.5];
export const QUOTE_TYPING = 1.25;

/** Social cut: the beat each card's big line and punchline slam in, and the NO stamps. The soundtrack hits on each. */
export const SLAM_BEAT = 1;
export const STICKER_BEAT = 4;
export const NO_STAMPS = [1.5, 2, 2.5, 3, 3.25, 3.5, 3.75];
/** Beats the rows of a list card (swears, co-authors, reviews) land on. The soundtrack bleeps the swears. */
export const ROW_BEATS = [1, 1.5, 2, 2.5, 3];
/** Beats into the group chat each message pops on. The soundtrack bleeps each one. */
export const CHAT_BEATS = [1, 3, 5, 6.5, 8.5, 11, 12.5, 15, 17, 20];

/** Convo cut: beats into each exchange card where the message has typed, sends, and the agent's reply lands. */
export const CONVO_TYPING = 1;
export const CONVO_SEND = 1.75;
export const CONVO_REPLY = 3.25;

const sticker = (card: string) => `the punchline stamped under "${card}", at most 8 words`;
const ASK = "the closing question to the viewer, at most 6 words";
const genz = (about: string) => `the whole caption about ${about}, lowercase brainrot, at most 14 words, keeping the number`;
const docu = (about: string) => `the narrator's subtitle about ${about}, Attenborough voice, at most 18 words`;
const news = (about: string) => `the chyron headline about ${about} (the number in the box), ALL CAPS, at most 12 words`;
const trailer = (about: string) => `the title card${about}, ALL CAPS, at most 8 words`;
const bio = (agent: string) => `the dating bio of ${agent}, at most 8 words`;

/**
 * The joke each card takes from `lines`, written by the skill's agent from the
 * user's real data, in place of the built-in one. Cards not listed take none.
 * Each names what the card already shows, so the joke can land on it.
 */
export const LINES: Partial<Record<CardId, string>> = {
  hook: sticker("I spent <totals.hours> hours with AI agents"),
  ride: 'the jab under "My ride or die: <agents[0].name>", at most 8 words',
  night: sticker("Latest night: <lateNight.time>, still prompting"),
  no: sticker("I told my agent no <corrections.total> times"),
  ask: ASK,
  rageHook: sticker("I swore at my AI <swears.total> times this year"),
  ragePeak: sticker("Peak rage: <the month with most swears>"),
  rageWorst: 'the agent\'s reply under their worst swear (<swears.worst>), at most 6 words',
  polite: sticker("I said please <swears.please> times"),
  rageAsk: ASK,
  loopHook: sticker("I told my agent no <loop.corrections> times in one session"),
  retries: sticker("It ran the same broken command <loop.retries> times"),
  failed: sticker("My agents ran <totals.failedCommands> commands that failed"),
  loopAsk: ASK,
  creditHook: sticker("I made <git.commits> commits this year"),
  prs: sticker("My agents opened <git.prs> pull requests"),
  coauthors: sticker("the agents that co-signed their commits, <git.coAuthors>"),
  wrote: sticker("It wrote +<totals.linesAdded> lines"),
  creditAsk: ASK,
  grindHook: sticker("I worked <busiestDay.hours> hours in one day"),
  streak: sticker("My streak: <streak.days> days in a row"),
  longest: sticker("Longest session: <longestSession.hours> hours"),
  weekends: sticker("On weekends: <byWeekday[0] + byWeekday[6]> hours with my agents"),
  grindAsk: ASK,
  bossHook: sticker("I managed <agents.length> AI agents this year"),
  delegated: sticker("They made <totals.toolCalls> tool calls for me"),
  bossAsk: ASK,
  srHook: sticker("World record: <totals.hours> hours, AGENT% ANY%"),
  skips: sticker("Skips used"),
  deaths: sticker("Deaths: <totals.failedCommands> failed commands"),
  srAsk: ASK,
  zPov: genz("<totals.hours> hours with AI"),
  zRoman: genz("<agents[0].name>, <agents[0].sessions> sessions"),
  zDuality: genz("<swears.please> pleases vs <swears.total> swears"),
  zSkill: genz("<totals.failedCommands> failed commands"),
  zSleep: genz("<lateNight.time>, or their latest hours"),
  zAura: genz("telling the agent no <corrections.total> times"),
  zAsk: ASK,
  post: 'the whole LinkedIn post, 4 to 6 short lines joined with "\\n", humblebrag voice, with their real numbers; the last line is the big sign-off',
  liAsk: ASK,
  docHook: docu("<lateNight.time> or <totals.hours> hours"),
  docNo: docu("telling its agent no <corrections.total> times"),
  docTongue: docu("its swear words, <swears.words>"),
  docPlease: docu("saying please <swears.please> times"),
  docName: docu("the species name, <persona.title>"),
  docAsk: ASK,
  newsHook: news("<swears.total> swears, or <corrections.total> noes without swears"),
  newsRetry: news("<loop.retries> retries of one broken command"),
  newsNight: news("<lateNight.time>"),
  newsCredit: news("<git.coAuthors[0]> signing <its count> commits"),
  newsHours: news("<totals.hours> hours"),
  newsAsk: ASK,
  dateHook: sticker("My relationship status with AI: It's complicated"),
  dateMain: bio("<agents[0].name>, the main one"),
  dateEx: bio("<agents[1].name>, the ex"),
  dateTalking: bio("their last agent, the talking stage"),
  dateFlags: sticker("Red flags: told them no <corrections.total> times"),
  dateAsk: ASK,
  tierHook: sticker("Ranking every AI agent I used: <agents.length>"),
  tierAsk: ASK,
  receipt: 'the footer under the itemized year, 1 or 2 lines joined with "\\n", at most 22 characters each',
  receiptAsk: ASK,
  trailerWorld: trailer(' opening "IN A WORLD WHERE..."'),
  trailerOne: trailer(' introducing the hero, "ONE DEVELOPER"'),
  trailerHours: trailer(", keeping <totals.hours> HOURS"),
  trailerSessions: trailer(", keeping <totals.sessions> SESSIONS"),
  trailerNo: trailer(", keeping the <corrections.total> times they said no"),
  trailerTitle: "the tagline under the title <persona.title>, at most 6 words",
  trailerAsk: ASK,
  chatHook: sticker("I found my agents' group chat"),
  chatAsk: ASK,
  convoHook: sticker("I sent my AI <totals.prompts> messages. It answered back."),
  convoAsk: ASK,
};

/** Quotes on screen: a square frame fits one fewer, and the social cut keeps the best two. */
export function quoteCount(w: Wrapped, format: Format, cut: Cut): number {
  const room = cut === "social" ? 2 : format === "square" ? 3 : QUOTE_BEATS.length;
  return Math.min(w.quotes.lines.length, room);
}

export interface PlannedCard {
  id: CardId;
  /** First frame, counting the overlap with the card before it. */
  from: number;
  duration: number;
}

// Cards in order, with their beats on screen counting the beat of overlap with the
// next card. Every card but the last is whole bars plus that beat, so each wipe
// starts on a downbeat.
const CUTS: Record<Cut, [CardId, number][]> = {
  full: [
    ["intro", 9],
    ["hours", 9],
    ["agents", 9],
    ["projects", 9],
    ["clock", 9],
    ["records", 9],
    ["tools", 9],
    ["corrections", 9],
    ["quotes", 13],
    ["lessons", 13],
    ["persona", 14],
  ],
  // About 25 seconds: short videos are watched to the end, and replayed.
  social: [
    ["hook", 9],
    ["ride", 9],
    ["night", 9],
    ["no", 9],
    ["said", 9],
    ["reveal", 13],
    ["ask", 10],
  ],
  rage: [
    ["rageHook", 9],
    ["swears", 9],
    ["ragePeak", 9],
    ["rageWorst", 9],
    ["polite", 9],
    ["rageAsk", 10],
  ],
  loop: [
    ["loopHook", 9],
    ["loopLines", 9],
    ["retries", 9],
    ["failed", 9],
    ["loopAsk", 10],
  ],
  credit: [
    ["creditHook", 9],
    ["prs", 9],
    ["coauthors", 9],
    ["wrote", 9],
    ["creditAsk", 10],
  ],
  grind: [
    ["grindHook", 9],
    ["streak", 9],
    ["longest", 9],
    ["night", 9],
    ["weekends", 9],
    ["grindAsk", 10],
  ],
  boss: [
    ["bossHook", 9],
    ["delegated", 9],
    ["review", 13],
    ["failed", 9],
    ["bossAsk", 10],
  ],
  speedrun: [
    ["srHook", 9],
    ["splits", 13],
    ["skips", 9],
    ["deaths", 9],
    ["srAsk", 10],
  ],
  genz: [
    ["zPov", 9],
    ["zRoman", 9],
    ["zDuality", 9],
    ["zSkill", 9],
    ["zSleep", 9],
    ["zAura", 9],
    ["zAsk", 10],
  ],
  linkedin: [
    ["post", 17],
    ["liAsk", 10],
  ],
  docu: [
    ["docHook", 9],
    ["docNo", 9],
    ["docTongue", 9],
    ["docPlease", 9],
    ["docName", 9],
    ["docAsk", 10],
  ],
  news: [
    ["newsHook", 9],
    ["newsRetry", 9],
    ["newsNight", 9],
    ["newsCredit", 9],
    ["newsHours", 9],
    ["newsAsk", 10],
  ],
  dating: [
    ["dateHook", 9],
    ["dateMain", 9],
    ["dateEx", 9],
    ["dateTalking", 9],
    ["dateFlags", 9],
    ["dateAsk", 10],
  ],
  tier: [
    ["tierHook", 9],
    ["tierList", 17],
    ["tierAsk", 10],
  ],
  receipt: [
    ["receipt", 17],
    ["receiptAsk", 10],
  ],
  trailer: [
    ["trailerWorld", 5],
    ["trailerOne", 5],
    ["trailerHours", 5],
    ["trailerSessions", 5],
    ["trailerNo", 5],
    ["trailerTitle", 13],
    ["trailerAsk", 10],
  ],
  chat: [
    ["chatHook", 9],
    ["chat", 29],
    ["chatAsk", 10],
  ],
  convo: [
    ["convoHook", 9],
    ["convo0", 9],
    ["convo1", 9],
    ["convo2", 9],
    ["convo3", 9],
    ["convoAsk", 10],
  ],
};

function shows(id: CardId, w: Wrapped): boolean {
  switch (id) {
    case "agents":
    case "ride":
      return w.agents.length > 0;
    case "projects":
      return w.projects.length > 0;
    case "clock":
      return w.byHour.some((h) => h > 0);
    case "tools":
      return w.tools.length > 0 || w.commands.length > 0;
    case "corrections":
    case "no":
      return w.corrections.total > 0;
    case "quotes":
    case "said":
      return w.quotes.lines.length > 0;
    case "night":
    case "newsNight":
      return w.lateNight !== undefined;
    case "lessons":
      return w.lessons.length > 0;
    case "rageHook":
    case "swears":
    case "ragePeak":
    case "polite":
      return w.swears.total > 0;
    case "rageWorst":
      return w.swears.worst !== "";
    case "loopHook":
    case "loopLines":
      return w.loop.corrections > 0;
    case "retries":
    case "newsRetry":
      return w.loop.retries > 1;
    case "newsCredit":
      return w.git.coAuthors.length > 0;
    case "dateEx":
      return w.agents.length > 1;
    case "dateTalking":
      return w.agents.length > 2;
    case "docTongue":
      return w.swears.total > 0;
    case "failed":
      return w.totals.failedCommands > 0;
    case "creditHook":
    case "coauthors":
      return w.git.commits > 0;
    case "prs":
      return w.git.prs > 0;
    case "review":
      return w.reviews.length > 0;
    case "convo0":
    case "convo1":
    case "convo2":
    case "convo3":
      return w.convo.length > Number(id.at(-1));
    default:
      return true;
  }
}

export function planCards(w: Wrapped, cut: Cut): PlannedCard[] {
  let from = 0;
  return CUTS[cut]
    .filter(([id]) => shows(id, w))
    .map(([id, beats]) => {
      const duration = beats * BEAT;
      const card = { id, from, duration };
      from += duration - TRANSITION;
      return card;
    });
}

export function totalFrames(cards: PlannedCard[]): number {
  const last = cards.at(-1);
  return last ? last.from + last.duration : 1;
}
