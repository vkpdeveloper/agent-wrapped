// The nature documentary: the developer observed in the wild, letterboxed, with
// narration subtitles and a slow push in on the number behind them.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY } from "../fonts.ts";
import { clock, int } from "../format.ts";
import { BEAT, SLAM_BEAT } from "../plan.ts";
import { Fit, display, numerals, useLayout, useProgress, type CardProps } from "../ui.tsx";
import { censor } from "../cards/Formats.tsx";
import { Art } from "../Art.tsx";

const FILM = { bg: "#0e1a12", ink: "#f3efe4", hi: "#e9c46a" };

function Scene({ backdrop, line, settled = false }: { backdrop: string; line: string; settled?: boolean }) {
  const { square, pad, inner } = useLayout();
  const frame = useCurrentFrame();
  const typed = useProgress(SLAM_BEAT * BEAT, BEAT * 3, (x) => x);
  const shown = settled ? line : line.slice(0, Math.ceil(line.length * typed));
  const bar = square ? 90 : 220;
  return (
    <AbsoluteFill style={{ background: FILM.bg, color: FILM.ink, fontFamily: DISPLAY, overflow: "hidden" }}>
      <Art name="docu" scrim={FILM.bg} dim={0.35} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", scale: String(1 + frame / 900) }}>
        <Fit text={backdrop} width={inner} max={square ? 420 : 620} min={120} lines={2} type={numerals(0.9)} style={{ color: FILM.hi, opacity: 0.35, textAlign: "center" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: pad, right: pad, bottom: bar + (square ? 40 : 90), textAlign: "center" }}>
        <Fit text={line} show={shown} width={inner - 44} max={square ? 48 : 64} min={32} lines={3} type={display(600, 1.25)} style={{ margin: "0 auto", fontStyle: "italic", textAlign: "center", background: "rgba(0,0,0,0.55)", padding: "14px 22px", opacity: shown ? 1 : 0 }} />
      </div>
      <div style={{ position: "absolute", left: pad, top: bar + 30, ...display(700, 1), fontSize: square ? 24 : 30, letterSpacing: "0.2em", opacity: 0.7 }}>
        PLANET AGENT · EPISODE 1
      </div>
    </AbsoluteFill>
  );
}

export function DocHook({ w, line }: CardProps) {
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  return late ? (
    <Scene settled backdrop={late.time} line={line ?? `Here we observe the developer, still awake at ${late.time} ${late.half}.`} />
  ) : (
    <Scene settled backdrop={int(w.totals.hours)} line={line ?? `Here we observe the developer. ${int(w.totals.hours)} hours with its agents this year.`} />
  );
}

export function DocNo({ w, line }: CardProps) {
  return <Scene backdrop={int(w.corrections.total)} line={line ?? `When its agent disobeys, it says no. ${int(w.corrections.total)} times this year.`} />;
}

export function DocTongue({ w, line }: CardProps) {
  const [first, second] = w.swears.words;
  const words = [first, second].flatMap((word) => (word ? `${censor(word.name)}: ${int(word.count)}` : []));
  return <Scene backdrop={first ? censor(first.name).toUpperCase() : "..."} line={line ?? `It communicates in a primitive language. ${words.join(". ")}.`} />;
}

export function DocPlease({ w, line }: CardProps) {
  return <Scene backdrop={int(w.swears.please)} line={line ?? `And yet, remarkably, it says please. ${int(w.swears.please)} times.`} />;
}

export function DocName({ w, line }: CardProps) {
  const title = w.persona.title.trim() || "The Agent Wrangler";
  return <Scene backdrop={title} line={line ?? `Scientists have named this one: ${title}.`} />;
}
