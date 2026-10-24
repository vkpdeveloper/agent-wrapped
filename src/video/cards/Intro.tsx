import { Rings } from "../Rings.tsx";
import { AGENT_COLORS } from "../theme.ts";
import { Card, Fit, Rise, display, useEnter, useLayout, type CardProps } from "../ui.tsx";

// The title is already settled on frame 0, because X and Instagram use the first
// frame as the thumbnail. The rings and the legend carry the intro's motion.
const SETTLED = -60;

export function Intro({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const owner = w.name.trim() ? `${w.name.trim()}'s` : "Your";
  const ringSize = square ? 440 : 780;
  const textWidth = square ? inner - ringSize - 40 : inner;

  const title = (
    <div style={{ display: "flex", flexDirection: "column", gap: square ? 8 : 16 }}>
      <Rise delay={SETTLED}>
        <Fit text={owner} width={textWidth} max={square ? 110 : 150} min={44} lines={2} type={display(800, 1)} />
      </Rise>
      <Year year={w.year} width={textWidth} color={field.hi} />
      <Rise delay={SETTLED}>
        <Fit text={w.agents.length === 1 && w.agents[0] ? `with ${w.agents[0].name}` : "with coding agents"} width={textWidth} max={square ? 60 : 84} min={40} lines={2} type={display(700, 1)} />
      </Rise>
    </div>
  );

  return (
    <Card field={field} eyebrow="agent-wrapped">
      {square ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          {title}
          <Rings agents={w.agents} size={ringSize} bg={field.bg} delay={4} />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Rings agents={w.agents} size={ringSize} bg={field.bg} delay={4} />
          </div>
          {title}
        </>
      )}
      <Legend w={w} />
    </Card>
  );
}

/** The year, one span per digit. */
function Year({ year, width, color }: { year: number; width: number; color: string }) {
  const { square } = useLayout();
  const digits = String(year).split("");
  const size = Math.min(square ? 230 : 420, width / (digits.length * 0.56));
  return (
    <div style={{ ...display(800, 0.86, "75%"), fontSize: size, color, display: "flex", letterSpacing: "-0.02em" }}>
      {digits.map((digit, i) => (
        <Digit key={i} digit={digit} delay={SETTLED} />
      ))}
    </div>
  );
}

function Digit({ digit, delay }: { digit: string; delay: number }) {
  const t = useEnter(delay, 12);
  return <span style={{ display: "inline-block", translate: `0 ${(1 - t) * 120}px`, opacity: Math.min(1, t * 2) }}>{digit}</span>;
}

function Legend({ w }: { w: CardProps["w"] }) {
  const { square } = useLayout();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: 40, rowGap: 16, marginTop: square ? 40 : 56, fontSize: 40, fontWeight: 600 }}>
      {w.agents.slice(0, 6).map((agent, i) => (
        <Rise key={agent.agent} delay={30 + i * 5} distance={30} style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: AGENT_COLORS[agent.agent] }} />
          {agent.name}
        </Rise>
      ))}
    </div>
  );
}
