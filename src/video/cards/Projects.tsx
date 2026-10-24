import { Stripes } from "../Shapes.tsx";
import { fitSize } from "../fit.ts";
import { hours, int, plural } from "../format.ts";
import { mix, type Field } from "../theme.ts";
import { Bar, Card, Clip, Fit, Rise, display, numerals, useCount, useLayout, type CardProps } from "../ui.tsx";

export function Projects({ w, field }: CardProps) {
  const { square, inner } = useLayout();
  const [top, ...rest] = w.projects;
  const topHours = useCount(top?.hours ?? 0, 12, 36);
  if (!top) return null;
  const name = top.name || "Unnamed";
  // Stay on one line while the name is still big; only long names wrap (at hyphens, usually).
  const max = square ? 130 : 190;
  const oneLine = fitSize(name, { width: inner, max, min: max * 0.6, type: display(800, 1.05) }).fits;
  const more = w.totals.projects - w.projects.length;

  return (
    <Card field={field} eyebrow="Top projects" shapes={<Stripes field={field} x={square ? 0.92 : 0.95} y={square ? 0.1 : 0.08} size={square ? 380 : 560} />}>
      <Rise delay={4} style={{ marginTop: square ? 28 : 72 }}>
        <div style={{ fontSize: square ? 48 : 60, fontWeight: 700, letterSpacing: "-0.02em" }}>Your #1 project</div>
        <Fit text={name} width={inner} max={max} min={56} lines={oneLine ? 1 : 2} type={display(800, 1.05)} style={{ marginTop: 4, overflowWrap: "anywhere" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: square ? 4 : 10 }}>
          <div style={{ ...numerals(1), fontSize: square ? 96 : 150, color: field.hi }}>{hours(topHours)}</div>
          <div style={{ fontSize: square ? 44 : 56, fontWeight: 800, letterSpacing: "-0.02em" }}>
            hours, {int(top.sessions)} {plural(top.sessions, "session")}
          </div>
        </div>
      </Rise>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: square ? 18 : 40 }}>
        {rest.map((project, i) => (
          <ProjectRow key={`${project.name}-${i}`} rank={i + 2} name={project.name || "Unnamed"} hours={project.hours} fraction={project.hours / (top.hours || 1)} field={field} delay={22 + i * 6} />
        ))}
      </div>
      {more > 0 ? (
        <Rise delay={24 + rest.length * 6}>
          <div style={{ fontSize: 40, fontWeight: 600 }}>
            {int(w.totals.projects)} {plural(w.totals.projects, "project")} in total
          </div>
        </Rise>
      ) : null}
    </Card>
  );
}

function ProjectRow({ rank, name, hours: h, fraction, field, delay }: { rank: number; name: string; hours: number; fraction: number; field: Field; delay: number }) {
  const { square } = useLayout();
  return (
    <Rise delay={delay} distance={50}>
      <div style={{ display: "flex", alignItems: "baseline", gap: square ? 20 : 28 }}>
        <div style={{ ...numerals(1), fontSize: square ? 52 : 72, width: square ? 34 : 46 }}>{rank}</div>
        <Clip style={{ flex: 1, fontSize: square ? 44 : 56, fontWeight: 700, letterSpacing: "-0.02em" }}>{name}</Clip>
        <div style={{ ...numerals(1), fontSize: square ? 48 : 64 }}>
          {hours(h)}
          <span style={{ fontSize: square ? 36 : 40, fontWeight: 700, marginLeft: 8 }}>h</span>
        </div>
      </div>
      <div style={{ marginLeft: square ? 54 : 74, marginTop: square ? 6 : 10 }}>
        <Bar fraction={fraction} delay={delay + 4} color={field.ink} track={mix(field.ink, field.bg, 12)} height={square ? 10 : 16} />
      </div>
    </Rise>
  );
}
