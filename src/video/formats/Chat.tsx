// The agents' group chat, about the user. Messages pop in on the beat, the
// thread scrolls up, and the user gets the last word.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DISPLAY, MONO } from "../fonts.ts";
import { clock, int } from "../format.ts";
import { BEAT, CHAT_BEATS } from "../plan.ts";
import { AgentIcon } from "../AgentIcon.tsx";
import { Fit, display, useEnter, useLayout, type CardProps } from "../ui.tsx";
import { censor, Stat } from "../cards/Formats.tsx";
import { AGENT_NAMES, type AgentId } from "../../types.ts";

type Message = { from: AgentId | "me"; text: string };

function thread(w: CardProps["w"]): Message[] {
  // The skill's agent writes `chat` by hand: a sender with no logo would fail the render, so it is dropped.
  const written = w.chat.filter((m) => (m.from === "me" || m.from in AGENT_NAMES) && m.text?.trim());
  const messages = written.length ? written : builtIn(w);
  return messages.slice(0, CHAT_BEATS.length).map((m) => ({ ...m, text: censor(m.text) }));
}

/** The thread when the skill's agent wrote none: the user's numbers, gossiped about by their top three agents. */
function builtIn(w: CardProps["w"]): Message[] {
  const [first, second = first, third = second] = w.agents;
  if (!first || !second || !third) return [];
  const [a, b, c] = [first.agent, second.agent, third.agent];
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  return [
    { from: a, text: `they're back. session ${int(first.sessions)}` },
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
}

function Bubble({ message, at }: { message: Message; at: number }) {
  const { square, inner } = useLayout();
  const pop = useEnter(at * BEAT, 12);
  const agent = message.from === "me" ? undefined : message.from;
  const me = !agent;
  const size = square ? 36 : 48;
  return (
    <div style={{ alignSelf: me ? "flex-end" : "flex-start", display: "flex", gap: 14, alignItems: "flex-end", scale: String(0.6 + 0.4 * pop), opacity: Math.min(1, pop * 2), transformOrigin: me ? "100% 100%" : "0% 100%" }}>
      {agent ? <AgentIcon agent={agent} size={size * 1.4} round /> : null}
      <div>
        {agent ? <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: size * 0.5, color: "#9a9a9a", marginLeft: 16, marginBottom: 4 }}>{AGENT_NAMES[agent]}</div> : null}
        <div style={{ background: me ? "#0a84ff" : "#262628", color: "#fff", borderRadius: 34, padding: `${square ? 14 : 20}px ${square ? 24 : 30}px`, maxWidth: inner * 0.78 }}>
          <Fit text={message.text} width={inner * 0.78 - 60} max={size} min={28} lines={3} type={display(600, 1.2)} style={{ width: "auto", letterSpacing: "0em" }} />
        </div>
      </div>
    </div>
  );
}

export function ChatHook({ field, line }: CardProps) {
  return <Stat field={field} settled top="I found my agents'" value="group chat" sticker={line ?? "They talk about me."} />;
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
