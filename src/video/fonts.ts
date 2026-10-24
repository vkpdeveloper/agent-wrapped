// Fonts ship with the bundle so rendering never needs the network.
// Both are SIL Open Font License 1.1, see the license files in ./fonts.
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import bricolage from "./fonts/BricolageGrotesque.ttf";
import jetbrains from "./fonts/JetBrainsMono.ttf";

// Prefixed names, so a copy installed on the machine is never picked instead.
export const DISPLAY = "AW Bricolage";
export const MONO = "AW JetBrains Mono";

const loaded = Promise.all([
  new FontFace(DISPLAY, `url(${bricolage}) format("truetype")`, { weight: "200 800", stretch: "75% 100%" }).load(),
  new FontFace(MONO, `url(${jetbrains}) format("truetype")`, { weight: "100 800" }).load(),
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
