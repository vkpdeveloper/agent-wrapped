// The soundtrack, generated to the video's own cut: every wipe starts on a
// downbeat with a crash, each card gets its own part, and the persona is the drop.
import { BEAT, BPM, FPS, NO_STAMPS, QUOTE_BEATS, QUOTE_TYPING, SLAM_BEAT, STICKER_BEAT, totalFrames, type CardId, type PlannedCard } from "../video/plan.ts";
import * as s from "./synth.ts";

const SPB = 60 / BPM;
const at = (beat: number) => beat * SPB;
const { mtof } = s;

// vi IV I V in C, one chord a bar, counted from the start of the video.
const CHORDS = [
  [57, 60, 64],
  [57, 60, 65],
  [55, 60, 64],
  [55, 59, 62],
];
const ROOTS = [45, 41, 36, 43];
const bar = (beat: number) => Math.floor(beat / 4) % 4;

const KICK = s.kick();
const CLAP = s.clap();
const HAT = s.hat();
const OPEN_HAT = s.hat({ open: true, length: 0.2 });
const CRASH = s.crash();
const SNARE = s.snare();

class Mix {
  readonly drums: s.Bus;
  readonly music: s.Bus;
  readonly fx: s.Bus;
  readonly send: s.Bus;
  /** Kick times in seconds, for ducking the music under them. */
  readonly kicks: number[] = [];

  constructor(seconds: number) {
    this.drums = new s.Bus(seconds);
    this.music = new s.Bus(seconds);
    this.fx = new s.Bus(seconds);
    this.send = new s.Bus(seconds);
  }

  /** Calls `hit` for each "x" of a 16-steps-a-bar pattern between two beats, on the bar grid. `swing` delays offbeat 8ths. */
  pattern(steps: string, from: number, to: number, hit: (beat: number, step: number) => void, swing = 0): void {
    for (let i = Math.ceil(from * 4); i < to * 4; i++) {
      const step = i % steps.length;
      if (steps[step] === "x") hit(i / 4 + (step % 4 === 2 ? swing : 0), step);
    }
  }

  kick(beat: number, gain = 1, sound = KICK): void {
    this.drums.add(sound, at(beat), gain);
    this.kicks.push(at(beat));
  }

  drum(sound: Float32Array, beat: number, gain: number, pan = 0): void {
    this.drums.add(sound, at(beat), gain, pan);
  }

  tone(sound: Float32Array, beat: number, gain: number, pan = 0, wet = 0.25): void {
    this.music.add(sound, at(beat), gain, pan);
    this.send.add(sound, at(beat), gain * wet, pan);
  }

  effect(sound: Float32Array, beat: number, gain: number, pan = 0, wet = 0.2): void {
    this.fx.add(sound, at(beat), gain, pan);
    this.send.add(sound, at(beat), gain * wet, pan);
  }

  /** One chord per bar between two beats, cut at the bar line or at `to`. */
  bars(from: number, to: number, play: (beat: number, beats: number, chord: number) => void): void {
    for (let b = from; b < to; b = Math.floor(b / 4) * 4 + 4) play(b, Math.min(to, Math.floor(b / 4) * 4 + 4) - b, bar(b));
  }

  wav(): Uint8Array<ArrayBuffer> {
    const master = new s.Bus(this.drums.seconds);
    master.mix(this.drums).mix(this.music.duck(this.kicks, 0.55)).mix(this.fx).mix(this.send.reverb(), 1);
    return s.wav(master);
  }
}

/** Four on the floor. `energy` 1 to 3 adds hats, a busier arp and wider chords. */
function groove(m: Mix, from: number, to: number, energy: 1 | 2 | 3): void {
  m.pattern("x...x...x...x...", from, to, (b) => m.kick(b));
  m.pattern("....x.......x...", from, to, (b) => m.drum(CLAP, b, 0.5));
  m.pattern("..x...x...x...x.", from, to, (b) => m.drum(OPEN_HAT, b, 0.22, 0.25));
  if (energy >= 2) m.pattern("x.x.x.x.x.x.x.x.", from, to, (b) => m.drum(HAT, b, 0.1, -0.3));
  m.pattern("..x...x...x...x.", from, to, (b) => m.tone(s.bass(mtof(ROOTS[bar(b)]!), SPB * 0.45, { cutoff: 500, sweep: 1500 }), b, 0.7, 0, 0));
  m.bars(from, to, (b, beats, n) => {
    const notes = energy === 3 ? CHORDS[n]!.flatMap((x) => [x - 12, x]) : CHORDS[n]!;
    m.tone(s.chord(notes.map(mtof), at(beats) * 0.95, { voices: energy === 3 ? 5 : 3, detune: 0.18, cutoff: 1400 + energy * 500, open: 1500, attack: 0.01, release: 0.25 }), b, 0.3 + energy * 0.07, 0, 0.35);
    const arp = CHORDS[n]!.map((x) => x + 12);
    m.pattern(energy === 3 ? "xxxxxxxxxxxxxxxx" : "x.x.x.x.x.x.x.x.", b, b + beats, (beat, step) => m.tone(s.pluck(mtof(arp[step % arp.length]!), 0.35, { damp: 0.993 }), beat, 0.17, step % 4 ? 0.4 : -0.4));
  });
}

/** The first frame already shows the title, so it opens on a hit and filters the beat in. */
function intro(m: Mix, from: number, to: number): void {
  m.effect(s.impact(), from, 0.8, 0, 0.35);
  m.drum(CRASH, from, 0.3);
  m.tone(s.chord(CHORDS[0]!.map(mtof), at(to - from), { voices: 4, cutoff: 900, attack: 0.8, release: 0.3 }), from, 0.35, 0, 0.5);
  const muffled = new s.Bus(m.music.seconds);
  m.pattern("x.x.x.x.x.x.x.x.", from, to, (b, step) => muffled.add(s.pluck(mtof(CHORDS[0]![step % 3]! + 12), 0.35), at(b), 0.35, step % 4 ? 0.4 : -0.4));
  m.pattern("..x...x...x...x.", from, to, (b) => muffled.add(s.bass(mtof(ROOTS[0]!), SPB * 0.45, { cutoff: 400, sweep: 800 }), at(b), 0.6));
  m.pattern("x...x...x...x...", from + 4, to, (b) => muffled.add(KICK, at(b), 0.9));
  muffled.lowpass((t) => 1000 + 6000 * Math.min(1, (t - at(from)) / at(to - from)) ** 2);
  m.music.mix(muffled);
  m.effect(s.riser(at(4)), to - 4, 0.35);
  m.pattern("xxxx", to - 1, to, (b) => m.drum(SNARE, b, 0.2 + (b - to + 1) * 0.4));
}

/** Late-night hours: half-time, electric piano, a clock ticking on the beat. */
function clock(m: Mix, from: number, to: number): void {
  m.pattern("x.........x.....", from, to, (b) => m.kick(b, 0.9));
  m.pattern("........x.......", from, to, (b) => m.drum(SNARE, b, 0.4));
  m.pattern("x.x.x.x.x.x.x.x.", from, to, (b) => m.drum(HAT, b, 0.1, 0.3), 0.06);
  for (let b = from; b < to; b++) m.effect(s.bleep(2400, 0.03, "sine"), b, 0.1, 0.5, 0);
  for (let b = from; b < to; b += 2) {
    CHORDS[bar(b)]!.forEach((x, i) => m.tone(s.epiano(mtof(x), at(1.9)), b + i * 0.03, 0.3, (i - 1) * 0.35, 0.4));
    m.tone(s.bass(mtof(ROOTS[bar(b)]! - 12), at(1.8), { wave: "sine", cutoff: 400, sweep: 200, sub: 1 }), b, 0.7, 0, 0);
  }
}

/** Tool calls: the groove with keys clattering under it. */
function tools(m: Mix, from: number, to: number): void {
  groove(m, from, to, 2);
  const click = s.click();
  m.pattern("xxxxxxxxxxxxxxxx", from, to, (b, step) => m.effect(click, b, step % 3 ? 0.08 : 0.14, step % 2 ? 0.5 : -0.5, 0));
}

/** Pushback: a record scratch, a rubber stamp, then a swung boom bap. */
function corrections(m: Mix, from: number, to: number): void {
  m.effect(s.scratch(at(0.8)), from, 0.5, 0, 0.1);
  m.effect(s.stamp(), from + 1, 0.9, 0, 0.15);
  const boom = s.kick({ f0: 130, f1: 50, decay: 7, click: 0.2 });
  m.pattern("x......x..x.....", from + 1, to, (b) => m.kick(b, 1, boom), 0.06);
  m.pattern("....x.......x...", from + 1, to, (b) => m.drum(s.snare({ snap: 1 }), b, 0.6), 0.06);
  m.pattern("x.x.x.x.x.x.x.x.", from + 1, to, (b) => m.drum(HAT, b, 0.14, 0.3), 0.06);
  m.pattern("x......x..x.....", from + 1, to, (b) => m.tone(s.bass(mtof(ROOTS[bar(b)]! - 12), SPB * 0.7, { cutoff: 300, sweep: 900, decay: 6 }), b, 0.7, 0, 0), 0.06);
  m.bars(from + 1, to, (b, beats) => m.pattern("x..x..x...x.x...", b, b + beats, (beat) => m.tone(s.chord(CHORDS[bar(beat)]!.map(mtof), SPB * 0.3, { voices: 2, cutoff: 900, open: 3500, attack: 0.005, release: 0.12 }), beat, 0.35, 0, 0.35)));
}

/** The user's own lines: a lighter groove, keys clicking as each one types, a bleep as it sends. */
function quotes(m: Mix, from: number, to: number, count: number): void {
  groove(m, from, to, 1);
  const click = s.click();
  for (const start of QUOTE_BEATS.slice(0, count)) {
    m.effect(s.whoosh(SPB * 0.4), from + start - 0.4, 0.2, 0, 0);
    for (let i = 0; i < 14; i++) m.effect(click, from + start + (QUOTE_TYPING * i) / 14, 0.22 + ((i * 7) % 3) * 0.04, ((i % 5) - 2) * 0.15, 0);
    m.effect(s.bleep(1568, 0.07, "sine"), from + start + QUOTE_TYPING, 0.25, 0.3, 0.3);
    m.effect(s.bleep(2093, 0.1, "sine"), from + start + QUOTE_TYPING + 0.12, 0.22, 0.3, 0.3);
  }
}

/** The breakdown before the persona: pads and chimes, then the kick builds back in. */
function lessons(m: Mix, from: number, to: number): void {
  m.bars(from, to, (b, beats, n) => m.tone(s.chord(CHORDS[n]!.map(mtof), at(beats), { voices: 4, detune: 0.1, cutoff: 1800, attack: 0.3, release: 0.4 }), b, 0.5, 0, 0.5));
  const melody = [76, 72, 74, 71, 72, 69, 71, 67];
  for (let i = 0; from + i < to - 4; i++) m.tone(s.chime(mtof(melody[i % melody.length]!)), from + i, 0.25, i % 2 ? 0.4 : -0.4, 0.5);
  m.pattern("x.x.x.x.x.x.x.x.", from, to - 4, (b) => m.drum(HAT, b, 0.06, 0.3));
  m.pattern("x...x...x...x...", to - 4, to, (b) => m.kick(b, 0.5 + (b - to + 4) * 0.12));
}

/** The riser and impact into the big reveal. */
function drop(m: Mix, from: number): void {
  m.effect(s.riser(at(4)), from - 4, 0.45);
  m.pattern("xxxxxxxxxxxxxxxx", from - 2, from - 0.25, (b) => m.drum(SNARE, b, 0.15 + (b - from + 2) * 0.3));
  m.effect(s.impact(), from, 1, 0, 0.35);
}

/** The last hit, where the video ends. */
function button(m: Mix, beat: number): void {
  m.kick(beat);
  m.drum(CRASH, beat, 0.4);
  m.effect(s.impact(1.4), beat, 0.7, 0, 0.4);
  m.tone(s.chord([45, 57, 64, 69, 72].map(mtof), 0.6, { voices: 5, detune: 0.18, cutoff: 2600, open: 2500, attack: 0.005, release: 0.6 }), beat, 0.5, 0, 0.5);
}

/** The drop under the persona, then the button. */
function persona(m: Mix, from: number, to: number): void {
  drop(m, from);
  const end = Math.max(from + 4, to - 2);
  groove(m, from, end, 3);
  button(m, end);
}

/** A social card: its groove, an impact as the big line slams in and a stamp under the punchline. */
function slams(energy: 1 | 2 | 3) {
  return (m: Mix, from: number, to: number) => {
    groove(m, from, to, energy);
    m.effect(s.impact(0.6), from + SLAM_BEAT, 0.45, 0, 0.3);
    m.effect(s.stamp(), from + STICKER_BEAT, 0.7, 0, 0.15);
  };
}


const PARTS: Record<CardId, (m: Mix, from: number, to: number, quoteCount: number) => void> = {
  intro,
  hours: (m, from, to) => groove(m, from, to, 1),
  agents: (m, from, to) => groove(m, from, to, 2),
  projects: (m, from, to) => groove(m, from, to, 2),
  clock,
  records: (m, from, to) => groove(m, from, to, 2),
  tools,
  corrections,
  quotes,
  lessons,
  persona,
  // The video opens mid-groove: the first frame is the hook, not a title.
  hook: (m, from, to) => {
    m.effect(s.impact(), from, 0.9, 0, 0.35);
    m.drum(CRASH, from, 0.35);
    groove(m, from, to, 2);
    m.effect(s.stamp(), from + STICKER_BEAT, 0.7, 0, 0.15);
  },
  ride: slams(2),
  night: (m, from, to) => {
    clock(m, from, to);
    m.effect(s.stamp(), from + STICKER_BEAT, 0.6, 0, 0.15);
  },
  no: (m, from, to) => {
    corrections(m, from, to);
    for (const [i, beat] of NO_STAMPS.entries()) m.effect(s.stamp(), from + beat, 0.5 + i * 0.05, ((i % 3) - 1) * 0.4, 0.15);
    m.effect(s.stamp(), from + STICKER_BEAT, 0.8, 0, 0.15);
  },
  said: quotes,
  reveal: (m, from, to) => {
    drop(m, from + SLAM_BEAT);
    groove(m, from + SLAM_BEAT, to, 3);
  },
  ask: (m, from, to) => {
    m.effect(s.impact(0.6), from + SLAM_BEAT, 0.5, 0, 0.3);
    const end = Math.max(from + 4, to - 2);
    groove(m, from, end, 1);
    button(m, end);
  },
};

/** A 48 kHz stereo WAV as long as the video, scored to `cards` and the `quoteCount` quotes shown. */
export function soundtrack(cards: PlannedCard[], quoteCount: number): Uint8Array<ArrayBuffer> {
  const m = new Mix(totalFrames(cards) / FPS);
  cards.forEach((card, i) => {
    const from = card.from / BEAT;
    const next = cards[i + 1];
    const to = next ? next.from / BEAT : from + card.duration / BEAT;
    if (i > 0) {
      m.drum(CRASH, from, 0.3);
      m.effect(s.whoosh(SPB * 0.5), from - 0.5, 0.25, 0, 0.1);
    }
    PARTS[card.id](m, from, to, quoteCount);
  });
  return m.wav();
}
