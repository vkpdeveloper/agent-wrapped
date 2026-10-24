import { Disc } from "../Shapes.tsx";
import { big, hours, int, plural } from "../format.ts";
import { mix } from "../theme.ts";
import { Card, Fit, Rise, display, numerals, useCount, useLayout, useProgress, type CardProps } from "../ui.tsx";

export function Hours({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const total = w.totals.hours;
  const only = w.agents.length === 1 ? w.agents[0] : undefined;
  const counted = useCount(total, 6, 40);
  const days = Math.floor(total / 24);
  const aside = days >= 2 ? `That's ${int(days)} full days.` : `Across ${int(w.totals.activeDays)} ${plural(w.totals.activeDays, "day")}.`;
  const stats = [
    { value: w.totals.sessions, label: plural(w.totals.sessions, "session") },
    { value: w.totals.prompts, label: plural(w.totals.prompts, "prompt") },
    { value: w.totals.tokens, label: "tokens" },
  ].filter((stat) => stat.value > 0);

  return (
    <Card field={field} eyebrow="Time with agents" shapes={<Disc field={field} x={square ? 0.92 : 1} y={square ? 0.1 : 0.2} size={square ? 520 : 900} delay={0} />}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Fit text={hours(total)} show={hours(counted)} width={inner} max={square ? 330 : 460} min={120} type={numerals()} />
        <Rise delay={14}>
          <Fit text={`hours with ${only ? only.name : "your agents"}`} width={inner} max={square ? 64 : 84} min={44} lines={2} type={display(800, 1)} />
        </Rise>
        <Rise delay={24}>
          <div style={{ fontSize: square ? 48 : 56, fontWeight: 600, marginTop: square ? 20 : 28, color: field.hi }}>{aside}</div>
        </Rise>
      </div>
      {square ? null : <Months byMonth={w.byMonth} field={field} />}
      <div style={{ display: "flex", flexDirection: square ? "row" : "column", gap: square ? 24 : 0, borderTop: `6px solid ${field.ink}` }}>
        {stats.map((stat, i) => (
          <Stat key={stat.label} {...stat} delay={30 + i * 7} square={square} rule={i > 0 && !square ? mix(field.ink, field.bg, 30) : undefined} width={square ? (inner - 48) / 3 : inner} />
        ))}
      </div>
    </Card>
  );
}

function Stat({ value, label, delay, square, rule, width }: { value: number; label: string; delay: number; square: boolean; rule?: string; width: number }) {
  const counted = useCount(value, delay, 30);
  return (
    <Rise delay={delay} distance={40} style={{ width, paddingTop: square ? 24 : 26, paddingBottom: square ? 0 : 26, borderTop: rule ? `3px solid ${rule}` : undefined }}>
      <div style={{ display: "flex", flexDirection: square ? "column" : "row", alignItems: square ? "flex-start" : "baseline", justifyContent: "space-between", gap: square ? 4 : 24 }}>
        <div style={{ ...numerals(1), fontSize: square ? 92 : 124 }}>{big(counted)}</div>
        <div style={{ fontSize: square ? 38 : 48, fontWeight: 600 }}>{label}</div>
      </div>
    </Rise>
  );
}

/** Hours per month as a strip of bars, the busiest month in the highlight color. */
function Months({ byMonth, field }: { byMonth: number[]; field: CardProps["field"] }) {
  const { inner } = useLayout();
  const max = Math.max(...byMonth, 0.0001);
  const best = byMonth.indexOf(Math.max(...byMonth));
  const gap = 14;
  const width = (inner - gap * 11) / 12;
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap, height: 180 }}>
        {byMonth.map((value, month) => (
          <MonthBar key={month} height={Math.max(12, (value / max) * 180)} width={width} delay={26 + month * 1.5} color={month === best ? field.hi : field.ink} />
        ))}
      </div>
      <Rise delay={26} distance={20} style={{ display: "flex", gap, marginTop: 12, fontSize: 36, fontWeight: 700 }}>
        {"JFMAMJJASOND".split("").map((letter, month) => (
          <div key={month} style={{ width, textAlign: "center", opacity: month === best ? 1 : 0.7 }}>
            {letter}
          </div>
        ))}
      </Rise>
    </div>
  );
}

function MonthBar({ height, width, delay, color }: { height: number; width: number; delay: number; color: string }) {
  const t = useProgress(delay, 24);
  return <div style={{ width, height: Math.max(12, height * t), background: color, borderRadius: 12, opacity: t > 0 ? 1 : 0 }} />;
}
