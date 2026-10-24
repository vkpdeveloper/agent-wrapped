import type { Moment } from "../../types.ts";
import { Orbit } from "../Shapes.tsx";
import { MONO } from "../fonts.ts";
import { WEEKDAYS, clock, day, hourLabel } from "../format.ts";
import { mix, type Field } from "../theme.ts";
import { Card, Clip, Rise, display, numerals, useLayout, useProgress, type CardProps } from "../ui.tsx";

function peak(values: number[]): number {
  return values.reduce((best, value, i) => (value > (values[best] ?? 0) ? i : best), 0);
}

export function Clock({ w, field }: CardProps) {
  const { square } = useLayout();
  const peakHour = peak(w.byHour);
  return (
    <Card field={field} eyebrow="When you code" shapes={<Orbit field={field} x={0.86} y={square ? 0.2 : 0.14} size={square ? 300 : 380} delay={4} />}>
      <Rise delay={6} style={{ marginTop: square ? 28 : 64 }}>
        <div style={{ fontSize: square ? 64 : 84, fontWeight: 700, letterSpacing: "-0.03em" }}>You peak at</div>
        <div style={{ ...display(800, 0.9), fontSize: square ? 150 : 230, color: field.hi }}>{peakHour === 0 ? "Midnight" : peakHour === 12 ? "Noon" : hourLabel(peakHour)}</div>
      </Rise>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <HourChart byHour={w.byHour} peakHour={peakHour} lateHour={w.lateNight ? Number(w.lateNight.time.slice(0, 2)) : undefined} field={field} />
      </div>
      {w.lateNight ? <LateNight moment={w.lateNight} field={field} /> : <Weekday byWeekday={w.byWeekday} field={field} />}
    </Card>
  );
}

function HourChart({ byHour, peakHour, lateHour, field }: { byHour: number[]; peakHour: number; lateHour?: number; field: Field }) {
  const { square, inner } = useLayout();
  const height = square ? 230 : 520;
  const max = Math.max(...byHour, 0.0001);
  const gap = square ? 8 : 10;
  const barWidth = (inner - gap * 23) / 24;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap, height }}>
        {byHour.map((value, hour) => (
          <HourBar
            key={hour}
            height={Math.max(barWidth / 2, (value / max) * height)}
            width={barWidth}
            delay={14 + hour * 1.2}
            color={hour === peakHour ? field.hi : hour === lateHour ? field.ink : mix(field.ink, field.bg, 34)}
          />
        ))}
      </div>
      <div style={{ position: "relative", height: 52, marginTop: 14, fontSize: 36, fontWeight: 600 }}>
        {[0, 6, 12, 18].map((hour) => (
          <div key={hour} style={{ position: "absolute", left: hour * (barWidth + gap), whiteSpace: "nowrap", opacity: 0.8 }}>
            {hourLabel(hour)}
          </div>
        ))}
      </div>
    </div>
  );
}

function HourBar({ height, width, delay, color }: { height: number; width: number; delay: number; color: string }) {
  const t = useProgress(delay, 26);
  return <div style={{ width, height: Math.max(width / 2, height * t), background: color, borderRadius: width / 2, opacity: t > 0 ? 1 : 0 }} />;
}

function LateNight({ moment, field }: { moment: Moment; field: Field }) {
  const { square } = useLayout();
  const { time, half } = clock(moment.time);
  const what = [moment.project, moment.title].filter(Boolean).join(": ");
  return (
    <Rise delay={44} style={{ borderTop: `6px solid ${field.ink}`, paddingTop: square ? 24 : 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ ...numerals(0.95), fontSize: square ? 120 : 170, color: field.hi }}>{time}</div>
        <div style={{ fontSize: square ? 56 : 72, fontWeight: 800 }}>{half}</div>
      </div>
      <div style={{ fontSize: square ? 46 : 56, fontWeight: 700, marginTop: 8 }}>{day(moment.date)}, still prompting.</div>
      {what ? <Clip style={{ fontFamily: MONO, fontSize: 36, fontWeight: 500, marginTop: 14, opacity: 0.75 }}>{what}</Clip> : null}
    </Rise>
  );
}

function Weekday({ byWeekday, field }: { byWeekday: number[]; field: Field }) {
  const { square } = useLayout();
  const best = WEEKDAYS[peak(byWeekday)] ?? "";
  return (
    <Rise delay={44} style={{ borderTop: `6px solid ${field.ink}`, paddingTop: square ? 24 : 36 }}>
      <div style={{ fontSize: square ? 46 : 56, fontWeight: 700 }}>Your favorite day</div>
      <div style={{ ...display(800, 0.95), fontSize: square ? 120 : 170, color: field.hi }}>{best}</div>
    </Rise>
  );
}
