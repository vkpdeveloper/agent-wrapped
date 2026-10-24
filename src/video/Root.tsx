import { Composition } from "remotion";
import type { Wrapped } from "../types.ts";
import { COMPOSITION_ID, FORMATS, FPS, planCards, totalFrames, type WrappedProps } from "./plan.ts";
import { WrappedVideo } from "./Wrapped.tsx";

const moment = { date: "2026-01-01", time: "00:00", agent: "claude", title: "", project: "", hours: 0 } as const;

// Only a placeholder for the Studio; real renders always pass inputProps.
const empty: Wrapped = {
  name: "",
  year: 2026,
  from: "2026-01-01",
  to: "2026-01-01",
  agents: [],
  totals: { sessions: 0, hours: 0, prompts: 0, toolCalls: 0, failedCommands: 0, tokens: 0, linesAdded: 0, linesRemoved: 0, projects: 0, activeDays: 0 },
  projects: [],
  tools: [],
  commands: [],
  failures: [],
  byHour: Array(24).fill(0),
  byWeekday: Array(7).fill(0),
  byMonth: Array(12).fill(0),
  longestSession: moment,
  busiestDay: { date: "2026-01-01", sessions: 0, hours: 0 },
  streak: { days: 0, from: "2026-01-01", to: "2026-01-01" },
  corrections: { total: 0, rate: 0, phrases: [], samples: [] },
  promptSamples: [],
  quotes: { title: "", lines: [] },
  lessons: [],
  persona: { title: "", line: "" },
  swears: { total: 0, words: [], byMonth: Array(12).fill(0), byHour: Array(24).fill(0), please: 0, worst: "" },
  loop: { corrections: 0, lines: [], retries: 0 },
  git: { commits: 0, prs: 0, prsCredited: 0, coAuthors: [] },
  reviews: [],
};

export const Root = () => (
  <Composition
    id={COMPOSITION_ID}
    component={WrappedVideo}
    fps={FPS}
    {...FORMATS.vertical}
    durationInFrames={1}
    defaultProps={{ wrapped: empty, format: "vertical", cut: "full" } satisfies WrappedProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: totalFrames(planCards(props.wrapped, props.cut)),
      fps: FPS,
      ...FORMATS[props.format],
    })}
  />
);
