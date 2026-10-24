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
/** `full` is the whole year for the user. `social` is a short, first-person cut to post: no projects, titles, tools or models. */
export type Cut = "full" | "social";

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
  | "ask";

/** Beats into the quotes card where each quote starts typing, and how long it types. The soundtrack clicks along. */
export const QUOTE_BEATS = [1, 3.5, 6, 8.5];
export const QUOTE_TYPING = 1.25;

/** Social cut: the beat each card's big line and punchline slam in, and the NO stamps. The soundtrack hits on each. */
export const SLAM_BEAT = 1;
export const STICKER_BEAT = 4;
export const NO_STAMPS = [1.5, 2, 2.5, 3, 3.25, 3.5, 3.75];

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
      return w.lateNight !== undefined;
    case "lessons":
      return w.lessons.length > 0;
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
