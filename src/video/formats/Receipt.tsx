// The receipt: the year printed on thermal paper, line by line, ending in a
// barcode. The paper feeds up as it prints, so the newest line stays in view.
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { MONO } from "../fonts.ts";
import { big, hours, int } from "../format.ts";
import { BEAT } from "../plan.ts";
import { useLayout, type CardProps } from "../ui.tsx";
import { Art } from "../Art.tsx";
import { Punch } from "../cards/Social.tsx";

/** A line prints every half beat, as the soundtrack clicks. */
const LINE = BEAT / 2;

export function Receipt({ w, field, line }: CardProps) {
  const { square, width, height } = useLayout();
  const frame = useCurrentFrame();
  const rows: ([string, string] | string)[] = [
    "AGENT WRAPPED MART",
    `${w.year} · REG 01 · ${int(w.totals.sessions)} VISITS`,
    "",
    ["HOURS", hours(w.totals.hours)],
    ["SESSIONS", int(w.totals.sessions)],
    ["PROMPTS", int(w.totals.prompts)],
    ["TOKENS", big(w.totals.tokens)],
    ["TOOL CALLS", int(w.totals.toolCalls)],
    ["AGENTS", int(w.agents.length)],
    ["TIMES I SAID NO", int(w.corrections.total)],
    ["SWEARS", int(w.swears.total)],
    ["PLEASE", int(w.swears.please)],
    ["FAILED CMDS", int(w.totals.failedCommands)],
    ["SLEEP", "0.00"],
    "",
    ["TOTAL", (w.persona.title.trim() || "1 AGENT WRANGLER").toUpperCase()],
    "",
    "BARCODE",
    ...(line ? line.toUpperCase().split("\n").slice(0, 2) : ["THANK YOU FOR PROMPTING", "NO REFUNDS. NO SLEEP."]),
  ];
  const printed = Math.min(rows.length, Math.floor(frame / LINE) + 1);
  const size = square ? 30 : 40;
  const lineHeight = size * 1.5;
  const paperWidth = Math.min(width * 0.82, 820);
  // Feed the paper up once the printed part passes the middle of the frame.
  const feed = Math.max(0, printed * lineHeight - height * 0.55);
  return (
    // TOTAL is row 15, so it prints on beat 7.5, with the ka-ching.
    <Punch at={[7.5]}>
    <AbsoluteFill style={{ background: field.bg, alignItems: "center", overflow: "hidden" }}>
      <Art name="receipt" dim={0.15} />
      <div style={{ marginTop: square ? 60 : 160, translate: `0 ${-feed}px`, width: paperWidth, background: "#fbfaf5", color: "#1b1b1b", fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: `${lineHeight}px`, padding: "36px 44px" }}>
        {rows.slice(0, printed).map((row, i) => {
          if (row === "BARCODE") {
            return (
              <div key={i} style={{ display: "flex", height: lineHeight * 2, gap: 3, margin: "8px 0" }}>
                {Array.from({ length: 46 }, (_, bar) => (
                  <div key={bar} style={{ flex: random(`bar${bar}`) > 0.5 ? 2 : 1, background: random(`gap${bar}`) > 0.3 ? "#1b1b1b" : "transparent" }} />
                ))}
              </div>
            );
          }
          if (typeof row === "string") return <div key={i} style={{ textAlign: "center", borderBottom: row === "" ? "3px dashed #1b1b1b" : "none", height: row === "" ? lineHeight / 2 : undefined, marginBottom: row === "" ? lineHeight / 2 : 0, fontWeight: i === 0 ? 800 : 700, fontSize: i === 0 ? size * 1.3 : size }}>{row}</div>;
          const [name, value] = row;
          const total = name === "TOTAL";
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: total ? size * 1.15 : size, fontWeight: total ? 800 : 700 }}>
              <span>{name}</span>
              <span style={{ textAlign: "right" }}>{value}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
    </Punch>
  );
}
