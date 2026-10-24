// Agent% Any%: the year as a world-record speedrun, with LiveSplit-style splits.
import { useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { clock, day, int } from "../format.ts";
import { ROW_BEATS, SLAM_BEAT } from "../plan.ts";
import { Fit, display, numerals, useLayout, type CardProps } from "../ui.tsx";
import { Stat, Rows } from "../cards/Formats.tsx";
import { Frame, Sticker, lead, useKick } from "../cards/Social.tsx";
import { Art } from "../Art.tsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** Hours as a run timer: 724:12:30. */
function timer(h: number): string {
  return `${int(Math.floor(h))}:${pad((h % 1) * 60)}:${pad((h * 3600) % 60)}`;
}

/** The month the running total of hours first reached `goal`. */
function reached(byMonth: number[], goal: number): string | undefined {
  let total = 0;
  for (const [month, h] of byMonth.entries()) {
    total += h;
    if (total >= goal) return MONTHS[month];
  }
  return undefined;
}

// The clock is already running on frame 0, a minute of run time a second.
export function SrHook({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const frame = useCurrentFrame();
  const kick = useKick(0, 0.02);
  return (
    <Frame field={field} backdrop={<Art name="speedrun" scrim={field.bg} dim={0.55} />}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: square ? 40 : 52, opacity: 0.8 }}>AGENT% ANY% · {w.year}</div>
      <div style={lead(square)}>World record</div>
      <div style={{ scale: String(kick), transformOrigin: "0% 50%" }}>
        <Fit text={timer(w.totals.hours + frame / 60 / 30)} width={inner} max={square ? 230 : 300} min={100} type={{ ...numerals(1), fontFamily: MONO, fontWeight: 800, letterSpacing: "-0.04em" }} style={{ color: field.hi }} />
      </div>
      <Sticker at={4} field={field}>
        No resets. No sleep.
      </Sticker>
    </Frame>
  );
}

export function Splits({ w, field }: CardProps) {
  const { square } = useLayout();
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  const splits: [string, string][] = [
    ["First prompt", day(w.from)],
    ["100 hours", reached(w.byMonth, 100) ?? "-"],
    ...(late ? [["Latest night", `${late.time} ${late.half}`] as [string, string]] : []),
    ["500 hours", reached(w.byMonth, 500) ?? "-"],
    ["Final time", timer(w.totals.hours)],
  ];
  return (
    <Frame field={field} punch={ROW_BEATS} punchAmount={0.35}>
      <div style={lead(square)}>Splits</div>
      <Rows>
        {splits.slice(0, ROW_BEATS.length).map(([name, time], i, all) => {
          const gold = i === all.length - 1;
          return (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24, padding: square ? "10px 18px" : "16px 26px", background: gold ? field.ink : "transparent", color: gold ? field.bg : field.ink, borderBottom: gold ? "none" : `4px solid ${field.ink}` }}>
              <div style={{ ...display(800, 1), fontSize: square ? 48 : 68 }}>{name}</div>
              <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: square ? 44 : 60, color: gold ? field.hi : field.ink }}>{time}</div>
            </div>
          );
        })}
      </Rows>
    </Frame>
  );
}

export function Skips({ w, field }: CardProps) {
  const { square } = useLayout();
  const weekend = Math.round((w.byWeekday[0] ?? 0) + (w.byWeekday[6] ?? 0));
  const skips = [
    "Sleep",
    weekend > 0 ? `Weekends (${int(weekend)}h played)` : "Weekends",
    `Reading the docs (${int(w.totals.toolCalls)} tool calls)`,
    w.agents.length > 1 ? `${w.agents.length} agents at once` : "Writing code myself",
  ];
  return (
    <Frame field={field}>
      <div style={lead(square)}>Skips used</div>
      <Rows>
        {skips.map((skip) => (
          <div key={skip} style={{ ...display(800, 1.05), fontSize: square ? 52 : 74, display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: "0.55em", height: "0.55em", background: field.hi, flexShrink: 0 }} />
            <span>{skip}</span>
          </div>
        ))}
      </Rows>
      <Sticker at={SLAM_BEAT + 3} rotate={2} field={field}>
        Glitchless? Never heard of it.
      </Sticker>
    </Frame>
  );
}

export function Deaths({ w, field }: CardProps) {
  const n = w.totals.failedCommands;
  return <Stat field={field} top="Deaths" value={int(n)} count={n} tail="failed commands. Resets: 0." sticker="Skill issue? Never." />;
}
