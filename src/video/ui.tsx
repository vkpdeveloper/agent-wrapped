import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Wrapped } from "../types.ts";
import { fitSize, type Type } from "./fit.ts";
import { DISPLAY } from "./fonts.ts";
import type { Field } from "./theme.ts";

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export interface CardProps {
  w: Wrapped;
  field: Field;
}

/** On with --blur-projects. */
export const BlurProjects = createContext(false);

/**
 * Project names and session titles. With BlurProjects on, each letter becomes a
 * stand-in that does not depend on the real one, then it is blurred, so nothing
 * in the frame can be unblurred back into the name. Only the length survives.
 */
export function usePrivate(text: string): { text: string; style?: CSSProperties } {
  if (!useContext(BlurProjects)) return { text };
  let i = 0;
  const stand = text.replace(/[\p{L}\p{N}]/gu, () => String.fromCharCode(97 + Math.floor(random(`private-${i++}`) * 26)));
  return { text: stand, style: { filter: "blur(0.3em)" } };
}

export function useLayout() {
  const { width, height } = useVideoConfig();
  const square = width === height;
  const pad = square ? 80 : 96;
  return { square, width, height, pad, inner: width - pad * 2 };
}

/** 0 to 1 spring that starts `delay` frames into the card. */
export function useEnter(delay = 0, damping = 18): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7, stiffness: 140 } });
}

/** 0 to 1 over `duration` frames, eased, starting `delay` frames in. */
export function useProgress(delay: number, duration: number, easing = easeOut): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Counts from 0 to `value`, landing on the exact value. */
export function useCount(value: number, delay = 0, duration = 36): number {
  return value * useProgress(delay, duration, Easing.bezier(0.2, 0.7, 0.2, 1));
}

/** Fades and slides its children up into place. */
export function Rise({ delay = 0, distance = 60, children, style }: { delay?: number; distance?: number; children: ReactNode; style?: CSSProperties }) {
  const t = useEnter(delay, 20);
  return <div style={{ ...style, opacity: Math.min(1, t * 1.6), translate: `0 ${(1 - t) * distance}px` }}>{children}</div>;
}

export const display = (weight = 800, lineHeight = 0.92, fontStretch?: string): Type => ({
  fontFamily: DISPLAY,
  fontWeight: weight,
  lineHeight,
  letterSpacing: "-0.03em",
  fontStretch,
});

/** Condensed heavy numerals with fixed-width digits, so count-ups do not jitter. */
export const numerals = (lineHeight = 0.9): Type => ({ ...display(800, lineHeight, "75%"), fontVariantNumeric: "tabular-nums", letterSpacing: "0em" });

/**
 * Text that shrinks from `max` toward `min` until it fits `width` in `lines` lines.
 * If it still does not fit at `min`, it is clipped with an ellipsis.
 * `show` renders other text at the size fitted for `text`, for count-ups.
 */
export function Fit({ text, show, width, max, min, lines = 1, type, style }: { text: string; show?: string; width: number; max: number; min: number; lines?: number; type: Type; style?: CSSProperties }) {
  const { size, fits } = fitSize(text, { width, max, min, lines, type });
  const clip: CSSProperties = fits
    ? {}
    : lines === 1
      ? { overflow: "hidden", textOverflow: "ellipsis", lineHeight: Math.max(type.lineHeight, 1.15) }
      : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" };
  return (
    <div style={{ ...type, fontSize: size, width, ...(lines === 1 ? { whiteSpace: "nowrap" } : { textWrap: "balance" }), ...clip, ...style }}>
      {show ?? text}
    </div>
  );
}

/** Single-line text that ends in an ellipsis instead of overflowing its box. */
export function Clip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, lineHeight: 1.2, ...style }}>{children}</div>;
}

export function Eyebrow({ children, field }: { children: string; field: Field }) {
  const t = useEnter(2);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        fontFamily: DISPLAY,
        fontWeight: 700,
        fontSize: 36,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: t,
      }}
    >
      <div style={{ width: 56 * t, height: 10, background: field.ink }} />
      {children}
    </div>
  );
}

/** A bar that grows from the left to `fraction` of its track. */
export function Bar({ fraction, delay, color, track, height = 24 }: { fraction: number; delay: number; color: string; track: string; height?: number }) {
  const t = useProgress(delay, 30);
  return (
    <div style={{ height, background: track, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ height, width: `${Math.min(1, Math.max(fraction, 0.02)) * t * 100}%`, background: color, borderRadius: height / 2 }} />
    </div>
  );
}

/** The flat colored field every card sits on. */
export function Card({ field, eyebrow, children, shapes }: { field: Field; eyebrow?: string; children: ReactNode; shapes?: ReactNode }) {
  const { pad } = useLayout();
  return (
    <AbsoluteFill style={{ background: field.bg, color: field.ink, fontFamily: DISPLAY, overflow: "hidden" }}>
      {shapes}
      <AbsoluteFill style={{ padding: pad, display: "flex", flexDirection: "column" }}>
        {eyebrow ? <Eyebrow field={field}>{eyebrow}</Eyebrow> : null}
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
