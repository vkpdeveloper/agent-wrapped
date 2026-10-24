import { describe, expect, test } from "bun:test";
import { brief } from "./brief.ts";
import { wrap } from "./stats.ts";
import type { Wrapped } from "./types.ts";

const empty = wrap([], { year: 2026, name: "Me", home: "/Users/me" });
const quote = (text: string) => ({ text, date: "2026-03-01", time: "01:00", agent: "codex" as const });

function wrapped(extra: Partial<Wrapped>): Wrapped {
  return { ...empty, ...extra };
}

describe("brief", () => {
  test("cards carry the user's numbers, and only the cards the cut shows", () => {
    const angry = brief(wrapped({ swears: { ...empty.swears, total: 350, please: 424, words: [{ name: "shit", count: 350 }] } }), "rage");
    expect(angry).toContain('"I swore at my AI 350 times this year"');
    expect(angry).toContain("424 pleases vs 350 swears");

    const calm = brief(empty, "rage");
    expect(calm).not.toContain("rageHook");
    expect(calm).toContain("rageAsk");
  });

  test("quotes the loudest lines and the agent owning up, never a masked or multi-line one", () => {
    const w = wrapped({
      promptSamples: [quote("add a test"), quote("WHY IS THE BUILD RED AGAIN"), quote("fuck, revert it"), quote("the key is ******** use it now!!"), quote("fuck\nthis")],
      exchangeSamples: [
        { ...quote("did you break my tmux config"), reply: "Yes, I broke the status format." },
        { ...quote("did you fuck up the tests"), reply: "Running them now." },
      ],
    });
    const out = brief(w, "chat");
    expect(out).toContain('"fuck, revert it"');
    expect(out).toContain('"WHY IS THE BUILD RED AGAIN"');
    expect(out).not.toContain("add a test");
    expect(out).not.toContain("********");
    expect(out).not.toContain("fuck\nthis");
    expect(out).toContain('"did you break my tmux config" -> Codex: "Yes, I broke the status format."');
    expect(out).not.toContain("Running them now");
  });
});
