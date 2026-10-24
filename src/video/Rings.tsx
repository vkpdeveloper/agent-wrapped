import { interpolate, useCurrentFrame } from "remotion";
import type { AgentStat } from "../types.ts";
import { AGENT_COLORS, mix } from "./theme.ts";
import { useProgress } from "./ui.tsx";

/**
 * Activity rings, one per agent (up to four), outermost is the #1 agent.
 * Each ring closes in proportion to its sessions against the #1 agent's.
 */
export function Rings({ agents, size, bg, delay = 0 }: { agents: AgentStat[]; size: number; bg: string; delay?: number }) {
  const frame = useCurrentFrame();
  const shown = agents.slice(0, 4);
  const top = shown[0]?.sessions || 1;
  const stroke = size * (shown.length > 3 ? 0.072 : 0.09);
  const gap = stroke * 0.3;
  return (
    <svg width={size} height={size} style={{ rotate: `${interpolate(frame, [0, 300], [-90, -60])}deg`, overflow: "visible" }}>
      {shown.map((agent, i) => (
        <Ring
          key={agent.agent}
          r={size / 2 - stroke / 2 - i * (stroke + gap)}
          center={size / 2}
          stroke={stroke}
          color={AGENT_COLORS[agent.agent]}
          bg={bg}
          fraction={Math.max(0.08, agent.sessions / top)}
          delay={delay + i * 7}
        />
      ))}
    </svg>
  );
}

function Ring({ r, center, stroke, color, bg, fraction, delay }: { r: number; center: number; stroke: number; color: string; bg: string; fraction: number; delay: number }) {
  const t = useProgress(delay, 46);
  const circumference = 2 * Math.PI * r;
  return (
    <g>
      <circle cx={center} cy={center} r={r} fill="none" stroke={mix(color, bg, 22)} strokeWidth={stroke} opacity={Math.min(1, t * 3)} />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference * fraction * t} ${circumference}`}
        opacity={t > 0 ? 1 : 0}
      />
    </g>
  );
}
