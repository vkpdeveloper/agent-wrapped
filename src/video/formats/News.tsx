// Breaking news: a studio, a red chyron, the headline in caps and a ticker of
// the user's numbers that never stops.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY, MONO } from "../fonts.ts";
import { big, clock, hours, int } from "../format.ts";
import { SLAM_BEAT } from "../plan.ts";
import { Fit, display, numerals, useLayout, type CardProps } from "../ui.tsx";
import { Art } from "../Art.tsx";
import { Punch, Slam, useKick } from "../cards/Social.tsx";

const STUDIO = { bg: "#0a1633", ink: "#ffffff", hi: "#e11d2a" };

function ticker(w: CardProps["w"]): string {
  const items = [
    `${int(w.totals.sessions)} SESSIONS`,
    `${hours(w.totals.hours)} HOURS`,
    `${big(w.totals.tokens)} TOKENS`,
    `${int(w.totals.prompts)} PROMPTS`,
    `${int(w.totals.failedCommands)} FAILED COMMANDS`,
    `${w.streak.days}-DAY STREAK`,
    `TOP AGENT: ${(w.agents[0]?.name ?? "").toUpperCase()}`,
  ];
  return `${items.join("  ///  ")}  ///  `.repeat(3);
}

function Broadcast({ w, value, headline, settled = false }: { w: CardProps["w"]; value: string; headline: string; settled?: boolean }) {
  const { square, pad, inner, height } = useLayout();
  const frame = useCurrentFrame();
  const kick = useKick(settled ? 0 : SLAM_BEAT, 0.025);
  const box = (
    <div style={{ scale: String(kick), border: `8px solid ${STUDIO.ink}`, padding: square ? "10px 30px" : "20px 44px", background: "#132a5e" }}>
      <Fit text={value} width={inner - 100} max={square ? 260 : 380} min={100} type={numerals(0.95)} style={{ width: "auto", color: STUDIO.ink }} />
    </div>
  );
  return (
    <Punch at={settled ? [] : [SLAM_BEAT]}>
    <AbsoluteFill style={{ background: STUDIO.bg, color: STUDIO.ink, fontFamily: DISPLAY, overflow: "hidden" }}>
      <Art name="news" scrim={STUDIO.bg} dim={0.4} />
      <div style={{ position: "absolute", top: pad, left: pad, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ background: STUDIO.hi, padding: "6px 18px", ...display(800, 1.1), fontSize: square ? 30 : 40 }}>LIVE</div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: square ? 26 : 34 }}>AGENT NEWS NETWORK</div>
      </div>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: height * 0.18 }}>{settled ? box : <Slam at={SLAM_BEAT} from={1.6}>{box}</Slam>}</AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: square ? 70 : 200 }}>
        <div style={{ marginLeft: pad, display: "inline-block", background: STUDIO.hi, padding: "8px 22px", ...display(800, 1.1), fontSize: square ? 30 : 42 }}>BREAKING NEWS</div>
        <div style={{ background: "#fff", color: "#0a1633", padding: `${square ? 14 : 22}px ${pad}px` }}>
          <Fit text={headline} width={inner} max={square ? 52 : 70} min={30} lines={3} type={display(800, 1.05, "85%")} />
        </div>
        <div style={{ background: "#000", color: "#ffd400", padding: "10px 0", overflow: "hidden", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: square ? 26 : 34 }}>
          <div style={{ translate: `${-((frame * 6) % 2400)}px 0` }}>{ticker(w)}</div>
        </div>
      </div>
    </AbsoluteFill>
    </Punch>
  );
}

export function NewsHook({ w, line }: CardProps) {
  return <Broadcast settled w={w} value={int(w.swears.total || w.corrections.total)} headline={line ?? (w.swears.total ? `LOCAL DEV SWEARS AT AI ${int(w.swears.total)} TIMES THIS YEAR` : `LOCAL DEV TELLS AI "NO" ${int(w.corrections.total)} TIMES THIS YEAR`)} />;
}

export function NewsRetry({ w, line }: CardProps) {
  return <Broadcast w={w} value={`${w.loop.retries}x`} headline={line ?? `AGENT RUNS SAME BROKEN COMMAND ${w.loop.retries} TIMES, EXPECTS DIFFERENT RESULT`} />;
}

export function NewsNight({ w, line }: CardProps) {
  const late = w.lateNight ? clock(w.lateNight.time) : { time: "00:00", half: "AM" };
  return <Broadcast w={w} value={late.time} headline={line ?? `DEV SPOTTED AWAKE AT ${late.time} ${late.half}, WITNESSES SAY "STILL PROMPTING"`} />;
}

export function NewsCredit({ w, line }: CardProps) {
  const top = w.git.coAuthors[0];
  return <Broadcast w={w} value={int(top?.count ?? 0)} headline={line ?? `${(top?.name ?? "AI").toUpperCase()} TAKES CREDIT FOR ${int(top?.count ?? 0)} COMMITS. DEV "NOT SURPRISED"`} />;
}

export function NewsHours({ w, line }: CardProps) {
  return <Broadcast w={w} value={`${int(w.totals.hours)}h`} headline={line ?? `EXPERTS CONFIRM ${int(w.totals.hours)} HOURS WITH AI AGENTS IS "A LOT"`} />;
}
