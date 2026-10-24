import { Disc } from "../Shapes.tsx";
import { int, plural } from "../format.ts";
import { Card, Clip, Fit, Rise, display, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";

export function Corrections({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const { total, rate, phrases } = w.corrections;
  const counted = useCount(total, 10, 36);
  const top = phrases[0]?.count || 1;
  const every = rate > 0 ? Math.max(1, Math.round(1 / rate)) : 0;

  return (
    <Card field={field} eyebrow="Pushback" shapes={<Disc field={field} x={0.1} y={square ? 0.95 : 0.92} size={square ? 520 : 760} strength={18} />}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Rise delay={4}>
          <div style={{ ...display(800, 1), fontSize: square ? 68 : 88 }}>You told your agent no</div>
        </Rise>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <Fit text={int(total)} show={int(counted)} width={inner * 0.7} max={square ? 280 : 420} min={120} type={numerals(0.9)} style={{ width: "auto", color: field.hi }} />
          <Rise delay={20}>
            <div style={{ ...display(800, 1), fontSize: square ? 68 : 88 }}>{plural(total, "time")}.</div>
          </Rise>
        </div>
        {every > 0 ? (
          <Rise delay={26}>
            <div style={{ fontSize: square ? 44 : 52, fontWeight: 600, marginTop: square ? 8 : 16 }}>
              That's 1 in every {int(every)} {plural(every, "prompt")}.
            </div>
          </Rise>
        ) : null}
      </div>
      {phrases.length > 0 ? (
        <div style={{ display: "flex", flexWrap: square ? "wrap" : "nowrap", flexDirection: square ? "row" : "column", columnGap: 44, rowGap: square ? 8 : 4 }}>
          {phrases.slice(0, square ? 4 : 5).map((phrase, i) => (
            <Rise key={phrase.name} delay={34 + i * 6} distance={40} style={{ display: "flex", alignItems: "baseline", gap: 18, minWidth: 0, maxWidth: inner }}>
              <Clip style={{ ...display(800, 1.1), fontSize: Math.round((square ? 44 : 56) + (square ? 28 : 44) * (phrase.count / top)), minWidth: 0 }}>
                “{phrase.name}”
              </Clip>
              <div style={{ fontSize: square ? 36 : 40, fontWeight: 700, opacity: 0.8 }}>{int(phrase.count)}</div>
            </Rise>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
