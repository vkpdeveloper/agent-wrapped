// The sound effects over the music bed, cut to the video: a whoosh into every
// wipe, a boom when the big line slams in, a stamp under the punchline, and the
// typing, bleeps and meme hits each card's joke needs. The music itself is a
// generated track per cut (public/music), stretched to the same beat grid.
import { BEAT, BPM, CHAT_BEATS, FPS, NO_STAMPS, QUOTE_BEATS, QUOTE_TYPING, ROW_BEATS, SLAM_BEAT, STICKER_BEAT, totalFrames, type CardId, type PlannedCard } from "../video/plan.ts";
import * as s from "./synth.ts";

const SPB = 60 / BPM;
const at = (beat: number) => beat * SPB;

const FX_GAIN = 0.5;
const BOOM = s.boom();
const STAMP = s.stamp();
const CLICK = s.click();

class Mix {
  readonly fx: s.Bus;
  readonly send: s.Bus;

  constructor(seconds: number) {
    this.fx = new s.Bus(seconds);
    this.send = new s.Bus(seconds);
  }

  hit(sound: Float32Array, beat: number, gain: number, pan = 0, wet = 0.2): void {
    this.fx.add(sound, at(beat), gain, pan);
    this.send.add(sound, at(beat), gain * wet, pan);
  }

  wav(): Uint8Array<ArrayBuffer> {
    const master = new s.Bus(this.fx.seconds);
    // Sits on a music bed already mastered loud, so the hits leave it headroom.
    master.mix(this.fx, FX_GAIN).mix(this.send.reverb(), FX_GAIN);
    return s.wav(master);
  }
}

type Part = (m: Mix, from: number, to: number, quoteCount: number) => void;

/** The big line lands: the boom on the slam, the stamp under the sticker. */
const slam: Part = (m, from) => {
  m.hit(BOOM, from + SLAM_BEAT, 0.8, 0, 0.15);
  m.hit(STAMP, from + STICKER_BEAT, 0.6, 0, 0.15);
};

/** The first card is already up on frame 0, so it opens on the boom. */
const hook: Part = (m, from) => {
  m.hit(BOOM, from, 0.9, 0, 0.2);
  m.hit(STAMP, from + STICKER_BEAT, 0.6, 0, 0.15);
};

/** The closing question, then the last hit where the video ends. */
const ask: Part = (m, from, to) => {
  m.hit(s.impact(0.8), from + SLAM_BEAT, 0.5, 0, 0.3);
  m.hit(BOOM, Math.max(from + 4, to - 2), 0.9, 0, 0.3);
};

/** A riser into the big reveal, the impact on it. */
function drop(m: Mix, beat: number): void {
  m.hit(s.riser(at(4), { tone: false }), beat - 4, 0.35);
  m.hit(s.impact(), beat, 0.9, 0, 0.35);
  m.hit(BOOM, beat, 0.6, 0, 0.1);
}

/** `sound` on each beat of `beats`, counted from the card's start. */
function hits(beats: number[], sound: Float32Array, gain = 0.5, extra?: Part): Part {
  return (m, from, to, count) => {
    for (const beat of beats) m.hit(sound, from + beat, gain, 0, 0.15);
    extra?.(m, from, to, count);
  };
}

/** The user's own lines: keys clicking as each one types, a bleep as it sends. */
const quotes: Part = (m, from, _to, count) => {
  for (const start of QUOTE_BEATS.slice(0, count)) {
    m.hit(s.whoosh(SPB * 0.4), from + start - 0.4, 0.2, 0, 0);
    for (let i = 0; i < 14; i++) m.hit(CLICK, from + start + (QUOTE_TYPING * i) / 14, 0.22 + ((i * 7) % 3) * 0.04, ((i % 5) - 2) * 0.15, 0);
    m.hit(s.bleep(1568, 0.07, "sine"), from + start + QUOTE_TYPING, 0.25, 0.3, 0.3);
    m.hit(s.bleep(2093, 0.1, "sine"), from + start + QUOTE_TYPING + 0.12, 0.22, 0.3, 0.3);
  }
};

/** Pushback: a record scratch, then the stamp. */
const scratch: Part = (m, from) => {
  m.hit(s.scratch(at(0.8)), from, 0.5, 0, 0.1);
  m.hit(STAMP, from + 1, 0.9, 0, 0.15);
};

const ticks = (from: number, to: number) => Array.from({ length: Math.max(0, Math.floor(to - from)) }, (_, i) => i);
const halves = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i / 2);

/** Fails get the error buzzer on top of the boom. */
const fail: Part = (m, from, to, count) => {
  slam(m, from, to, count);
  m.hit(s.buzz(0.3), from + SLAM_BEAT, 0.45, 0, 0.1);
};

/** Three blasts of the air horn on the slam. */
const horns: Part = (m, from, to, count) => {
  slam(m, from, to, count);
  for (const [i, beat] of [0, 0.5, 1].entries()) m.hit(s.airhorn(i === 2 ? 0.7 : 0.32), from + SLAM_BEAT + beat, 0.4, 0, 0.2);
};

/** The trailer's braam on each line. */
const braam: Part = (m, from) => m.hit(s.impact(2.4), from + SLAM_BEAT, 0.9, 0, 0.5);

// Cards without a part here get `hook` as the first card, `ask` as an ask card,
// and `slam` otherwise.
const PARTS: Partial<Record<CardId, Part>> = {
  intro: (m, from, to) => {
    m.hit(s.impact(), from, 0.8, 0, 0.35);
    m.hit(s.riser(at(4), { tone: false }), to - 4, 0.3);
  },
  hours: () => {},
  agents: () => {},
  projects: () => {},
  records: () => {},
  clock: (m, from, to) => {
    for (const b of ticks(from, to)) m.hit(s.bleep(2400, 0.03, "sine"), from + b, 0.12, 0.5, 0);
  },
  tools: (m, from, to) => {
    for (let b = from; b < to; b += 0.25) m.hit(CLICK, b, (b * 4) % 3 ? 0.08 : 0.14, (b * 4) % 2 ? 0.5 : -0.5, 0);
  },
  corrections: scratch,
  quotes,
  lessons: () => {},
  persona: (m, from, to) => {
    drop(m, from);
    m.hit(BOOM, Math.max(from + 4, to - 2), 0.9, 0, 0.3);
  },
  night: (m, from, to) => {
    for (const b of ticks(from, to)) m.hit(s.bleep(2400, 0.03, "sine"), from + b, 0.12, 0.5, 0);
    m.hit(STAMP, from + STICKER_BEAT, 0.6, 0, 0.15);
  },
  no: (m, from, to, count) => {
    scratch(m, from, to, count);
    for (const [i, beat] of NO_STAMPS.entries()) m.hit(STAMP, from + beat, 0.5 + i * 0.05, ((i % 3) - 1) * 0.4, 0.15);
    m.hit(STAMP, from + STICKER_BEAT, 0.8, 0, 0.15);
  },
  said: quotes,
  reveal: (m, from) => drop(m, from + SLAM_BEAT),
  rageHook: (m, from, to, count) => {
    hook(m, from, to, count);
    for (const [i, beat] of [0.5, 1, 1.5].entries()) m.hit(s.airhorn(i === 2 ? 0.7 : 0.32), from + beat, 0.4, 0, 0.2);
  },
  // A bleep over every censored word.
  swears: hits(ROW_BEATS, s.bleep(1000, SPB * 0.4, "sine"), 0.35),
  ragePeak: horns,
  rageWorst: (m, from, to) => {
    quotes(m, from, to, 1);
    m.hit(STAMP, from + STICKER_BEAT, 0.7, 0, 0.15);
  },
  loopLines: (m, from, to) => quotes(m, from, to, 2),
  retries: fail,
  failed: fail,
  coauthors: hits(ROW_BEATS.slice(0, -1), STAMP, 0.45, (m, from) => m.hit(STAMP, from + STICKER_BEAT, 0.7, 0, 0.15)),
  review: hits(ROW_BEATS.slice(0, -1), STAMP, 0.55),
  splits: hits(ROW_BEATS, s.bleep(1760, 0.08, "square"), 0.25),
  deaths: fail,
  zSkill: fail,
  post: hits([0, 2, 4, 6, 8, 10], s.bleep(1320, 0.06, "sine"), 0.25),
  docHook: () => {},
  docNo: () => {},
  docTongue: () => {},
  docPlease: () => {},
  docName: (m, from) => m.hit(s.impact(), from + SLAM_BEAT, 0.6, 0, 0.5),
  tierList: hits(halves(1, 9), STAMP, 0.5),
  // A line prints every half beat; TOTAL is row 15, so it prints on beat 7.5.
  receipt: hits(halves(0, 20), CLICK, 0.3, (m, from) => m.hit(s.kaching(), from + 7.5, 0.6, 0, 0.2)),
  trailerWorld: (m, from) => m.hit(s.impact(2.4), from, 0.9, 0, 0.5),
  trailerOne: braam,
  trailerHours: braam,
  trailerSessions: braam,
  trailerNo: braam,
  trailerTitle: (m, from) => drop(m, from + SLAM_BEAT),
  chat: hits(CHAT_BEATS, s.bleep(1568, 0.07, "sine"), 0.3),
};

/** A 48 kHz stereo WAV of the sound effects, as long as the video, for `cards` and the `quoteCount` quotes shown. */
export function soundtrack(cards: PlannedCard[], quoteCount: number): Uint8Array<ArrayBuffer> {
  const m = new Mix(totalFrames(cards) / FPS);
  cards.forEach((card, i) => {
    const from = card.from / BEAT;
    const next = cards[i + 1];
    const to = next ? next.from / BEAT : from + card.duration / BEAT;
    if (i > 0) m.hit(s.whoosh(SPB * 0.5), from - 0.5, 0.3, 0, 0.1);
    const part = PARTS[card.id] ?? (i === 0 ? hook : card.id.endsWith("Ask") ? ask : slam);
    part(m, from, to, quoteCount);
  });
  return m.wav();
}
