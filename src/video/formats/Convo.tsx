// The funniest back-and-forths with their agents, one per card, as the chat
// screen people screenshot: their message types in and sends, the agent types,
// and its reply lands on the hit. Lines show in whatever language they were typed.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { AgentIcon } from "../AgentIcon.tsx";
import { censor, Stat } from "../cards/Formats.tsx";
import { beats, Punch } from "../cards/Social.tsx";
import { DISPLAY, MONO } from "../fonts.ts";
import { clock, int } from "../format.ts";
import { CONVO_REPLY, CONVO_SEND, CONVO_TYPING } from "../plan.ts";
import { Fit, display, useEnter, useLayout, type CardProps } from "../ui.tsx";
import { AGENT_NAMES, type Exchange } from "../../types.ts";

export function ConvoHook({ w, field }: CardProps) {
  return <Stat field={field} top="I sent my AI" value={int(w.totals.prompts)} count={w.totals.prompts} tail="messages. It answered back." sticker="Real messages." />;
}

/** "2026-09-22", "19:45" -> "Tue, Sep 22 · 7:45 PM" */
function stamp(date: string, time: string): string {
  const day = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const { time: hm, half } = clock(time);
  return `${day} · ${hm.replace(/^0/, "")} ${half}`;
}

function Bubble({ text, me, at }: { text: string; me: boolean; at: number }) {
  const { square, inner } = useLayout();
  const pop = useEnter(beats(at), 12);
  const width = inner * (me ? 0.82 : 0.78);
  const size = square ? 60 : 88;
  return (
    <div style={{ alignSelf: me ? "flex-end" : "flex-start", scale: String(0.6 + 0.4 * pop), opacity: Math.min(1, pop * 2), transformOrigin: me ? "100% 100%" : "0% 100%", background: me ? "#0a84ff" : "#262628", color: "#fff", borderRadius: 40, padding: square ? "18px 28px" : "26px 36px", maxWidth: width }}>
      <Fit text={text} width={width - 72} max={size} min={36} lines={square ? 4 : 6} type={display(650, 1.18)} style={{ width: "auto", letterSpacing: "-0.01em" }} />
    </div>
  );
}

/** The message being written, a letter at a time, in the input bar. */
function Typing({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const shown = Math.round(text.length * Math.min(1, Math.max(0, (frame - beats(0.5)) / beats(CONVO_TYPING))));
  const sent = frame >= beats(CONVO_SEND);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, padding: square ? "18px 28px" : "26px 36px", borderTop: "2px solid #222", background: "#111" }}>
      <div style={{ flex: 1, minWidth: 0, border: "2px solid #333", borderRadius: 40, padding: "14px 28px", fontFamily: DISPLAY, fontWeight: 500, fontSize: square ? 30 : 38, color: sent ? "#666" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", direction: "rtl", textAlign: "left" }}>
        {/* rtl keeps the newest letters in view; the bdi keeps the text itself in order. */}
        <bdi>{sent ? "Message" : text.slice(0, shown) || "Message"}</bdi>
      </div>
      <div style={{ width: square ? 56 : 72, height: square ? 56 : 72, borderRadius: "50%", background: shown && !sent ? "#0a84ff" : "#333", display: "grid", placeItems: "center", color: "#fff", fontSize: square ? 30 : 40, fontWeight: 800, fontFamily: DISPLAY }}>↑</div>
    </div>
  );
}

/** Three dots bouncing in a grey bubble while the agent writes. */
function Dots() {
  const frame = useCurrentFrame();
  const { square } = useLayout();
  const size = square ? 16 : 20;
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", gap: size * 0.6, background: "#262628", borderRadius: 40, padding: square ? "24px 30px" : "30px 38px" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: size, height: size, borderRadius: "50%", background: "#8e8e93", translate: `0 ${-Math.max(0, Math.sin((frame - i * 4) / 4)) * size * 0.6}px` }} />
      ))}
    </div>
  );
}

function Screen({ line }: { line: Exchange }) {
  const frame = useCurrentFrame();
  const { square, pad } = useLayout();
  const icon = square ? 72 : 120;
  const sent = frame >= beats(CONVO_SEND);
  const replied = frame >= beats(CONVO_REPLY);
  return (
    <Punch at={[CONVO_REPLY]} amount={0.6}>
      <AbsoluteFill style={{ background: "#000", color: "#fff", fontFamily: DISPLAY, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#111", borderBottom: "2px solid #222", padding: `${square ? 40 : 110}px ${pad}px ${square ? 20 : 28}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <AgentIcon agent={line.agent} size={icon} round />
          <div style={{ ...display(800, 1), fontSize: square ? 40 : 56 }}>{AGENT_NAMES[line.agent]}</div>
        </div>
        {/* Centered, not pinned to the bottom like a real thread, so the lines sit where people look. */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 20 : 32, padding: `0 ${pad}px ${square ? 28 : 48}px` }}>
          <div style={{ alignSelf: "center", fontFamily: MONO, fontWeight: 600, fontSize: square ? 24 : 34, color: "#8e8e93", marginBottom: 8 }}>{stamp(line.date, line.time)}</div>
          {sent ? <Bubble text={censor(line.text)} me at={CONVO_SEND} /> : null}
          {sent && !replied ? <Dots /> : null}
          {replied ? (
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <AgentIcon agent={line.agent} size={square ? 52 : 72} round />
              <Bubble text={censor(line.reply)} me={false} at={CONVO_REPLY} />
            </div>
          ) : null}
        </div>
        <Typing text={censor(line.text)} />
      </AbsoluteFill>
    </Punch>
  );
}

/** The card for the `index`th exchange the skill's agent picked. */
export function exchange(index: number) {
  return function Exchange({ w }: CardProps) {
    const line = w.convo[index];
    return line ? <Screen line={line} /> : null;
  };
}
