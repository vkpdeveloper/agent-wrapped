// The humblebrag: the year as a LinkedIn thought-leadership post.
import { AbsoluteFill } from "remotion";
import { DISPLAY } from "../fonts.ts";
import { big, clock, int } from "../format.ts";
import { BEAT } from "../plan.ts";
import { Fit, Rise, display, useCount, useLayout, type CardProps } from "../ui.tsx";
import { Slam } from "../cards/Social.tsx";
import { Art } from "../Art.tsx";

const PAGE = "#f4f2ee";
const BLUE = "#0a66c2";
/** Each line of the post lands two beats after the last. The first is there on frame 0, as the thumbnail. */
const LINE_BEATS = 2;

function lines(w: CardProps["w"]): string[] {
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  return [
    `I'm humbled to announce that I spent ${int(w.totals.hours)} hours with AI agents this year.`,
    `Here's what ${int(w.totals.sessions)} sessions taught me about leadership:`,
    `1. Delegate. My agents made ${int(w.totals.toolCalls)} tool calls.`,
    `2. Give feedback. I told them no ${int(w.corrections.total)} times.`,
    late ? `3. Never stop. Latest night: ${late.time} ${late.half}.` : `3. Never stop. ${w.streak.days} days in a row.`,
    "Agree?",
  ];
}

export function Post({ w, field }: CardProps) {
  const { square, pad, inner } = useLayout();
  const post = lines(w);
  const likes = useCount(w.totals.tokens / 1_000_000, (post.length - 1) * LINE_BEATS * BEAT, BEAT * 4);
  const name = w.name || "Me";
  const text = square ? 34 : 46;
  return (
    <AbsoluteFill style={{ background: PAGE, color: "#191919", fontFamily: DISPLAY, padding: pad, justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 24, border: "2px solid #e0dfdc", padding: square ? 32 : 48, display: "flex", flexDirection: "column", gap: square ? 14 : 22 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div style={{ width: square ? 88 : 120, height: square ? 88 : 120, borderRadius: "50%", background: field.hi, color: field.bg, display: "grid", placeItems: "center", ...display(800, 1), fontSize: square ? 48 : 64 }}>{name[0]}</div>
          <div>
            <div style={{ ...display(800, 1.1), fontSize: square ? 40 : 52 }}>{name}</div>
            <div style={{ ...display(500, 1.2), fontSize: square ? 24 : 30, color: "#666" }}>Agent Wrangler | Prompt Engineer | Ex-Sleeper</div>
            <div style={{ ...display(500, 1.2), fontSize: square ? 22 : 28, color: "#666" }}>1d · Edited</div>
          </div>
        </div>
        {post.map((line, i) =>
          i === 0 ? (
            <div key={i} style={{ ...display(600, 1.25), fontSize: text }}>{line}</div>
          ) : (
            <Rise key={i} delay={i * LINE_BEATS * BEAT} distance={30}>
              <div style={{ ...display(i === post.length - 1 ? 800 : 600, 1.25), fontSize: i === post.length - 1 ? text * 1.4 : text, color: i === post.length - 1 ? BLUE : undefined }}>{line}</div>
            </Rise>
          ),
        )}
        {/* The post comes with a stock photo, as they do. Square has no room for it. */}
        {square ? null : (
          <div style={{ position: "relative", height: 300, borderRadius: 12, overflow: "hidden" }}>
            <Art name="linkedin" dim={0} />
          </div>
        )}
        <div style={{ borderTop: "2px solid #e0dfdc", paddingTop: 18, display: "flex", justifyContent: "space-between", ...display(600, 1), fontSize: square ? 26 : 32, color: "#666" }}>
          <span>
            <span style={{ color: BLUE, fontWeight: 800 }}>{big(likes)}</span> likes
          </span>
          <span>{int(w.totals.prompts)} comments · {int(w.corrections.total)} reposts</span>
        </div>
      </div>
      <Slam at={(post.length - 1) * LINE_BEATS + 1} from={1.8} rotate={-3} style={{ position: "absolute", left: pad, bottom: square ? 40 : 160, background: BLUE, color: "#fff", padding: "16px 28px" }}>
        <Fit text="Thoughts? Repost to help a dev in your network." width={inner - 60} max={square ? 40 : 52} min={28} lines={2} type={display(800, 1.1)} style={{ width: "auto" }} />
      </Slam>
    </AbsoluteFill>
  );
}
