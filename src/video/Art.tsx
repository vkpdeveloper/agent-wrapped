import type { CSSProperties } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";

/** Generated backdrops in public/art/<name>.jpg, one look per format. They carry no text, so cards draw on top. */
export const ART = ["docu", "trailer", "news", "linkedin", "genz", "receipt", "speedrun", "dating", "rage", "grind", "boss"] as const;
export type ArtName = (typeof ART)[number];

/**
 * A full-bleed backdrop with a slow push in, under a flat scrim so type stays readable.
 * `scrim` is a color at `dim` opacity; pass the card's field.bg to keep its palette.
 */
export function Art({ name, scrim = "#000000", dim = 0.5, style }: { name: ArtName; scrim?: string; dim?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <Img src={staticFile(`art/${name}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", scale: String(1.04 + frame / 2400) }} />
      <AbsoluteFill style={{ background: scrim, opacity: dim }} />
    </AbsoluteFill>
  );
}
