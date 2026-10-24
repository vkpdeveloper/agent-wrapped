// Which cards a Wrapped gets and when each starts. Shared by the composition
// (for its duration) and the renderer, so it must stay free of React.
import type { Wrapped } from "../types.ts";

export const COMPOSITION_ID = "Wrapped";
export const FPS = 30;
/** Frames two neighbouring cards overlap while one wipes over the other. */
export const TRANSITION = 16;

export type Format = "vertical" | "square";

export const FORMATS: Record<Format, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

// A type alias, not an interface: Remotion needs props assignable to Record<string, unknown>.
export type WrappedProps = {
  wrapped: Wrapped;
  format: Format;
};

export type CardId = "intro" | "hours" | "agents" | "projects" | "clock" | "records" | "tools" | "corrections" | "lessons" | "persona";

export interface PlannedCard {
  id: CardId;
  /** First frame, counting the overlap with the card before it. */
  from: number;
  duration: number;
}

const SECONDS: Record<CardId, number> = {
  intro: 4,
  hours: 4.5,
  agents: 4.5,
  projects: 4.5,
  clock: 5,
  records: 5,
  tools: 5,
  corrections: 4.5,
  lessons: 5.5,
  persona: 6,
};

function shows(id: CardId, w: Wrapped): boolean {
  switch (id) {
    case "agents":
      return w.agents.length > 0;
    case "projects":
      return w.projects.length > 0;
    case "clock":
      return w.byHour.some((h) => h > 0);
    case "tools":
      return w.tools.length > 0 || w.commands.length > 0;
    case "corrections":
      return w.corrections.total > 0;
    case "lessons":
      return w.lessons.length > 0;
    default:
      return true;
  }
}

export function planCards(w: Wrapped): PlannedCard[] {
  const ids = (Object.keys(SECONDS) as CardId[]).filter((id) => shows(id, w));
  let from = 0;
  return ids.map((id) => {
    const duration = Math.round(SECONDS[id] * FPS);
    const card = { id, from, duration };
    from += duration - TRANSITION;
    return card;
  });
}

export function totalFrames(cards: PlannedCard[]): number {
  const last = cards.at(-1);
  return last ? last.from + last.duration : 1;
}
