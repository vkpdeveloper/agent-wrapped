import { useMemo, type ComponentType, type ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Agents } from "./cards/Agents.tsx";
import { Clock } from "./cards/Clock.tsx";
import { Corrections } from "./cards/Corrections.tsx";
import { BossAsk, BossHook, CoAuthors, CreditAsk, CreditHook, Delegated, Failed, GrindAsk, GrindHook, Longest, LoopAsk, LoopHook, LoopLines, Polite, Prs, RageAsk, RageHook, RagePeak, RageWorst, Review, Retries, Streak, Swears, Weekends, Wrote } from "./cards/Formats.tsx";
import { Hours } from "./cards/Hours.tsx";
import { Intro } from "./cards/Intro.tsx";
import { Lessons } from "./cards/Lessons.tsx";
import { Persona } from "./cards/Persona.tsx";
import { Projects } from "./cards/Projects.tsx";
import { Quotes } from "./cards/Quotes.tsx";
import { Records } from "./cards/Records.tsx";
import { Ask, ask, Hook, Night, No, Reveal, Ride, Said } from "./cards/Social.tsx";
import { Tools } from "./cards/Tools.tsx";
import { useFonts } from "./fonts.ts";
import { Deaths, Skips, Splits, SrHook } from "./formats/Speedrun.tsx";
import { ZAura, ZDuality, ZPov, ZRoman, ZSkill, ZSleep } from "./formats/GenZ.tsx";
import { Post } from "./formats/LinkedIn.tsx";
import { DocHook, DocName, DocNo, DocPlease, DocTongue } from "./formats/Docu.tsx";
import { NewsCredit, NewsHook, NewsHours, NewsNight, NewsRetry } from "./formats/News.tsx";
import { DateEx, DateFlags, DateHook, DateMain, DateTalking } from "./formats/Dating.tsx";
import { TierHook, TierList } from "./formats/Tier.tsx";
import { Receipt } from "./formats/Receipt.tsx";
import { TrailerHours, TrailerNo, TrailerOne, TrailerSessions, TrailerTitle, TrailerWorld } from "./formats/Trailer.tsx";
import { Chat, ChatHook } from "./formats/Chat.tsx";
import { ConvoHook, exchange } from "./formats/Convo.tsx";
import { BEAT, planCards, totalFrames, TRANSITION, type CardId, type WrappedProps } from "./plan.ts";
import { PALETTES, type Field, type Palette } from "./theme.ts";
import { BlurProjects, type CardProps } from "./ui.tsx";

const CARDS: Record<CardId, ComponentType<CardProps>> = {
  intro: Intro,
  hours: Hours,
  agents: Agents,
  projects: Projects,
  clock: Clock,
  records: Records,
  tools: Tools,
  corrections: Corrections,
  quotes: Quotes,
  lessons: Lessons,
  persona: Persona,
  hook: Hook,
  ride: Ride,
  night: Night,
  no: No,
  said: Said,
  reveal: Reveal,
  ask: Ask,
  rageHook: RageHook,
  swears: Swears,
  ragePeak: RagePeak,
  rageWorst: RageWorst,
  polite: Polite,
  rageAsk: RageAsk,
  loopHook: LoopHook,
  loopLines: LoopLines,
  retries: Retries,
  failed: Failed,
  loopAsk: LoopAsk,
  creditHook: CreditHook,
  prs: Prs,
  coauthors: CoAuthors,
  wrote: Wrote,
  creditAsk: CreditAsk,
  grindHook: GrindHook,
  streak: Streak,
  longest: Longest,
  weekends: Weekends,
  grindAsk: GrindAsk,
  bossHook: BossHook,
  delegated: Delegated,
  review: Review,
  bossAsk: BossAsk,
  srHook: SrHook,
  splits: Splits,
  skips: Skips,
  deaths: Deaths,
  srAsk: ask("Beat my time."),
  zPov: ZPov,
  zRoman: ZRoman,
  zDuality: ZDuality,
  zSkill: ZSkill,
  zSleep: ZSleep,
  zAura: ZAura,
  zAsk: ask("ur turn bestie"),
  post: Post,
  liAsk: ask("Thoughts?"),
  docHook: DocHook,
  docNo: DocNo,
  docTongue: DocTongue,
  docPlease: DocPlease,
  docName: DocName,
  docAsk: ask("Spotted one?"),
  newsHook: NewsHook,
  newsRetry: NewsRetry,
  newsNight: NewsNight,
  newsCredit: NewsCredit,
  newsHours: NewsHours,
  newsAsk: ask("What's your headline?"),
  dateHook: DateHook,
  dateMain: DateMain,
  dateEx: DateEx,
  dateTalking: DateTalking,
  dateFlags: DateFlags,
  dateAsk: ask("Who's your toxic agent?"),
  tierHook: TierHook,
  tierList: TierList,
  tierAsk: ask("Fight me in the comments."),
  receipt: Receipt,
  receiptAsk: ask("What's on yours?"),
  trailerWorld: TrailerWorld,
  trailerOne: TrailerOne,
  trailerHours: TrailerHours,
  trailerSessions: TrailerSessions,
  trailerNo: TrailerNo,
  trailerTitle: TrailerTitle,
  trailerAsk: ask("What's your movie?"),
  chatHook: ChatHook,
  chat: Chat,
  chatAsk: ask("What do yours say about you?"),
  convoHook: ConvoHook,
  convo0: exchange(0),
  convo1: exchange(1),
  convo2: exchange(2),
  convo3: exchange(3),
  convoAsk: ask("What did yours say back?"),
};

// The middle cards walk this order; intro is always dark and the persona always
// the agent's own color, unless that would repeat the card before it.
/** Under the effects, so the boom and the stamps cut through. */
const MUSIC_VOLUME = 0.75;

const MIDDLE: (keyof Palette)[] = ["accent", "pale", "pop", "deep", "pop2", "pale", "pop", "deep"];

function fieldsFor(palette: Palette, count: number): Field[] {
  const names: (keyof Palette)[] = Array.from({ length: count }, (_, i) => (i === 0 ? "deep" : MIDDLE[(i - 1) % MIDDLE.length] ?? "pale"));
  if (count > 1) names[count - 1] = names[count - 2] === "accent" ? "pop" : "accent";
  return names.map((name) => palette[name]);
}

export function WrappedVideo({ wrapped, cut, blurProjects = false, soundtrack }: WrappedProps) {
  const ready = useFonts();
  const cards = useMemo(() => planCards(wrapped, cut), [wrapped, cut]);
  const palette = PALETTES[wrapped.agents[0]?.agent ?? "claude"];
  const fields = fieldsFor(palette, cards.length);
  const length = totalFrames(cards);
  if (!ready) return null;
  return (
    <BlurProjects.Provider value={blurProjects}>
      <AbsoluteFill style={{ background: palette.deep.bg }}>
        {/* The music bed under the effects, fading out over the last half beat. */}
        <Html5Audio src={staticFile(`music/${cut}.m4a`)} volume={(f) => MUSIC_VOLUME * interpolate(f, [length - BEAT / 2, length], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
        {soundtrack ? <Html5Audio src={soundtrack} /> : null}
        {cards.map((card, i) => {
          const Card = CARDS[card.id];
          const field = fields[i] ?? palette.deep;
          return (
            <Sequence key={card.id} name={card.id} from={card.from} durationInFrames={card.duration}>
              <Slot index={i} duration={card.duration} last={i === cards.length - 1}>
                <Card w={wrapped} field={field} />
              </Slot>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </BlurProjects.Provider>
  );
}

const wipeEase = Easing.bezier(0.75, 0, 0.25, 1);

/** How the card at `index` is revealed over the one before it, at progress `p`. */
function wipe(index: number, p: number): string {
  switch (index % 3) {
    case 0:
      return `circle(${p * 145}% at 88% 88%)`;
    case 1:
      return `inset(${(1 - p) * 100}% 0 0 0)`;
    default: {
      const x = p * 150;
      return `polygon(0 0, ${x}% 0, ${x - 50}% 100%, 0 100%)`;
    }
  }
}

/** Wipes the card in over the previous one, then pushes it back as the next arrives. */
function Slot({ index, duration, last, children }: { index: number; duration: number; last: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: wipeEase } as const;
  const enter = index === 0 ? 1 : interpolate(frame, [0, TRANSITION], [0, 1], clamp);
  const exit = last ? 0 : interpolate(frame, [duration - TRANSITION, duration], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        clipPath: enter < 1 ? wipe(index, enter) : undefined,
        translate: `0 ${-exit * height * 0.08}px`,
        scale: 1 - exit * 0.04 + (1 - enter) * 0.06,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
