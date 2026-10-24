import type { Ranked } from "../../types.ts";
import { MONO } from "../fonts.ts";
import { int, plural } from "../format.ts";
import { mix, type Field } from "../theme.ts";
import { Bar, Card, Clip, Fit, Rise, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";

export function Tools({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const calls = useCount(w.totals.toolCalls, 6, 36);
  const command = w.commands[0];
  const failure = w.failures[0];
  const runs = useCount(command?.count ?? 0, 40, 30);
  const tools = w.tools.slice(0, 6);
  const columnWidth = square && tools.length > 0 && command ? (inner - 56) / 2 : inner;

  const toolBars = tools.length > 0 ? <ToolBars tools={tools} field={field} /> : null;
  const commandBlock = command ? (
    <Rise delay={34}>
      <div style={{ background: field.ink, color: field.bg, borderRadius: 28, padding: square ? "26px 30px" : "40px 44px" }}>
        <div style={{ fontSize: 38, fontWeight: 600 }}>Your go-to command</div>
        <Fit
          text={`$ ${command.name}`}
          width={columnWidth - (square ? 60 : 88)}
          max={square ? 64 : 100}
          min={36}
          type={{ fontFamily: MONO, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.04em" }}
          style={{ marginTop: square ? 8 : 14 }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: square ? 4 : 8 }}>
          <div style={{ ...numerals(1), fontSize: square ? 72 : 96 }}>{int(runs)}</div>
          <div style={{ fontSize: square ? 40 : 48, fontWeight: 700 }}>{plural(command.count, "run")}</div>
        </div>
      </div>
      {failure ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, fontSize: square ? 38 : 44, fontWeight: 700, marginTop: square ? 20 : 32 }}>
          <Clip style={{ fontFamily: MONO, letterSpacing: "-0.03em", maxWidth: "100%" }}>{failure.name}</Clip>
          <div style={{ whiteSpace: "nowrap" }}>
            failed {int(failure.count)} {plural(failure.count, "time")}.
          </div>
        </div>
      ) : null}
    </Rise>
  ) : null;

  return (
    <Card field={field} eyebrow="Tools">
      <Rise delay={4} style={{ marginTop: square ? 24 : 56 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, flexWrap: "wrap" }}>
          <Fit text={int(w.totals.toolCalls)} show={int(calls)} width={inner} max={square ? 150 : 220} min={100} type={numerals(0.95)} style={{ width: "auto" }} />
          <div style={{ fontSize: square ? 56 : 72, fontWeight: 800, letterSpacing: "-0.03em" }}>tool calls</div>
        </div>
      </Rise>
      {square ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 56 }}>
          {toolBars ? <div style={{ width: columnWidth }}>{toolBars}</div> : null}
          {commandBlock ? <div style={{ width: columnWidth }}>{commandBlock}</div> : null}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
          {toolBars}
          {commandBlock}
        </div>
      )}
    </Card>
  );
}

function ToolBars({ tools, field }: { tools: Ranked[]; field: Field }) {
  const { square } = useLayout();
  const top = tools[0]?.count || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: square ? 16 : 26 }}>
      {tools.map((tool, i) => (
        <Rise key={tool.name} delay={12 + i * 5} distance={40}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: square ? 36 : 44, fontWeight: 700, marginBottom: 8 }}>
            <Clip>{tool.name}</Clip>
            <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{int(tool.count)}</div>
          </div>
          <Bar fraction={tool.count / top} delay={16 + i * 5} color={i === 0 ? field.hi : field.ink} track={mix(field.ink, field.bg, 10)} height={square ? 14 : 20} />
        </Rise>
      ))}
    </div>
  );
}
