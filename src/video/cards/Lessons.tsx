import { int, plural } from "../format.ts";
import { mix } from "../theme.ts";
import { Card, Fit, Rise, display, numerals, useLayout, type CardProps } from "../ui.tsx";

export function Lessons({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const lessons = w.lessons.slice(0, 3);
  const numberWidth = square ? 90 : 120;
  const textWidth = inner - numberWidth - 24;
  const heading = `${lessons.length === 1 ? "One rule" : `${lessons.length} rules`} for ${w.year + 1}.`;

  return (
    <Card field={field} eyebrow="Lessons learned">
      <Rise delay={4} style={{ marginTop: square ? 28 : 64 }}>
        <div style={{ ...display(800, 0.95), fontSize: square ? 96 : 128 }}>{heading}</div>
      </Rise>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 26 : 56 }}>
        {lessons.map((lesson, i) => (
          <Rise key={i} delay={14 + i * 10} distance={50} style={{ display: "flex", gap: 24, borderTop: i > 0 ? `4px solid ${mix(field.ink, field.bg, 25)}` : undefined, paddingTop: i > 0 ? (square ? 24 : 48) : 0 }}>
            <div style={{ ...numerals(0.85), fontSize: square ? 120 : 160, width: numberWidth, color: field.hi }}>{i + 1}</div>
            <div>
              <Fit text={lesson.rule} width={textWidth} max={square ? 48 : 60} min={36} lines={3} type={{ ...display(700, 1.08), letterSpacing: "-0.02em" }} />
              {lesson.count > 0 ? (
                <div style={{ fontSize: 36, fontWeight: 600, marginTop: 10, opacity: 0.75 }}>
                  Behind {int(lesson.count)} {plural(lesson.count, "correction")}
                </div>
              ) : null}
            </div>
          </Rise>
        ))}
      </div>
    </Card>
  );
}
