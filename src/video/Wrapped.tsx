import { useMemo, type ComponentType, type ReactNode } from "react";
import { AbsoluteFill, Easing, Html5Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Agents } from "./cards/Agents.tsx";
import { Clock } from "./cards/Clock.tsx";
import { Corrections } from "./cards/Corrections.tsx";
import { Hours } from "./cards/Hours.tsx";
import { Intro } from "./cards/Intro.tsx";
import { Lessons } from "./cards/Lessons.tsx";
import { Persona } from "./cards/Persona.tsx";
import { Projects } from "./cards/Projects.tsx";
import { Quotes } from "./cards/Quotes.tsx";
import { Records } from "./cards/Records.tsx";
import { Ask, Hook, Night, No, Reveal, Ride, Said } from "./cards/Social.tsx";
import { Tools } from "./cards/Tools.tsx";
import { useFonts } from "./fonts.ts";
import { planCards, TRANSITION, type CardId, type WrappedProps } from "./plan.ts";
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
};

// The middle cards walk this order; intro is always dark and the persona always
// the agent's own color, unless that would repeat the card before it.
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
  if (!ready) return null;
  return (
    <BlurProjects.Provider value={blurProjects}>
      <AbsoluteFill style={{ background: palette.deep.bg }}>
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
