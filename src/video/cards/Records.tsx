import { Disc } from "../Shapes.tsx";
import { day, hours, int, plural } from "../format.ts";
import { type Field } from "../theme.ts";
import { Card, Clip, Rise, numerals, useCount, useLayout, useProgress, type CardProps } from "../ui.tsx";

interface Best {
  label: string;
  value: number;
  format: (n: number) => string;
  unit: string;
  detail: string;
}

export function Records({ w, field }: CardProps) {
  const { square } = useLayout();
  const session = w.longestSession;
  const records: Best[] = [
    {
      label: "Longest session",
      value: session.hours,
      format: hours,
      unit: plural(session.hours, "hour"),
      detail: [day(session.date), session.title || session.project].filter(Boolean).join(": "),
    },
    {
      label: "Longest streak",
      value: w.streak.days,
      format: int,
      unit: "days in a row",
      detail: `${day(w.streak.from)} to ${day(w.streak.to)}`,
    },
    {
      label: "Busiest day",
      value: w.busiestDay.sessions,
      format: int,
      unit: plural(w.busiestDay.sessions, "session"),
      detail: `${day(w.busiestDay.date)}, ${hours(w.busiestDay.hours)} agent hours`,
    },
  ].filter((record) => record.value > 0 && !(record.label === "Longest streak" && record.value < 2));

  return (
    <Card field={field} eyebrow="Personal records" shapes={<Disc field={field} x={0.95} y={square ? 0.92 : 0.9} size={square ? 460 : 700} strength={26} />}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 18 : 40 }}>
        {records.map((record, i) => (
          <RecordBlock key={record.label} record={record} field={field} delay={8 + i * 12} first={i === 0} />
        ))}
      </div>
    </Card>
  );
}

function RecordBlock({ record, field, delay, first }: { record: Best; field: Field; delay: number; first: boolean }) {
  const { square } = useLayout();
  const counted = useCount(record.value, delay + 4, 32);
  const rule = useProgress(delay, 24);
  return (
    <div style={{ paddingTop: first ? 0 : square ? 18 : 40 }}>
      {first ? null : <div style={{ height: 6, width: `${rule * 100}%`, background: field.ink, marginBottom: square ? 18 : 40 }} />}
      <Rise delay={delay}>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{record.label}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginTop: 4 }}>
          <div style={{ ...numerals(0.95), fontSize: square ? 128 : 240, color: field.hi }}>{record.format(counted)}</div>
          <div style={{ fontSize: square ? 44 : 56, fontWeight: 800, letterSpacing: "-0.02em" }}>{record.unit}</div>
        </div>
        <Clip style={{ fontSize: square ? 38 : 44, fontWeight: 600, marginTop: 6 }}>{record.detail}</Clip>
      </Rise>
    </div>
  );
}
