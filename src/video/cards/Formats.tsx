// One-joke social formats, each a short cut built around a single number:
// rage (swearing at the agent), loop (it doesn't listen), credit (who signs the
// commits), grind (the hours) and boss (managing a team of agents). Same rules as
// the social cut: first person, nothing about projects, and swears censored.
import type { ReactNode } from "react";
import { AgentIcon } from "../AgentIcon.tsx";
import { MONO } from "../fonts.ts";
import { day, hourLabel, hours, int, plural } from "../format.ts";
import { ROW_BEATS, SLAM_BEAT, STICKER_BEAT } from "../plan.ts";
import { Bar, Fit, Rise, display, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";
import { mix } from "../theme.ts";
import { Bubble } from "./Quotes.tsx";
import { Frame, Slam, Sticker, ask, beats, lead, useKick } from "./Social.tsx";
import { Art } from "../Art.tsx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "fucking" -> "f*cking": still readable, still postable. */
export function censor(text: string): string {
  return text
    .replace(/\b(f)u(ck)/gi, "$1*$2")
    .replace(/(sh)i(t)/gi, "$1*$2")
    .replace(/\b(d)a(mn)/gi, "$1*$2");
}

/** The usual format card: a lead-in, one huge value, a line under it and a punchline. */
export function Stat({ field, top, value, count, tail, sticker, settled = false, backdrop }: { field: CardProps["field"]; top: string; value: string; count?: number; tail?: string; sticker?: string; settled?: boolean; backdrop?: ReactNode }) {
  const { square, inner } = useLayout();
  const kick = useKick(settled ? 0 : SLAM_BEAT);
  const counted = useCount(count ?? 0, beats(SLAM_BEAT), beats(2));
  const big = (
    <div style={{ scale: String(kick), transformOrigin: "0% 60%" }}>
      <Fit text={value} show={count === undefined || settled ? undefined : int(counted)} width={inner} max={square ? 300 : 440} min={110} type={numerals(0.95)} style={{ color: field.hi }} />
    </div>
  );
  const under = tail ? <Fit text={tail} width={inner} max={square ? 64 : 96} min={44} lines={2} type={display(800, 1)} /> : null;
  return (
    // A settled hook is the thumbnail, so only its sticker hits.
    <Frame field={field} backdrop={backdrop} punch={settled ? [STICKER_BEAT] : [SLAM_BEAT, STICKER_BEAT]}>
      <Fit text={top} width={inner} max={square ? 64 : 96} min={44} lines={2} type={display(800, 1)} />
      {settled ? big : <Slam at={SLAM_BEAT} from={2}>{big}</Slam>}
      {settled ? under : <Rise delay={beats(2.5)}>{under}</Rise>}
      {sticker ? (
        <Sticker at={STICKER_BEAT} rotate={settled ? -2 : 2} field={field}>
          {sticker}
        </Sticker>
      ) : null}
    </Frame>
  );
}

/** Rows that slam in one per half beat, for lists. */
export function Rows({ children }: { children: ReactNode[] }) {
  const { square } = useLayout();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: square ? 14 : 28, marginTop: square ? 24 : 48 }}>
      {children.map((row, i) => (
        <Slam key={i} at={ROW_BEATS[i] ?? ROW_BEATS.length} from={1.6} rotate={i % 2 ? 1 : -1}>
          {row}
        </Slam>
      ))}
    </div>
  );
}

// Rage: how often the user swore at their agent.

export function RageHook({ w, field, line }: CardProps) {
  const swears = w.swears;
  const every = Math.max(1, Math.round(w.totals.prompts / swears.total));
  return <Stat field={field} settled top="I swore at my AI" value={int(swears.total)} tail="times this year." sticker={line ?? `1 in every ${int(every)} prompts.`} backdrop={<Art name="rage" scrim={field.bg} dim={0.6} />} />;
}

export function Swears({ w, field }: CardProps) {
  const { square } = useLayout();
  const words = w.swears.words.slice(0, ROW_BEATS.length);
  return (
    <Frame field={field} punch={ROW_BEATS} punchAmount={0.45}>
      <div style={lead(square)}>My vocabulary</div>
      <Rows>
        {words.map((word, i) => (
          <div key={word.name} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
            <div style={{ ...display(800, 1), fontSize: square ? 92 : 136, color: i === 0 ? field.hi : field.ink }}>{censor(word.name)}</div>
            <div style={{ ...numerals(1), fontSize: square ? 76 : 110 }}>×{int(word.count)}</div>
          </div>
        ))}
      </Rows>
    </Frame>
  );
}

export function RagePeak({ w, field, line }: CardProps) {
  const swears = w.swears;
  const month = swears.byMonth.indexOf(Math.max(...swears.byMonth));
  const hour = swears.byHour.indexOf(Math.max(...swears.byHour));
  const count = swears.byMonth[month] ?? 0;
  return <Stat field={field} top="Peak rage" value={MONTHS[month] ?? ""} tail={`${int(count)} swears in one month.`} sticker={line ?? `Worst hour: ${hourLabel(hour)}.`} />;
}

export function RageWorst({ w, field, line }: CardProps) {
  const { square } = useLayout();
  const worst = w.swears.worst;
  if (!worst) return null;
  return (
    <Frame field={field} punch={[STICKER_BEAT]}>
      <div style={lead(square)}>A real prompt I sent:</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: square ? 32 : 64 }}>
        <Bubble quote={{ text: censor(worst), date: w.to, time: "00:00", agent: w.agents[0]?.agent ?? "claude" }} index={0} field={field} meta={false} />
      </div>
      <Sticker at={STICKER_BEAT} rotate={2} field={field}>
        {line ?? "My agent: “Understood.”"}
      </Sticker>
    </Frame>
  );
}

export function Polite({ w, field, line }: CardProps) {
  const swears = w.swears;
  const top = swears.words[0];
  const against = top ? `and ${censor(top.name)} ${int(top.count)} times.` : `and swore ${int(swears.total)} times.`;
  return <Stat field={field} top="I said please" value={int(swears.please)} count={swears.please} tail={against} sticker={line ?? (swears.please > (top?.count ?? 0) ? "Polite, technically." : "Manners: optional.")} />;
}

// Loop: the session where the agent would not listen.

export function LoopHook({ w, field, line }: CardProps) {
  const loop = w.loop;
  return <Stat field={field} settled top="I told my agent no" value={int(loop.corrections)} tail="times in one session." sticker={line ?? "It still didn't listen."} />;
}

export function LoopLines({ w, field }: CardProps) {
  const { square } = useLayout();
  const lines = w.loop.lines.slice(0, 2);
  return (
    <Frame field={field}>
      <div style={lead(square)}>Highlights from that session:</div>
      <div style={{ display: "flex", flexDirection: "column", gap: square ? 24 : 44, marginTop: square ? 32 : 64 }}>
        {lines.map((text, i) => (
          <Bubble key={i} quote={{ text: censor(text), date: w.to, time: "00:00", agent: w.agents[0]?.agent ?? "claude" }} index={i} field={field} meta={false} />
        ))}
      </div>
    </Frame>
  );
}

export function Retries({ w, field, line }: CardProps) {
  const n = w.loop.retries;
  return <Stat field={field} top="It ran the same broken command" value={`${int(n)} times`} tail="in one session." sticker={line ?? "Expecting a different result."} />;
}

export function Failed({ w, field, line }: CardProps) {
  const n = w.totals.failedCommands;
  return <Stat field={field} top="My agents ran" value={int(n)} count={n} tail={`${plural(n, "command")} that failed.`} sticker={line ?? "None of them were mine."} />;
}

// Credit: who signed the commits.

export function CreditHook({ w, field, line }: CardProps) {
  const git = w.git;
  const top = git.coAuthors[0];
  return <Stat field={field} settled top="I made" value={int(git.commits)} tail="commits this year." sticker={line ?? (top ? `${top.name} signed ${int(top.count)} of them.` : "All mine. Allegedly.")} />;
}

export function Prs({ w, field, line }: CardProps) {
  const git = w.git;
  const name = git.coAuthors[0]?.name ?? "My agent";
  return <Stat field={field} top="My agents opened" value={int(git.prs)} count={git.prs} tail="pull requests." sticker={line ?? `${name} took credit on ${int(git.prsCredited)}.`} />;
}

export function CoAuthors({ w, field, line }: CardProps) {
  const { square } = useLayout();
  const git = w.git;
  const rows = git.coAuthors.slice(0, ROW_BEATS.length - 1);
  const most = rows[0]?.count ?? 1;
  return (
    <Frame field={field} punch={[...ROW_BEATS.slice(0, -1), STICKER_BEAT]} punchAmount={0.45}>
      <div style={lead(square)}>Signed my commits:</div>
      <Rows>
        {rows.map((row, i) => (
          <div key={row.name}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
              <div style={{ ...display(800, 1), fontSize: square ? 64 : 92 }}>{row.name}</div>
              <div style={{ ...numerals(1), fontSize: square ? 64 : 92, color: i === 0 ? field.hi : field.ink }}>{int(row.count)}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Bar fraction={row.count / most} delay={beats(ROW_BEATS[i] ?? 0)} color={i === 0 ? field.hi : field.ink} track={mix(field.ink, field.bg, 10)} height={square ? 18 : 26} />
            </div>
          </div>
        ))}
      </Rows>
      <Sticker at={STICKER_BEAT} rotate={2} field={field}>
        {line ?? "Never once asked for equity."}
      </Sticker>
    </Frame>
  );
}

export function Wrote({ w, field, line }: CardProps) {
  const { linesAdded, linesRemoved } = w.totals;
  return <Stat field={field} top="It wrote" value={`+${int(linesAdded)}`} tail={`lines. I deleted ${int(linesRemoved)}.`} sticker={line ?? "Who's the senior dev now?"} />;
}

// Grind: the hours.

export function GrindHook({ w, field, line }: CardProps) {
  const { hours: h } = w.busiestDay;
  return <Stat field={field} settled top="I worked" value={`${hours(h)} hours`} tail={`in one day, ${day(w.busiestDay.date)}.`} sticker={line ?? (h > 24 ? "Parallel agents. Don't ask." : "One very long day.")} backdrop={<Art name="grind" scrim={field.bg} dim={0.6} />} />;
}

export function Streak({ w, field, line }: CardProps) {
  const { days, from } = w.streak;
  return <Stat field={field} top="My streak" value={`${int(days)} ${plural(days, "day")}`} tail="in a row. No days off." sticker={line ?? `Since ${day(from)}. Send help.`} />;
}

export function Longest({ w, field, line }: CardProps) {
  return <Stat field={field} top="Longest session" value={`${hours(w.longestSession.hours)} hours`} tail="in one sitting." sticker={line ?? "Bathroom breaks: unconfirmed."} />;
}

export function Weekends({ w, field, line }: CardProps) {
  const weekend = (w.byWeekday[0] ?? 0) + (w.byWeekday[6] ?? 0);
  return <Stat field={field} top="On weekends" value={`${hours(weekend)} hours`} tail="with my agents." sticker={line ?? "What's a weekend?"} />;
}

// Boss: the user as a manager of agents.

export function BossHook({ w, field, line }: CardProps) {
  const n = w.agents.length;
  return <Stat field={field} settled top="I managed" value={int(n)} tail={`AI ${plural(n, "agent")} this year.`} sticker={line ?? "I'm basically a CTO now."} backdrop={<Art name="boss" scrim={field.bg} dim={0.6} />} />;
}

export function Delegated({ w, field, line }: CardProps) {
  const n = w.totals.toolCalls;
  return <Stat field={field} top="They made" value={int(n)} count={n} tail="tool calls for me." sticker={line ?? "So I didn't have to."} />;
}

export function Review({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const reviews = w.reviews.slice(0, ROW_BEATS.length - 1);
  return (
    <Frame field={field} punch={ROW_BEATS.slice(0, -1)} punchAmount={0.5}>
      <div style={lead(square)}>Performance review</div>
      <Rows>
        {reviews.map((review) => {
          // Reviews are written by hand, so match the agent by its display name.
          const agent = w.agents.find((a) => a.name.toLowerCase() === review.name.trim().toLowerCase());
          return (
            <div key={review.name} style={{ display: "flex", alignItems: "center", gap: square ? 24 : 36 }}>
              <div style={{ ...numerals(1), fontSize: square ? 120 : 190, color: field.hi, width: square ? 150 : 240, flexShrink: 0 }}>{review.grade}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: square ? 14 : 20 }}>
                  {agent ? <AgentIcon agent={agent.agent} size={square ? 52 : 76} /> : null}
                  <div style={{ ...display(800, 1), fontSize: square ? 56 : 84 }}>{review.name}</div>
                </div>
                <Fit text={review.line} width={inner - (square ? 174 : 276)} max={square ? 36 : 50} min={26} lines={2} type={{ fontFamily: MONO, fontWeight: 600, lineHeight: 1.25 }} style={{ marginTop: 6 }} />
              </div>
            </div>
          );
        })}
      </Rows>
    </Frame>
  );
}

export const RageAsk = ask("How bad is yours?");
export const LoopAsk = ask("Does yours listen?");
export const CreditAsk = ask("Who signs yours?");
export const GrindAsk = ask("What's your streak?");
export const BossAsk = ask("How big is your team?");
