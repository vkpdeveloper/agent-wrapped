// Generates the music bed for each cut into public/music/<cut>.m4a with
// ElevenLabs Music, then fits it to the video's grid: stretched to exactly BPM,
// and started on a beat (at the drop, for cuts that open on a hook).
// Needs ELEVENLABS_API_KEY and ffmpeg. Usage: bun scripts/music.ts [cut...] [--seed n]
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { BPM, CUT_NAMES, type Cut } from "../src/video/plan.ts";

const STYLE: Record<Cut, { prompt: string; drop: boolean }> = {
  full: { drop: false, prompt: "euphoric future bass pop anthem, big supersaw chords, punchy kick, claps, festival build and drop, uplifting, year in review" },
  social: { drop: true, prompt: "hype big room EDM, festival drop, punchy kick, huge synth lead, crowd energy" },
  rage: { drop: true, prompt: "rage trap, hyperpop rage beat, distorted synth lead, blown out 808, aggressive hi-hat rolls, chaotic, angry" },
  loop: { drop: true, prompt: "hypnotic glitch hop, stuttering chopped loop, broken record, minimal techno, repetitive, unsettling" },
  credit: { drop: true, prompt: "jazzy heist caper, sneaky spy funk, upright bass, brass stabs, finger snaps, smug, mischievous" },
  grind: { drop: true, prompt: "dark synthwave night drive, pulsing bass arpeggio, gated reverb drums, retro 80s, moody, relentless" },
  boss: { drop: true, prompt: "mafia boss trap, epic brass, dark choir, heavy 808, cinematic hip hop, menacing, powerful" },
  speedrun: { drop: true, prompt: "chiptune 8-bit video game music, NES square wave lead, fast arpeggios, final boss level, energetic" },
  genz: { drop: true, prompt: "Brazilian phonk, drift phonk, distorted 808, cowbell melody, hard phonk drums, TikTok edit" },
  linkedin: { drop: true, prompt: "corporate upbeat stock music, ukulele, glockenspiel, hand claps, whistling, happy motivational, cheesy" },
  docu: { drop: false, prompt: "nature documentary orchestral score, sweeping strings, french horn, harp, woodwinds, majestic, wonder" },
  news: { drop: true, prompt: "breaking news theme, urgent TV broadcast, timpani, staccato strings, synth stabs, orchestral hits" },
  dating: { drop: true, prompt: "smooth R&B slow jam, saxophone, Rhodes electric piano, romantic, sensual, late night" },
  tier: { drop: true, prompt: "hard trap beat, sliding 808s, rapid hi-hat rolls, dark piano melody, hype, aggressive" },
  receipt: { drop: true, prompt: "elevator music, bossa nova lounge muzak, vibraphone, nylon guitar, cheesy shopping mall" },
  trailer: { drop: false, prompt: "epic movie trailer, hybrid orchestral, braams, huge taiko drums, rising tension, dark cinematic" },
  chat: { drop: true, prompt: "chill lofi hip hop, marimba, soft keys, vinyl crackle, cozy, playful, half time" },
};

/** Longer than any cut, so data that shows extra cards never runs out of music. */
const SECONDS = 60;
const SR = 11025;
const HOP = 128;

const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true, options: { seed: { type: "string" } } });
const cuts = (positionals.length ? positionals : CUT_NAMES) as Cut[];
const out = join(import.meta.dir, "..", "public", "music");
await mkdir(out, { recursive: true });

async function generate(prompt: string, seed?: number): Promise<ArrayBuffer> {
  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ model_id: "music_v2_5", prompt: `${prompt}. Exactly ${BPM} BPM, steady tempo, starts at full energy with no intro.`, music_length_ms: (SECONDS + 10) * 1000, force_instrumental: true, seed }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

/** Tempo and the first beat of the strongest beat grid, from an onset envelope. */
function grid(x: Float32Array): { bpm: number; phase: number } {
  const n = Math.floor(x.length / HOP);
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 1; j < HOP; j++) sum += (x[i * HOP + j]! - x[i * HOP + j - 1]!) ** 2;
    energy[i] = Math.log1p(sum * 1000);
  }
  const onsets = new Float32Array(n);
  for (let i = 1; i < n; i++) onsets[i] = Math.max(0, energy[i]! - energy[i - 1]!);
  const rate = SR / HOP;
  let best = { bpm: BPM, score: -1 };
  // Search around the target, so a half or double time reading does not win.
  for (let bpm = BPM * 0.85; bpm <= BPM * 1.15; bpm += 0.1) {
    const lag = (60 / bpm) * rate;
    let score = 0;
    for (let i = 0; i + lag * 4 < n; i++) score += onsets[i]! * (onsets[Math.round(i + lag)]! + 0.5 * onsets[Math.round(i + lag * 2)]! + 0.25 * onsets[Math.round(i + lag * 4)]!);
    if (score > best.score) best = { bpm, score };
  }
  const period = (60 / best.bpm) * rate;
  let phase = { at: 0, score: -1 };
  for (let p = 0; p < period; p += 0.25) {
    let score = 0;
    for (let k = p; k < n; k += period) score += onsets[Math.round(k)]!;
    if (score > phase.score) phase = { at: p, score };
  }
  return { bpm: best.bpm, phase: phase.at / rate };
}

/** The first bar, in seconds, as loud as the track's loud part: where a hook should start. */
function dropAt(x: Float32Array, bpm: number, phase: number): number {
  const barSamples = (240 / bpm) * SR;
  const bars: number[] = [];
  for (let start = phase * SR; start + barSamples < x.length; start += barSamples) {
    let sum = 0;
    for (let i = Math.floor(start); i < start + barSamples; i++) sum += x[i]! ** 2;
    bars.push(Math.sqrt(sum / barSamples));
  }
  const loud = [...bars].sort((a, b) => a - b)[Math.floor(bars.length * 0.75)]!;
  const first = bars.findIndex((rms) => rms >= loud * 0.8);
  // Leave enough track after the drop for the longest cut.
  const last = Math.max(0, Math.floor((x.length / SR - phase - SECONDS * (bpm / BPM)) / (240 / bpm)));
  return phase + Math.min(Math.max(0, first), last) * (240 / bpm);
}

for (const cut of cuts) {
  const style = STYLE[cut];
  const wav = join(out, `${cut}.raw.mp3`);
  await Bun.write(wav, await generate(style.prompt, values.seed ? Number(values.seed) : undefined));
  const x = new Float32Array(await $`ffmpeg -loglevel error -i ${wav} -ac 1 -ar ${SR} -f f32le -`.arrayBuffer());
  const found = grid(x);
  // The model keeps the asked tempo well; a reading far from it is the tracker locking onto the wrong pulse.
  const bpm = Math.abs(found.bpm / BPM - 1) < 0.04 ? found.bpm : BPM;
  const phase = found.phase;
  const start = style.drop ? dropAt(x, bpm, phase) : phase;
  // atempo keeps the pitch; after it the beat grid is exactly BPM from 0.
  await $`ffmpeg -loglevel error -y -ss ${start} -i ${wav} -af atempo=${BPM / bpm},afade=t=in:d=0.01,loudnorm=I=-14:TP=-1.5 -t ${SECONDS} -ar 48000 -c:a aac -b:a 128k ${join(out, `${cut}.m4a`)}`;
  await $`rm ${wav}`;
  console.log(`${cut}: read ${found.bpm.toFixed(1)} bpm, used ${bpm.toFixed(1)}, starts at ${start.toFixed(2)}s`);
}
