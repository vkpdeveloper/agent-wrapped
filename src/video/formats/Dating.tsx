// Situationships: the user's agents as a dating life. A profile card per agent
// swipes in, and the stamp says what they are to each other.
import { MONO } from "../fonts.ts";
import { int } from "../format.ts";
import { SLAM_BEAT } from "../plan.ts";
import { AgentIcon } from "../AgentIcon.tsx";
import { AGENT_COLORS } from "../theme.ts";
import { Fit, Rise, display, useLayout, type CardProps } from "../ui.tsx";
import { Stat } from "../cards/Formats.tsx";
import { Frame, Slam, beats, lead } from "../cards/Social.tsx";
import type { AgentStat } from "../../types.ts";
import { Art } from "../Art.tsx";

function Profile({ w, agent, status, line, field }: { w: CardProps["w"]; agent: AgentStat; status: string; line: string; field: CardProps["field"] }) {
  const { square, inner } = useLayout();
  const total = w.agents.reduce((sum, a) => sum + a.sessions, 0) || 1;
  const color = AGENT_COLORS[agent.agent];
  return (
    <Frame field={field} punch={[SLAM_BEAT]}>
      <div style={lead(square)}>{status}</div>
      <Slam at={SLAM_BEAT} from={1.3} rotate={-4} style={{ marginTop: square ? 20 : 40, alignSelf: "center" }}>
        <div style={{ width: inner * 0.86, background: "#fff", color: "#111", borderRadius: 40, overflow: "hidden", border: `6px solid ${field.ink}` }}>
          <div style={{ height: square ? 260 : 520, background: color, display: "grid", placeItems: "center" }}>
            <AgentIcon agent={agent.agent} size={square ? 180 : 340} />
          </div>
          <div style={{ padding: square ? "18px 28px" : "30px 40px" }}>
            <Fit text={agent.name} width={inner * 0.86 - 80} max={square ? 64 : 88} min={40} type={display(800, 1)} />
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: square ? 26 : 34, marginTop: 10 }}>
              {int(agent.sessions)} dates · {Math.round((agent.sessions / total) * 100)}% match
            </div>
            <Rise delay={beats(2.5)}>
              <div style={{ ...display(700, 1.15), fontSize: square ? 34 : 46, marginTop: 14 }}>{line}</div>
            </Rise>
          </div>
        </div>
      </Slam>
    </Frame>
  );
}

export function DateHook({ w, field, line }: CardProps) {
  return <Stat field={field} settled top="My relationship status with AI:" value="It's complicated." sticker={line ?? `${w.agents.length} agents. 1 me.`} backdrop={<Art name="dating" scrim={field.bg} dim={0.5} />} />;
}

export function DateMain({ w, field, line }: CardProps) {
  const agent = w.agents[0];
  if (!agent) return null;
  return <Profile w={w} agent={agent} field={field} status="The main one" line={line ?? "We're exclusive. (We're not.)"} />;
}

export function DateEx({ w, field, line }: CardProps) {
  const agent = w.agents[1];
  if (!agent) return null;
  const signed = w.git.coAuthors.some((co) => agent.name.toLowerCase().startsWith(co.name.toLowerCase()));
  return <Profile w={w} agent={agent} field={field} status="The ex" line={line ?? (signed ? "Still signs my commits. Weird." : "We still talk. Sometimes.")} />;
}

export function DateTalking({ w, field, line }: CardProps) {
  const agent = w.agents.at(-1);
  if (!agent || w.agents.length < 3) return null;
  return <Profile w={w} agent={agent} field={field} status="Talking stage" line={line ?? `${int(agent.sessions)} ${agent.sessions === 1 ? "date" : "dates"}. Left on read.`} />;
}

export function DateFlags({ w, field, line }: CardProps) {
  return <Stat field={field} top="Red flags" value={int(w.corrections.total)} count={w.corrections.total} tail="times I told them no." sticker={line ?? "Turns out I'm the toxic one."} />;
}
