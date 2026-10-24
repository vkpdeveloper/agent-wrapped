import type { AgentStat } from "../../types.ts";
import { AgentIcon } from "../AgentIcon.tsx";
import { MONO } from "../fonts.ts";
import { hours, int, model, plural } from "../format.ts";
import { AGENT_COLORS, mix, type Field } from "../theme.ts";
import { Bar, Card, Clip, Fit, Rise, display, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";

export function Agents({ w, field }: CardProps) {
  const top = w.agents[0];
  if (!top) return null;
  return w.agents.length === 1 ? <OnlyAgent agent={top} field={field} /> : <Ranking w={w} field={field} />;
}

/** On a light field the agent's own color can wash out, so fall back to ink if it is the background. */
function barColor(agent: AgentStat, field: Field): string {
  const color = AGENT_COLORS[agent.agent];
  return color.toLowerCase() === field.bg.toLowerCase() ? field.ink : color;
}

function Ranking({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const shown = w.agents.slice(0, square ? 3 : 4);
  const rest = w.agents.length - shown.length;
  const total = w.agents.reduce((sum, agent) => sum + agent.sessions, 0) || 1;
  const top = shown[0];
  if (!top) return null;

  return (
    <Card field={field} eyebrow="Your agents">
      <Rise delay={4} style={{ marginTop: square ? 28 : 72 }}>
        <div style={{ fontSize: square ? 48 : 60, fontWeight: 700, letterSpacing: "-0.02em" }}>Your #1 agent</div>
        <Fit text={top.name} width={inner} max={square ? 150 : 230} min={80} type={display(800, 1)} style={{ color: field.hi, marginTop: 4 }} />
      </Rise>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 26 : 52 }}>
        {shown.map((agent, i) => (
          <AgentRow key={agent.agent} agent={agent} share={agent.sessions / total} fraction={agent.sessions / top.sessions} field={field} delay={14 + i * 8} />
        ))}
      </div>
      {rest > 0 ? (
        <Rise delay={14 + shown.length * 8}>
          <Clip style={{ fontSize: 40, fontWeight: 600 }}>
            +{rest} more: {w.agents.slice(shown.length).map((agent) => agent.name).join(", ")}
          </Clip>
        </Rise>
      ) : null}
    </Card>
  );
}

function AgentRow({ agent, share, fraction, field, delay }: { agent: AgentStat; share: number; fraction: number; field: Field; delay: number }) {
  const { square } = useLayout();
  const sessions = useCount(agent.sessions, delay, 30);
  const topModel = agent.models[0];
  const detail = [`${int(sessions)} ${plural(agent.sessions, "session")}`, topModel ? model(topModel.name) : ""].filter(Boolean).join(", ");
  return (
    <Rise delay={delay} distance={50}>
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: square ? 10 : 14 }}>
        <AgentIcon agent={agent.agent} size={square ? 56 : 72} />
        <Clip style={{ flex: 1, fontSize: square ? 48 : 60, fontWeight: 800, letterSpacing: "-0.02em" }}>{agent.name}</Clip>
        <div style={{ ...numerals(1), fontSize: square ? 52 : 68 }}>{Math.round(share * 100)}%</div>
      </div>
      <Bar fraction={fraction} delay={delay + 4} color={barColor(agent, field)} track={mix(field.ink, field.bg, 9)} height={square ? 30 : 44} />
      <Clip style={{ fontFamily: MONO, fontSize: 36, fontWeight: 500, marginTop: square ? 8 : 12, opacity: 0.75, letterSpacing: "-0.02em" }}>{detail}</Clip>
    </Rise>
  );
}

function OnlyAgent({ agent, field }: { agent: AgentStat; field: Field }) {
  const { square, inner } = useLayout();
  const topModel = agent.models[0];
  const stats = [
    { value: hours(agent.hours), label: "hours" },
    { value: int(agent.prompts), label: plural(agent.prompts, "prompt") },
    { value: int(agent.toolCalls), label: plural(agent.toolCalls, "tool call") },
  ];
  return (
    <Card field={field} eyebrow="Your agent">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 24 : 40 }}>
        <Rise delay={6}>
          <div style={{ fontSize: square ? 64 : 80, fontWeight: 700, letterSpacing: "-0.03em" }}>One agent, all year.</div>
        </Rise>
        <Rise delay={12}>
          <div style={{ marginBottom: 20 }}>
            <AgentIcon agent={agent.agent} size={square ? 140 : 180} />
          </div>
          <Fit text={agent.name} width={inner} max={square ? 220 : 280} min={90} type={display(800, 0.92)} />
        </Rise>
        <Rise delay={20}>
          <div style={{ fontSize: square ? 48 : 60, fontWeight: 700 }}>
            {int(agent.sessions)} {plural(agent.sessions, "session")}
          </div>
        </Rise>
        <div style={{ display: "flex", gap: square ? 48 : 56, flexWrap: "wrap", marginTop: square ? 8 : 24 }}>
          {stats.map((stat, i) => (
            <Rise key={stat.label} delay={28 + i * 6}>
              <div style={{ ...numerals(1), fontSize: square ? 88 : 104, color: field.hi }}>{stat.value}</div>
              <div style={{ fontSize: 38, fontWeight: 600 }}>{stat.label}</div>
            </Rise>
          ))}
        </div>
        {topModel ? (
          <Rise delay={46}>
            <Clip style={{ fontFamily: MONO, fontSize: square ? 38 : 44, fontWeight: 600, marginTop: 16 }}>mostly {model(topModel.name)}</Clip>
          </Rise>
        ) : null}
      </div>
    </Card>
  );
}
