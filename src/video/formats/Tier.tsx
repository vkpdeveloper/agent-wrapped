// The tier list: every agent the user ran, ranked by share of sessions. D tier
// fills first and S lands last, on the drop.
import { int } from "../format.ts";
import { AgentIcon } from "../AgentIcon.tsx";
import { AGENT_COLORS } from "../theme.ts";
import { display, useLayout, type CardProps } from "../ui.tsx";
import { Stat } from "../cards/Formats.tsx";
import { Frame, Slam, lead } from "../cards/Social.tsx";
import type { AgentStat } from "../../types.ts";

const TIERS = [
  { name: "S", color: "#ff7f7f", min: 0.4 },
  { name: "A", color: "#ffbf7f", min: 0.15 },
  { name: "B", color: "#ffdf7f", min: 0.05 },
  { name: "C", color: "#bfff7f", min: 0.02 },
  { name: "D", color: "#7fbfff", min: 0 },
];
/** The first chip lands on beat 1, then one every half beat, as the soundtrack stamps. */
const TIER_START = 1;
const TIER_STEP = 0.5;

export function TierHook({ w, field }: CardProps) {
  return <Stat field={field} settled top="Ranking every AI agent I used" value={int(w.agents.length)} tail={w.agents.length === 1 ? "agent. Easy." : "agents."} sticker="By sessions. No mercy." />;
}

export function TierList({ w, field }: CardProps) {
  const { square } = useLayout();
  const total = w.agents.reduce((sum, agent) => sum + agent.sessions, 0) || 1;
  const placed = new Map<string, AgentStat[]>(TIERS.map((tier) => [tier.name, []]));
  for (const agent of w.agents) {
    const tier = TIERS.find((t) => agent.sessions / total >= t.min) ?? TIERS[TIERS.length - 1]!;
    placed.get(tier.name)!.push(agent);
  }
  // Worst first: the reveal ends on S tier.
  const order = [...w.agents].reverse();
  const row = square ? 150 : 220;
  return (
    <Frame field={field} punch={order.map((_, i) => TIER_START + i * TIER_STEP)} punchAmount={0.35}>
      <div style={lead(square)}>Agent tier list</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: square ? 20 : 40 }}>
        {TIERS.map((tier) => (
          <div key={tier.name} style={{ display: "flex", minHeight: row, background: "#1a1a1a" }}>
            <div style={{ width: row, flexShrink: 0, background: tier.color, color: "#111", display: "grid", placeItems: "center", ...display(800, 1), fontSize: row * 0.55 }}>{tier.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 10, alignContent: "center" }}>
              {placed.get(tier.name)!.map((agent) => (
                <Slam key={agent.agent} at={TIER_START + order.indexOf(agent) * TIER_STEP} from={2.2} rotate={order.indexOf(agent) % 2 ? 3 : -3}>
                  <div style={{ display: "flex", alignItems: "center", gap: square ? 10 : 14, background: AGENT_COLORS[agent.agent], color: "#111", padding: square ? "8px 16px 8px 8px" : "10px 22px 10px 10px", borderRadius: 18, ...display(800, 1), fontSize: square ? 34 : 46 }}>
                    <AgentIcon agent={agent.agent} size={square ? 52 : 72} />
                    {agent.name}
                  </div>
                </Slam>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
