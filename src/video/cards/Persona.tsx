import { Burst } from "../Shapes.tsx";
import { MONO } from "../fonts.ts";
import { Card, Fit, Rise, display, useLayout, type CardProps } from "../ui.tsx";

export const INSTALL = "npx skills add vkpdeveloper/agent-wrapped";

export function Persona({ w, field }: CardProps) {
  const { square, inner, pad } = useLayout();
  const title = w.persona.title.trim() || "Certified agent wrangler";
  const line = w.persona.line.trim();

  return (
    <Card field={field} eyebrow="Your persona" shapes={<Burst field={field} x={0.82} y={square ? 0.3 : 0.32} size={square ? 640 : 900} delay={2} strength={30} />}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 16 : 28, paddingBottom: square ? 24 : 48 }}>
        <Rise delay={6}>
          <div style={{ fontSize: square ? 56 : 72, fontWeight: 700, letterSpacing: "-0.03em" }}>You are</div>
        </Rise>
        <Rise delay={12} distance={90}>
          <Fit text={title} width={inner} max={square ? 150 : 210} min={72} lines={3} type={display(800, 0.92)} />
        </Rise>
        {line ? (
          <Rise delay={26}>
            <Fit text={line} width={inner} max={square ? 46 : 56} min={36} lines={square ? 3 : 4} type={{ ...display(600, 1.15), letterSpacing: "-0.01em" }} />
          </Rise>
        ) : null}
      </div>
      {/* Full-bleed band, so the install command gets the whole width. */}
      <Rise
        delay={44}
        distance={120}
        style={{ margin: `0 ${-pad}px ${-pad}px`, padding: `${square ? 30 : 44}px ${pad}px ${square ? 40 : 64}px`, background: field.ink, color: field.bg }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
          <div style={{ ...display(800, 1), fontSize: square ? 60 : 76 }}>agent-wrapped</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Make yours</div>
        </div>
        <Fit text={INSTALL} width={inner} max={40} min={30} type={{ fontFamily: MONO, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.03em" }} style={{ marginTop: square ? 10 : 16 }} />
      </Rise>
    </Card>
  );
}
