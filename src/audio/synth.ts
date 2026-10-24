// A tiny offline synth: drums, bass, pads, plucks and sound effects rendered
// sample by sample, so every soundtrack is generated, not shipped.

export const SR = 48000;
const TAU = Math.PI * 2;

export function mtof(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise = rng(7);
const white = () => noise() * 2 - 1;

function buffer(seconds: number): Float32Array {
  return new Float32Array(Math.max(1, Math.round(seconds * SR)));
}

/** Topology-preserving state variable filter. `cutoff` may change per sample. */
class Filter {
  private ic1 = 0;
  private ic2 = 0;
  constructor(private q = 0.707) {}
  run(x: number, cutoff: number, mode: "low" | "band" | "high" = "low"): number {
    const g = Math.tan((Math.PI * Math.min(cutoff, SR * 0.45)) / SR);
    const k = 1 / this.q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    if (mode === "low") return v2;
    if (mode === "band") return v1;
    return x - k * v1 - v2;
  }
}

/** Attack, then hold, then release, in seconds. */
function env(t: number, length: number, attack = 0.005, release = 0.05): number {
  if (t < attack) return t / attack;
  if (t > length - release) return Math.max(0, (length - t) / release);
  return 1;
}

// ---------- Drums ----------

export function kick({ f0 = 160, f1 = 44, decay = 6, length = 0.5, click = 0.35, drive = 1.6 } = {}): Float32Array {
  const out = buffer(length);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    phase += (f1 + (f0 - f1) * Math.exp(-t * 32)) / SR;
    const body = Math.sin(TAU * phase) * Math.exp(-t * decay);
    out[i] = Math.tanh((body + white() * click * Math.exp(-t * 400)) * drive);
  }
  return out;
}

export function snare({ tone = 185, length = 0.3, snap = 0.9 } = {}): Float32Array {
  const out = buffer(length);
  const hp = new Filter(0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const body = Math.sin(TAU * tone * t) * Math.exp(-t * 22) * 0.6;
    const rattle = hp.run(white(), 1800, "high") * Math.exp(-t * 15) * snap;
    out[i] = Math.tanh(body + rattle);
  }
  return out;
}

export function clap({ length = 0.35 } = {}): Float32Array {
  const out = buffer(length);
  const bp = new Filter(1.6);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let e = Math.exp(-t * 14);
    for (const offset of [0, 0.011, 0.022]) if (t >= offset && t < offset + 0.01) e = Math.max(e, Math.exp(-(t - offset) * 200));
    out[i] = bp.run(white(), 1300, "band") * e * 2.2;
  }
  return out;
}

export function hat({ open = false, length = 0 } = {}): Float32Array {
  length ||= open ? 0.35 : 0.06;
  const out = buffer(length);
  const hp = new Filter(0.8);
  const hp2 = new Filter(0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = hp2.run(hp.run(white(), 7000, "high"), 9000, "high") * Math.exp(-t * (open ? 9 : 70)) * 0.8;
  }
  return out;
}

export function tom(freq: number, length = 0.6): Float32Array {
  return kick({ f0: freq * 1.8, f1: freq, decay: 7, length, click: 0.15, drive: 1.3 });
}

export function crash(length = 2.2): Float32Array {
  const out = buffer(length);
  const hp = new Filter(0.7);
  const bp = new Filter(0.6);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const x = white();
    out[i] = (hp.run(x, 5000, "high") * 0.7 + bp.run(x, 3000, "band") * 0.5) * Math.exp(-t * 2.2) * env(t, length, 0.002, 0.3);
  }
  return out;
}

// ---------- Tones ----------

type Wave = "saw" | "square" | "sine" | "triangle";

function osc(wave: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case "saw":
      return 2 * p - 1;
    case "square":
      return p < 0.5 ? 1 : -1;
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    default:
      return Math.sin(TAU * p);
  }
}

export function bass(freq: number, length: number, { wave = "saw" as Wave, cutoff = 900, sweep = 2200, q = 1.2, decay = 9, sub = 0.6 } = {}): Float32Array {
  const out = buffer(length);
  const lp = new Filter(q);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const tone = osc(wave, freq * t) * 0.6 + Math.sin(TAU * freq * t) * sub;
    out[i] = Math.tanh(lp.run(tone, cutoff + sweep * Math.exp(-t * decay)) * 1.4) * env(t, length, 0.004, 0.03);
  }
  return out;
}

/** Detuned saws through a lowpass, for pads and big chords. */
export function chord(freqs: number[], length: number, { voices = 3, detune = 0.12, cutoff = 1200, attack = 0.25, release = 0.4, wave = "saw" as Wave, open = 0, q = 0.8 } = {}): Float32Array {
  const out = buffer(length + release);
  const lp = new Filter(q);
  const phases = freqs.flatMap(() => Array.from({ length: voices }, () => noise()));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let x = 0;
    freqs.forEach((f, n) => {
      for (let v = 0; v < voices; v++) {
        const cents = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2 * detune;
        x += osc(wave, phases[n * voices + v]! + f * 2 ** (cents / 12) * t);
      }
    });
    x /= Math.sqrt(freqs.length * voices) * 1.6;
    const a = t < attack ? t / attack : t > length ? Math.max(0, 1 - (t - length) / release) : 1;
    out[i] = lp.run(x, cutoff + open * Math.exp(-t * 6)) * a;
  }
  return out;
}

/** Karplus-Strong plucked string. */
export function pluck(freq: number, length = 1.2, { bright = 0.5, damp = 0.996 } = {}): Float32Array {
  const out = buffer(length);
  const period = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(period).map(() => white() * (0.5 + bright * 0.5));
  for (let i = 0; i < out.length; i++) {
    const j = i % period;
    const value = line[j]!;
    line[j] = ((value + line[(j + 1) % period]!) / 2) * damp;
    out[i] = value * env(i / SR, length, 0.001, 0.05);
  }
  return out;
}

export function marimba(freq: number, length = 0.8): Float32Array {
  const out = buffer(length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (Math.sin(TAU * freq * t) * Math.exp(-t * 6) + Math.sin(TAU * freq * 3.99 * t) * Math.exp(-t * 22) * 0.35 + Math.sin(TAU * freq * 10.1 * t) * Math.exp(-t * 90) * 0.15) * 0.8;
  }
  return out;
}

/** FM electric piano with a slow tremolo. */
export function epiano(freq: number, length: number, { tremolo = 5 } = {}): Float32Array {
  const out = buffer(length + 0.6);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const index = 1.6 * Math.exp(-t * 3);
    const tone = Math.sin(TAU * freq * t + index * Math.sin(TAU * freq * t)) + Math.sin(TAU * freq * 2 * t) * 0.12 * Math.exp(-t * 4);
    const release = t > length ? Math.max(0, 1 - (t - length) / 0.6) : 1;
    out[i] = tone * Math.exp(-t * 1.1) * release * (1 - 0.18 * (0.5 + 0.5 * Math.sin(TAU * tremolo * t))) * 0.5;
  }
  return out;
}

export function bleep(freq: number, length = 0.09, wave: Wave = "square"): Float32Array {
  const out = buffer(length);
  const lp = new Filter(1);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = lp.run(osc(wave, freq * t), 5000) * env(t, length, 0.002, 0.03) * 0.5;
  }
  return out;
}

export function chime(freq: number, length = 1.4): Float32Array {
  const out = buffer(length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (Math.sin(TAU * freq * t) * Math.exp(-t * 3) + Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t * 6) * 0.4 + Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t * 12) * 0.2) * 0.5 * Math.min(1, t / 0.002);
  }
  return out;
}

// ---------- Effects ----------

/** Filtered noise sweeping up, with a rising tone under it. Ends at full level. */
export function riser(length: number, { from = 300, to = 9000, tone = true } = {}): Float32Array {
  const out = buffer(length);
  const bp = new Filter(2.5);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const p = i / out.length;
    const cutoff = from * (to / from) ** (p * p);
    phase += (110 * 2 ** (p * 3)) / SR;
    const x = bp.run(white(), cutoff, "band") * 1.6 + (tone ? osc("saw", phase) * 0.12 : 0);
    out[i] = x * p ** 1.6;
  }
  return out;
}

export function impact(length = 2.4): Float32Array {
  const out = buffer(length);
  const lp = new Filter(0.7);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    phase += (30 + 70 * Math.exp(-t * 8)) / SR;
    const sub = Math.sin(TAU * phase) * Math.exp(-t * 1.8);
    const blast = lp.run(white(), 200 + 4000 * Math.exp(-t * 6)) * Math.exp(-t * 3);
    out[i] = Math.tanh((sub * 1.3 + blast * 0.9) * 1.5);
  }
  return out;
}

export function whoosh(length = 0.6, up = true): Float32Array {
  const out = buffer(length);
  const bp = new Filter(1.4);
  for (let i = 0; i < out.length; i++) {
    const p = i / out.length;
    const cutoff = up ? 400 * 15 ** p : 6000 * (1 / 15) ** p;
    out[i] = bp.run(white(), cutoff, "band") * Math.sin(Math.PI * p) ** 2 * 1.4;
  }
  return out;
}

export function crackle(length: number, density = 18): Float32Array {
  const out = buffer(length);
  const lp = new Filter(0.7);
  const hp = new Filter(0.7);
  const pops = rng(31);
  for (let i = 0; i < out.length; i++) {
    const pop = pops() < density / SR ? (pops() * 2 - 1) * 0.9 : 0;
    out[i] = hp.run(pop + lp.run(white(), 3000) * 0.03, 300, "high");
  }
  return out;
}

/** A rubber stamp hitting paper. */
export function stamp(): Float32Array {
  const thud = kick({ f0: 120, f1: 60, decay: 18, length: 0.25, click: 0.6, drive: 2 });
  const out = buffer(0.3);
  const bp = new Filter(0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (thud[i] ?? 0) * 0.9 + bp.run(white(), 2200, "band") * Math.exp(-t * 35) * 1.2;
  }
  return out;
}

/** A record scratched back and forth. */
export function scratch(length = 0.7): Float32Array {
  const out = buffer(length);
  const bp = new Filter(3);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const speed = Math.sin(TAU * 4.5 * t);
    phase += (180 * Math.abs(speed) + 40) / SR;
    out[i] = bp.run(osc("saw", phase) * 0.5 + white() * 0.6, 600 + 2600 * Math.abs(speed), "band") * Math.abs(speed) * 1.6 * env(t, length, 0.01, 0.05);
  }
  return out;
}

/** Error buzzer, bit-crushed. */
export function buzz(length = 0.16): Float32Array {
  const out = buffer(length);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const x = osc("square", 98 * t) * 0.5 + osc("square", 147 * t) * 0.3;
    out[i] = (Math.round(x * 4) / 4) * env(t, length, 0.002, 0.02) * 0.7;
  }
  return out;
}

/** Mains hum of a neon sign, gated by `on`. */
export function hum(length: number, on: (t: number) => boolean): Float32Array {
  const out = buffer(length);
  const lp = new Filter(0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const x = osc("saw", 120 * t) * 0.4 + white() * 0.15;
    out[i] = on(t) ? lp.run(x, 1800) * 0.6 : lp.run(0, 1800);
  }
  return out;
}

export function click(): Float32Array {
  const out = buffer(0.02);
  const bp = new Filter(2);
  for (let i = 0; i < out.length; i++) out[i] = bp.run(white(), 3500, "band") * Math.exp(-(i / SR) * 400) * 1.5;
  return out;
}

/** Lub-dub. */
export function heartbeat(): Float32Array {
  const lub = kick({ f0: 90, f1: 42, decay: 12, length: 0.3, click: 0, drive: 1.2 });
  const out = buffer(0.55);
  out.set(lub);
  const dub = kick({ f0: 80, f1: 40, decay: 14, length: 0.25, click: 0, drive: 1.1 });
  const at = Math.round(0.2 * SR);
  for (let i = 0; i < dub.length && at + i < out.length; i++) out[at + i]! += dub[i]! * 0.7;
  return out;
}

// ---------- Mixing ----------

export class Bus {
  readonly left: Float32Array;
  readonly right: Float32Array;
  constructor(readonly seconds: number) {
    this.left = buffer(seconds);
    this.right = buffer(seconds);
  }
  /** Adds `sound` at `at` seconds. `pan` runs from -1 (left) to 1 (right). */
  add(sound: Float32Array, at: number, gain = 1, pan = 0): this {
    const start = Math.round(at * SR);
    const l = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const r = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let i = 0; i < sound.length; i++) {
      const j = start + i;
      if (j < 0 || j >= this.left.length) continue;
      this.left[j]! += sound[i]! * l;
      this.right[j]! += sound[i]! * r;
    }
    return this;
  }
  mix(other: Bus, gain = 1): this {
    for (let i = 0; i < this.left.length; i++) {
      this.left[i]! += (other.left[i] ?? 0) * gain;
      this.right[i]! += (other.right[i] ?? 0) * gain;
    }
    return this;
  }
  /** Ducks this bus after every time in `hits`, the pumping of sidechain compression. */
  duck(hits: number[], depth = 0.7, recover = 0.22): this {
    const gain = new Float32Array(this.left.length).fill(1);
    for (const hit of hits) {
      const start = Math.round(hit * SR);
      for (let i = 0; i < recover * SR; i++) {
        const j = start + i;
        if (j >= gain.length) break;
        const p = i / (recover * SR);
        gain[j] = Math.min(gain[j]!, 1 - depth * (1 - p) ** 2);
      }
    }
    for (let i = 0; i < gain.length; i++) {
      this.left[i]! *= gain[i]!;
      this.right[i]! *= gain[i]!;
    }
    return this;
  }
  /** Freeverb. Returns a new, fully wet bus. */
  reverb(room = 0.84, damp = 0.25): Bus {
    const out = new Bus(this.seconds);
    const scale = SR / 44100;
    const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    const allpasses = [556, 441, 341, 225];
    for (const [channel, input, output, spread] of [
      [0, this.left, out.left, 0],
      [1, this.right, out.right, 23],
    ] as const) {
      void channel;
      const lines = combs.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, store: 0 }));
      const aps = allpasses.map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }));
      for (let n = 0; n < input.length; n++) {
        const x = input[n]! * 0.015;
        let y = 0;
        for (const line of lines) {
          const value = line.buf[line.i]!;
          line.store = value * (1 - damp) + line.store * damp;
          line.buf[line.i] = x + line.store * room;
          line.i = (line.i + 1) % line.buf.length;
          y += value;
        }
        for (const ap of aps) {
          const value = ap.buf[ap.i]!;
          ap.buf[ap.i] = y + value * 0.5;
          ap.i = (ap.i + 1) % ap.buf.length;
          y = value - y;
        }
        output[n] = y;
      }
    }
    return out;
  }
  /** One-pole lowpass whose cutoff follows `cutoff(seconds)`, for muffled intros. */
  lowpass(cutoff: (t: number) => number): this {
    const fl = new Filter(0.7);
    const fr = new Filter(0.7);
    for (let i = 0; i < this.left.length; i++) {
      const c = cutoff(i / SR);
      this.left[i] = fl.run(this.left[i]!, c);
      this.right[i] = fr.run(this.right[i]!, c);
    }
    return this;
  }
}

/** Soft-clips, normalizes to -1 dBFS and encodes 16-bit stereo WAV. */
export function wav(master: Bus): Uint8Array<ArrayBuffer> {
  let peak = 0;
  for (let i = 0; i < master.left.length; i++) peak = Math.max(peak, Math.abs(master.left[i]!), Math.abs(master.right[i]!));
  const drive = 1.25 / (peak || 1);
  const ceiling = 0.89 / Math.tanh(1.25);
  const frames = master.left.length;
  const data = new DataView(new ArrayBuffer(44 + frames * 4));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  data.setUint32(4, 36 + frames * 4, true);
  text(8, "WAVEfmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 2, true);
  data.setUint32(24, SR, true);
  data.setUint32(28, SR * 4, true);
  data.setUint16(32, 4, true);
  data.setUint16(34, 16, true);
  text(36, "data");
  data.setUint32(40, frames * 4, true);
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, (frames - i) / (SR * 0.3));
    data.setInt16(44 + i * 4, Math.round(Math.tanh(master.left[i]! * drive) * ceiling * fade * 32767), true);
    data.setInt16(46 + i * 4, Math.round(Math.tanh(master.right[i]! * drive) * ceiling * fade * 32767), true);
  }
  return new Uint8Array(data.buffer);
}
