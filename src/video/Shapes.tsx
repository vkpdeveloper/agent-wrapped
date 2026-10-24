// Big flat shapes behind the type. They sit in the margins and move slowly so
// every card has motion even after its numbers have landed.
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { mix, type Field } from "./theme.ts";
import { useEnter } from "./ui.tsx";

interface ShapeProps {
  field: Field;
  /** Center, as fractions of the frame. */
  x: number;
  y: number;
  /** Diameter in px. */
  size: number;
  delay?: number;
  strength?: number;
}

export function Disc({ field, x, y, size, delay = 0, strength = 22 }: ShapeProps) {
  const frame = useCurrentFrame();
  const t = useEnter(delay, 24);
  const drift = interpolate(frame, [0, 180], [0, -40]);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: "50%",
          background: mix(field.hi, field.bg, strength),
          scale: t,
          translate: `0 ${drift}px`,
        }}
      />
    </AbsoluteFill>
  );
}

/** A thick ring with a dot sweeping around it, like a clock hand. */
export function Orbit({ field, x, y, size, delay = 0, strength = 28 }: ShapeProps) {
  const frame = useCurrentFrame();
  const t = useEnter(delay, 24);
  const stroke = size * 0.07;
  const r = (size - stroke) / 2;
  const angle = interpolate(frame, [0, 150], [-90, 270]);
  return (
    <AbsoluteFill>
      <svg
        width={size}
        height={size}
        style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, marginLeft: -size / 2, marginTop: -size / 2, scale: 0.6 + 0.4 * t, opacity: t }}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={mix(field.ink, field.bg, strength / 2)} strokeWidth={stroke} />
        <line
          x1={size / 2}
          y1={size / 2}
          x2={size / 2 + Math.cos((angle * Math.PI) / 180) * r * 0.8}
          y2={size / 2 + Math.sin((angle * Math.PI) / 180) * r * 0.8}
          stroke={mix(field.hi, field.bg, strength + 20)}
          strokeWidth={stroke * 0.6}
          strokeLinecap="round"
        />
        <circle cx={size / 2 + Math.cos((angle * Math.PI) / 180) * r} cy={size / 2 + Math.sin((angle * Math.PI) / 180) * r} r={stroke * 0.9} fill={field.hi} />
      </svg>
    </AbsoluteFill>
  );
}

/** Diagonal bands that slide across a corner. */
export function Stripes({ field, x, y, size, delay = 0, strength = 22 }: ShapeProps) {
  const frame = useCurrentFrame();
  const t = useEnter(delay, 26);
  const slide = interpolate(frame, [0, 180], [0, 60]);
  const band = size / 7;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          rotate: "-30deg",
          display: "flex",
          flexDirection: "column",
          gap: band * 0.6,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: band,
              borderRadius: band / 2,
              background: mix(field.hi, field.bg, strength + i * 6),
              width: `${(0.5 + i * 0.15) * Math.min(1, Math.max(0, t * 1.4 - i * 0.12)) * 100}%`,
              translate: `${slide * (i % 2 ? 1 : -1)}px 0`,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/** A slowly spinning many-pointed star. */
export function Burst({ field, x, y, size, delay = 0, strength = 26 }: ShapeProps) {
  const frame = useCurrentFrame();
  const t = useEnter(delay, 22);
  const points = 12;
  const outer = size / 2;
  const inner = outer * 0.72;
  const path = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points;
    return `${outer + Math.cos(a) * r},${outer + Math.sin(a) * r}`;
  }).join(" ");
  return (
    <AbsoluteFill>
      <svg
        width={size}
        height={size}
        style={{
          position: "absolute",
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          scale: t,
          rotate: `${interpolate(frame, [0, 300], [0, 90])}deg`,
        }}
      >
        <polygon points={path} fill={mix(field.hi, field.bg, strength)} />
      </svg>
    </AbsoluteFill>
  );
}
