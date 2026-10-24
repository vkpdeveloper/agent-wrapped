// The movie trailer: black, letterboxed, one line a card in tracked caps, a
// braam under every one, and the persona as the title.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY } from "../fonts.ts";
import { int } from "../format.ts";
import { BEAT, SLAM_BEAT } from "../plan.ts";
import { Fit, Rise, display, useLayout, useProgress, type CardProps } from "../ui.tsx";
import { Art } from "../Art.tsx";
import { Punch } from "../cards/Social.tsx";

const SCREEN = { bg: "#000000", ink: "#f2f2f2", hi: "#f5c518" };

function Title({ text, sub, settled = false, gold = false }: { text: string; sub?: string; settled?: boolean; gold?: boolean }) {
  const { square, inner } = useLayout();
  const frame = useCurrentFrame();
  const t = useProgress(SLAM_BEAT * BEAT, BEAT * 1.5);
  const shown = settled ? 1 : t;
  const bar = square ? 120 : 300;
  return (
    <Punch at={settled ? [] : [SLAM_BEAT]}>
    <AbsoluteFill style={{ background: SCREEN.bg, color: gold ? SCREEN.hi : SCREEN.ink, fontFamily: DISPLAY, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <Art name="trailer" dim={0.55} />
      <div style={{ scale: String(1.08 - frame / 1500), opacity: shown, letterSpacing: `${0.3 - shown * 0.18}em`, textAlign: "center" }}>
        <Fit text={text} width={inner} max={square ? 110 : gold ? 150 : 120} min={50} lines={3} type={{ ...display(800, 1.05, "85%"), letterSpacing: "0.12em" }} style={{ textAlign: "center" }} />
      </div>
      {sub ? (
        <Rise delay={BEAT * 3} style={{ marginTop: 40 }}>
          <div style={{ ...display(600, 1.2), fontSize: square ? 36 : 48, letterSpacing: "0.2em", color: SCREEN.ink }}>{sub}</div>
        </Rise>
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000", borderBottom: "1px solid #111" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
    </AbsoluteFill>
    </Punch>
  );
}

export const TrailerWorld = ({ line }: CardProps) => <Title settled text={line ?? "IN A WORLD WHERE AGENTS WRITE THE CODE"} />;
export const TrailerOne = ({ line }: CardProps) => <Title text={line ?? "ONE DEVELOPER"} />;
export const TrailerHours = ({ w, line }: CardProps) => <Title text={line ?? `${int(w.totals.hours)} HOURS`} />;
export const TrailerSessions = ({ w, line }: CardProps) => <Title text={line ?? `${int(w.totals.sessions)} SESSIONS`} />;
export const TrailerNo = ({ w, line }: CardProps) => <Title text={line ?? `${int(w.corrections.total)} TIMES THE ANSWER WAS NO`} />;
export const TrailerTitle = ({ w, line }: CardProps) => <Title gold text={(w.persona.title.trim() || "THE AGENT WRANGLER").toUpperCase()} sub={line ?? 'COMING NEVER: "DONE."'} />;
