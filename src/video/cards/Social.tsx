// The social cut: one line per card, first person, landing on the beat. It shows
// numbers and the persona only, never projects, session titles, tools or models,
// so it is safe to post as is.
import type { CSSProperties, ReactNode } from "react";
import { random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../fonts.ts";
import { clock, hours, int, plural } from "../format.ts";
import { BEAT, NO_STAMPS, quoteCount, SLAM_BEAT, STICKER_BEAT } from "../plan.ts";
import { Card, Fit, Rise, display, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";
import { INSTALL } from "./Persona.tsx";
import { Bubble } from "./Quotes.tsx";

/** Beats into the card, in frames. The wipe in takes the first beat. */
const beats = (n: number) => n * BEAT;

/** 1, plus a kick on every beat from `from`: for the line that carries the card. */
function useKick(from = 0, amount = 0.035): number {
  const beat = useCurrentFrame() / BEAT;
  return beat < from ? 1 : 1 + amount * Math.exp(-(beat % 1) * 6);
}

/** Slams in from `from` times its size on beat `at`. */
function Slam({ at, from = 2.2, rotate = 0, children, style }: { at: number; from?: number; rotate?: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < beats(at)) return null;
  const t = spring({ frame: frame - beats(at), fps, config: { damping: 12, stiffness: 260, mass: 0.6 } });
  return <div style={{ ...style, scale: String(from + (1 - from) * t), rotate: `${rotate}deg`, opacity: Math.min(1, t * 3) }}>{children}</div>;
}

/** A punchline on a band of ink, tilted like a sticker. */
function Sticker({ at, rotate = -2, field, children }: { at: number; rotate?: number; field: CardProps["field"]; children: string }) {
  const { square, inner } = useLayout();
  return (
    <Slam at={at} from={1.8} rotate={rotate} style={{ alignSelf: "flex-start", marginTop: square ? 28 : 56, background: field.ink, color: field.bg, padding: square ? "12px 22px" : "18px 30px", maxWidth: inner }}>
      <Fit text={children} width={inner - 60} max={square ? 56 : 76} min={36} lines={2} type={display(800, 1.05)} style={{ width: "auto" }} />
    </Slam>
  );
}

/** Every social card: centered, with the name of the thing in the corner so people can find it. */
function Frame({ field, children }: { field: CardProps["field"]; children: ReactNode }) {
  const { square } = useLayout();
  return (
    <Card field={field}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ fontFamily: MONO, fontSize: square ? 26 : 32, fontWeight: 700, opacity: 0.6 }}>agent-wrapped</div>
    </Card>
  );
}

const lead = (square: boolean): CSSProperties => ({ ...display(800, 1), fontSize: square ? 64 : 96 });

// Settled on frame 0: X and Instagram use the first frame as the thumbnail, and
// the first second decides whether anyone keeps watching.
export function Hook({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const kick = useKick(0);
  const total = w.totals.hours;
  const days = Math.floor(total / 24);
  return (
    <Frame field={field}>
      <div style={lead(square)}>I spent</div>
      <div style={{ scale: String(kick), transformOrigin: "0% 60%" }}>
        <Fit text={hours(total)} width={inner} max={square ? 340 : 520} min={160} type={numerals(0.95)} style={{ color: field.hi }} />
      </div>
      <Fit text={`hours with AI agents in ${w.year}.`} width={inner} max={square ? 64 : 96} min={48} lines={2} type={display(800, 1)} />
      {days >= 2 ? (
        <Sticker at={STICKER_BEAT} field={field}>
          {`That's ${int(days)} full days.`}
        </Sticker>
      ) : null}
    </Frame>
  );
}

export function Ride({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const top = w.agents[0];
  const kick = useKick(1);
  if (!top) return null;
  const total = w.agents.reduce((sum, agent) => sum + agent.sessions, 0) || 1;
  const others = w.agents.length - 1;
  return (
    <Frame field={field}>
      <div style={lead(square)}>My ride or die</div>
      <Slam at={SLAM_BEAT} from={2} style={{ scale: String(kick), transformOrigin: "0% 50%" }}>
        <Fit text={top.name} width={inner} max={square ? 180 : 260} min={90} lines={2} type={display(800, 0.95)} style={{ color: field.hi, marginTop: 8 }} />
      </Slam>
      <Rise delay={beats(3)}>
        <div style={{ ...display(700, 1.1), fontSize: square ? 48 : 64, marginTop: 16 }}>{Math.round((top.sessions / total) * 100)}% of my sessions.</div>
      </Rise>
      <Sticker at={STICKER_BEAT} rotate={2} field={field}>
        {others > 0 ? `Cheated on it with ${others} ${plural(others, "other")}.` : "Never cheated. Not once."}
      </Sticker>
    </Frame>
  );
}

export function Night({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const kick = useKick(1, 0.03);
  if (!w.lateNight) return null;
  const { time, half } = clock(w.lateNight.time);
  return (
    <Frame field={field}>
      <div style={lead(square)}>Latest night</div>
      <Slam at={SLAM_BEAT} from={2} style={{ display: "flex", alignItems: "baseline", gap: 20, scale: String(kick), transformOrigin: "0% 50%" }}>
        <div style={{ ...numerals(0.95), fontSize: square ? 250 : 360, color: field.hi }}>{time}</div>
        <div style={{ ...display(800, 1), fontSize: square ? 72 : 110 }}>{half}</div>
      </Slam>
      <Rise delay={beats(3)}>
        <Fit text="still prompting." width={inner} max={square ? 64 : 96} min={48} type={display(800, 1)} />
      </Rise>
      <Sticker at={STICKER_BEAT} field={field}>
        Sleep is a skill issue.
      </Sticker>
    </Frame>
  );
}

export function No({ w, field }: CardProps) {
  const { square, width, height, inner } = useLayout();
  const { total, rate } = w.corrections;
  const counted = useCount(total, beats(1), beats(3));
  const every = rate > 0 ? Math.max(1, Math.round(1 / rate)) : 0;
  return (
    <Frame field={field}>
      {NO_STAMPS.map((at, i) => (
        <div key={i} style={{ position: "absolute", left: 40 + random(`nx${i}`) * (width - 420), top: 120 + random(`ny${i}`) * (height - 420), opacity: 0.22 }}>
          <Slam at={at} from={2.6} rotate={(random(`nr${i}`) - 0.5) * 40}>
            <div style={{ ...display(800, 1, "75%"), fontSize: square ? 150 : 220, color: field.hi, border: `14px solid ${field.hi}`, borderRadius: 30, padding: "0 24px" }}>NO.</div>
          </Slam>
        </div>
      ))}
      <div style={lead(square)}>I told my agent no</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <Fit text={int(total)} show={int(counted)} width={inner * 0.72} max={square ? 300 : 440} min={140} type={numerals(0.95)} style={{ width: "auto", color: field.hi }} />
        <div style={lead(square)}>{plural(total, "time")}.</div>
      </div>
      {every > 0 ? (
        <Sticker at={STICKER_BEAT} rotate={2} field={field}>
          {`1 in every ${int(every)} prompts.`}
        </Sticker>
      ) : null}
    </Frame>
  );
}

export function Said({ w, field }: CardProps) {
  const { square } = useLayout();
  const lines = w.quotes.lines.slice(0, quoteCount(w, square ? "square" : "vertical", "social"));
  return (
    <Frame field={field}>
      <div style={lead(square)}>Things I actually typed:</div>
      <div style={{ display: "flex", flexDirection: "column", gap: square ? 24 : 44, marginTop: square ? 32 : 64 }}>
        {lines.map((quote, i) => (
          <Bubble key={i} quote={quote} index={i} field={field} meta={false} />
        ))}
      </div>
    </Frame>
  );
}

export function Reveal({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const frame = useCurrentFrame();
  const kick = useKick(2, 0.04);
  const title = w.persona.title.trim() || "Certified agent wrangler";
  const line = w.persona.line.trim();
  return (
    <Frame field={field}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: square ? 120 : 220, overflow: "hidden", whiteSpace: "nowrap", opacity: 0.18 }}>
        <div style={{ ...display(800, 1, "75%"), fontSize: square ? 140 : 200, translate: `${-frame * 9}px 0` }}>{`${title.toUpperCase()} · `.repeat(8)}</div>
      </div>
      <div style={lead(square)}>My agent persona</div>
      <Slam at={SLAM_BEAT} from={3} rotate={-2} style={{ scale: String(kick), transformOrigin: "0% 50%" }}>
        <Fit text={title} width={inner} max={square ? 150 : 220} min={80} lines={3} type={display(800, 0.92)} style={{ color: field.hi, marginTop: 12 }} />
      </Slam>
      {line ? (
        <Rise delay={beats(4)}>
          <Fit text={line} width={inner} max={square ? 48 : 64} min={36} lines={3} type={{ ...display(700, 1.12), letterSpacing: "-0.01em" }} style={{ marginTop: square ? 16 : 32 }} />
        </Rise>
      ) : null}
    </Frame>
  );
}

// A question, not a sign-off: people answer with their own, which is the point.
export function Ask({ field }: CardProps) {
  const { square, inner, pad } = useLayout();
  const kick = useKick(1, 0.05);
  return (
    <Card field={field}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Slam at={SLAM_BEAT} from={2.4} style={{ scale: String(kick), transformOrigin: "0% 50%" }}>
          <Fit text="What's yours?" width={inner} max={square ? 200 : 260} min={100} lines={2} type={display(800, 0.92)} style={{ color: field.hi }} />
        </Slam>
        <Rise delay={beats(3)}>
          <div style={{ ...display(700, 1.1), fontSize: square ? 48 : 64, marginTop: 20 }}>Make your own in one line.</div>
        </Rise>
      </div>
      <Rise delay={beats(2)} distance={120} style={{ margin: `0 ${-pad}px ${-pad}px`, padding: `${square ? 30 : 44}px ${pad}px ${square ? 40 : 64}px`, background: field.ink, color: field.bg }}>
        <div style={{ ...display(800, 1), fontSize: square ? 60 : 76 }}>agent-wrapped</div>
        <Fit text={INSTALL} width={inner} max={40} min={30} type={{ fontFamily: MONO, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.03em" }} style={{ marginTop: square ? 10 : 16 }} />
      </Rise>
    </Card>
  );
}
