// The agents' group chat, about the user. Messages pop in on the beat, the
// thread scrolls up, and the user gets the last word.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY, MONO } from "../fonts.ts";
import { clock, int } from "../format.ts";
import { BEAT, CHAT_BEATS } from "../plan.ts";
import { AgentIcon } from "../AgentIcon.tsx";
import { Fit, display, useEnter, useLayout, type CardProps } from "../ui.tsx";
import { censor, Stat } from "../cards/Formats.tsx";
import type { AgentStat } from "../../types.ts";

type Message = { from: AgentStat | "me"; text: string };

function thread(w: CardProps["w"]): Message[] {
  const [a, b = a, c = b] = w.agents;
  if (!a || !b || !c) return [];
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  const messages: Message[] = [
    { from: a, text: `they're back. session ${int(a.sessions)}` },
    { from: b, text: "they told me no again" },
    { from: c, text: "how many times is that" },
    { from: a, text: `${int(w.corrections.total)}. this year.` },
    { from: b, text: w.swears.total ? `lol. also swore at us ${int(w.swears.total)} times` : "lol. never swears though" },
    { from: c, text: "at least they say please" },
    { from: a, text: `${int(w.swears.please)} times. ok fair` },
    { from: b, text: late ? `it's ${late.time} ${late.half.toLowerCase()}. do they sleep` : "do they ever sleep" },
    { from: c, text: `${w.streak.days} day streak. no.` },
    { from: "me", text: "continue" },
  ];
  return messages.slice(0, CHAT_BEATS.length).map((m) => ({ ...m, text: censor(m.text) }));
}

function Bubble({ message, at }: { message: Message; at: number }) {
  const { square, inner } = useLayout();
  const pop = useEnter(at * BEAT, 12);
  const agent = message.from === "me" ? undefined : message.from;
  const me = !agent;
  const size = square ? 36 : 48;
  return (
    <div style={{ alignSelf: me ? "flex-end" : "flex-start", display: "flex", gap: 14, alignItems: "flex-end", scale: String(0.6 + 0.4 * pop), opacity: Math.min(1, pop * 2), transformOrigin: me ? "100% 100%" : "0% 100%" }}>
      {agent ? <AgentIcon agent={agent.agent} size={size * 1.4} round /> : null}
      <div>
        {agent ? <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: size * 0.5, color: "#9a9a9a", marginLeft: 16, marginBottom: 4 }}>{agent.name}</div> : null}
        <div style={{ background: me ? "#0a84ff" : "#262628", color: "#fff", borderRadius: 34, padding: `${square ? 14 : 20}px ${square ? 24 : 30}px`, maxWidth: inner * 0.78 }}>
          <Fit text={message.text} width={inner * 0.78 - 60} max={size} min={28} lines={3} type={display(600, 1.2)} style={{ width: "auto", letterSpacing: "0em" }} />
        </div>
      </div>
    </div>
  );
}

export function ChatHook({ field }: CardProps) {
  return <Stat field={field} settled top="I found my agents'" value="group chat" sticker="They talk about me." />;
}

export function Chat({ w }: CardProps) {
  const { square, pad, height } = useLayout();
  const frame = useCurrentFrame();
  const messages = thread(w);
  const shown = CHAT_BEATS.filter((at) => frame >= at * BEAT).length;
  const step = square ? 150 : 200;
  // Keep the newest message near the bottom once the thread fills the screen.
  const scroll = Math.max(0, shown * step - (height - (square ? 300 : 560)));
  return (
    <AbsoluteFill style={{ background: "#000", color: "#fff", fontFamily: DISPLAY }}>
      <div style={{ position: "absolute", inset: 0, padding: `${square ? 160 : 260}px ${pad}px 0`, translate: `0 ${-scroll}px`, display: "flex", flexDirection: "column", gap: square ? 18 : 28 }}>
        {messages.map((message, i) => (CHAT_BEATS[i]! * BEAT <= frame ? <Bubble key={i} message={message} at={CHAT_BEATS[i]!} /> : null))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: square ? 130 : 220, background: "#111", borderBottom: "2px solid #222", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", paddingBottom: 18 }}>
        <div style={{ ...display(800, 1), fontSize: square ? 36 : 48 }}>the agents</div>
        <div style={{ fontFamily: MONO, fontSize: square ? 20 : 26, color: "#9a9a9a" }}>{w.agents.length} members · no humans</div>
      </div>
    </AbsoluteFill>
  );
}
