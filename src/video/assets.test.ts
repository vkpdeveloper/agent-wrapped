import { expect, test } from "bun:test";
import { AGENT_NAMES } from "../types.ts";
import { ART } from "./Art.tsx";
import { CUT_NAMES } from "./plan.ts";

// Cards load these from public/ by name, so a missing file renders a broken image.
const exists = (path: string) => Bun.file(new URL(`../../public/${path}`, import.meta.url)).exists();

test("every agent has a logo", async () => {
  for (const id of Object.keys(AGENT_NAMES)) expect(await exists(`logos/${id}.svg`)).toBe(true);
});

test("every backdrop has an image", async () => {
  for (const name of ART) expect(await exists(`art/${name}.jpg`)).toBe(true);
});

test("every cut has its music", async () => {
  for (const cut of CUT_NAMES) expect(await exists(`music/${cut}.m4a`)).toBe(true);
});

// SKILL.md shows these when the user picks a format.
test("every cut has a preview in the skill", async () => {
  for (const cut of CUT_NAMES) expect(await Bun.file(new URL(`../../skill/agent-wrapped/previews/${cut}.jpg`, import.meta.url)).exists()).toBe(true);
});
