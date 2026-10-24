// Renders the video from source for a look: a still of every card (PNG) and,
// with --video, the full MP4. Output goes to /tmp/wrapped-preview.
//
//   bun scripts/preview.ts [wrapped.json] [--format vertical|square|both] [--video] [--thin] [--transitions]
//
// --thin derives a sparse Wrapped from the input (one agent, no late night, no
// tokens or lessons, two projects with very long names) to check the edge cases.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { renderVideo } from "../src/render.ts";
import type { Wrapped } from "../src/types.ts";
import { COMPOSITION_ID, TRANSITION, planCards, type Format, type WrappedProps } from "../src/video/plan.ts";

const OUT = "/tmp/wrapped-preview";
const root = join(import.meta.dir, "..");

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    format: { type: "string", default: "both" },
    video: { type: "boolean", default: false },
    thin: { type: "boolean", default: false },
    transitions: { type: "boolean", default: false },
  },
});

function thin(w: Wrapped): Wrapped {
  const agent = w.agents[0];
  return {
    ...w,
    name: "Maximilian Alexander-Featherstonehaugh",
    agents: agent ? [{ ...agent, tokens: 0 }] : [],
    totals: { ...w.totals, tokens: 0, projects: 2, sessions: agent?.sessions ?? 0, hours: agent?.hours ?? 0 },
    projects: [
      { name: "an-extremely-long-monorepo-name-that-keeps-going-and-going", sessions: 40, hours: 61.2 },
      { name: "dotfiles", sessions: 12, hours: 4.5 },
    ],
    lateNight: undefined,
    tools: w.tools.slice(0, 2),
    commands: [{ name: "pnpm --filter @company/really-long-package-name test", count: 3 }],
    failures: [],
    corrections: { ...w.corrections, total: 1, rate: 0.0004, phrases: [{ name: "absolutely-not-what-I-asked-for", count: 1 }] },
    lessons: [],
    longestSession: { ...w.longestSession, title: "A very long session title that describes far too much about what happened during a refactor" },
    streak: { days: 1, from: w.streak.from, to: w.streak.from },
    persona: { title: "The Methodical Weekend Refactoring Archaeologist", line: "You rewrite things carefully, one long session at a time, and you rarely tell your agent no, which is either trust or exhaustion." },
  };
}

const input = positionals[0] ?? join(root, "fixtures", "wrapped.json");
const source: Wrapped = await Bun.file(input).json();
const wrapped = values.thin ? thin(source) : source;
const formats: Format[] = values.format === "both" ? ["vertical", "square"] : [values.format as Format];
const tag = values.thin ? "thin-" : "";

await mkdir(OUT, { recursive: true });
const serveUrl = await bundle({ entryPoint: join(root, "src", "video", "entry.ts") });
const browser = await openBrowser("chrome");

for (const format of formats) {
  const inputProps: WrappedProps = { wrapped, format };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, puppeteerInstance: browser });
  const cards = planCards(wrapped);
  for (const [i, card] of cards.entries()) {
    // Just before the next card starts wiping in, when every animation has landed.
    const shots = [{ frame: card.from + card.duration - TRANSITION - 2, suffix: "" }];
    if (values.transitions && i > 0) shots.push({ frame: card.from + Math.round(TRANSITION / 2), suffix: "-wipe" });
    for (const shot of shots) {
      const output = join(OUT, `${tag}${format}-${String(i + 1).padStart(2, "0")}-${card.id}${shot.suffix}.png`);
      await renderStill({ composition, serveUrl, inputProps, frame: shot.frame, output, puppeteerInstance: browser });
      console.log(output);
    }
  }
}
await browser.close({ silent: true });

if (values.video) {
  for (const format of formats) {
    const output = join(OUT, `${tag}${format}.mp4`);
    const started = performance.now();
    let last = -1;
    await renderVideo(wrapped, format, output, (progress) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== last) process.stdout.write(`${percent}% `);
      last = percent;
    });
    console.log(`\n${output} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  }
}
