import { AGENT_NAMES, type Quote } from "../../types.ts";
import { MONO } from "../fonts.ts";
import { clock, day } from "../format.ts";
import { BEAT, QUOTE_BEATS, QUOTE_TYPING, quoteCount } from "../plan.ts";
import type { Field } from "../theme.ts";
import { Card, Fit, Rise, display, useEnter, useLayout, useProgress, type CardProps } from "../ui.tsx";

// The user's own lines, picked by the skill's agent, typed out like sent messages on the beat.
export function Quotes({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const lines = w.quotes.lines.slice(0, quoteCount(w, square ? "square" : "vertical", "full"));
  const title = w.quotes.title.trim() || "Things you actually typed.";

  return (
    <Card field={field} eyebrow="In your own words">
      <Rise delay={4} style={{ marginTop: square ? 24 : 56 }}>
        <Fit text={title} width={inner} max={square ? 80 : 112} min={56} lines={2} type={display(800, 0.95)} />
      </Rise>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: square ? 16 : 36, paddingTop: square ? 24 : 80 }}>
        {lines.map((quote, i) => (
          <Bubble key={i} quote={quote} index={i} field={field} />
        ))}
      </div>
    </Card>
  );
}

/** One quote typing out on its beat. `meta` adds who it went to and when. */
export function Bubble({ quote, index, field, meta = true }: { quote: Quote; index: number; field: Field; meta?: boolean }) {
  const { square, inner } = useLayout();
  const start = (QUOTE_BEATS[index] ?? 0) * BEAT;
  const pop = useEnter(start, 11);
  const typed = useProgress(start, QUOTE_TYPING * BEAT, (x) => x);
  if (pop <= 0.001) return null;
  const text = quote.text.replace(/\s+/g, " ").trim();
  const { time, half } = clock(quote.time);
  const padX = square ? 28 : 38;
  const width = inner * 0.92;
  // The JSON is edited by hand, so an unknown agent shows as its id.
  const agent = AGENT_NAMES[quote.agent] ?? quote.agent;

  return (
    <div style={{ alignSelf: "flex-end", maxWidth: width, scale: String(0.7 + 0.3 * pop), rotate: `${(index % 2 ? 1.2 : -1.2) * pop}deg`, opacity: Math.min(1, pop * 2), transformOrigin: "100% 100%" }}>
      {meta ? (
        <div style={{ fontFamily: MONO, fontSize: square ? 24 : 30, fontWeight: 600, opacity: 0.75, textAlign: "right", marginBottom: square ? 6 : 10 }}>
          you to {agent}, {day(quote.date)}, {time} {half}
        </div>
      ) : null}
      <div style={{ background: field.ink, color: field.bg, borderRadius: square ? 30 : 40, borderBottomRightRadius: 10, padding: `${square ? 18 : 26}px ${padX}px` }}>
        <Fit
          text={text}
          show={text.slice(0, Math.ceil(text.length * typed))}
          width={width - padX * 2}
          max={square ? 44 : 64}
          min={30}
          lines={3}
          type={{ ...display(700, 1.12), letterSpacing: "-0.01em" }}
          style={{ width: "auto" }}
        />
      </div>
    </div>
  );
}
