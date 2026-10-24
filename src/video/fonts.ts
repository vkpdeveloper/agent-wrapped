// Fonts ship with the bundle so rendering never needs the network.
// All are SIL Open Font License 1.1, see the license files in ./fonts.
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import bricolage from "./fonts/BricolageGrotesque.ttf";
import jetbrains from "./fonts/JetBrainsMono.ttf";
import devanagari from "./fonts/NotoSansDevanagari.ttf";

// Prefixed names, so a copy installed on the machine is never picked instead.
const BRICOLAGE = "AW Bricolage";
const JETBRAINS = "AW JetBrains Mono";
// Quoted lines can be in Hindi; the browser falls back to it only for Devanagari glyphs.
const HINDI = "AW Noto Devanagari";

export const DISPLAY = `"${BRICOLAGE}", "${HINDI}"`;
export const MONO = `"${JETBRAINS}", "${HINDI}"`;

const loaded = Promise.all([
  new FontFace(BRICOLAGE, `url(${bricolage}) format("truetype")`, { weight: "200 800", stretch: "75% 100%" }).load(),
  new FontFace(JETBRAINS, `url(${jetbrains}) format("truetype")`, { weight: "100 800" }).load(),
  new FontFace(HINDI, `url(${devanagari}) format("truetype")`, { weight: "100 900", stretch: "62.5% 100%" }).load(),
]).then((faces) => {
  for (const face of faces) document.fonts.add(face);
});

/** False until the fonts are in. Text is measured for fitting, so nothing renders before then. */
export function useFonts(): boolean {
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loaded.then(() => setReady(true), cancelRender);
  }, []);
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
}
