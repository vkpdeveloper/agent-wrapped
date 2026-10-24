// Brainrot: TikTok captions, lowercase, one word at a time on the 16ths.
import { useCurrentFrame } from "remotion";
import { clock, int } from "../format.ts";
import { BEAT, SLAM_BEAT } from "../plan.ts";
import { display, useLayout, type CardProps } from "../ui.tsx";
import { censor } from "../cards/Formats.tsx";
import { Frame } from "../cards/Social.tsx";
import { Art } from "../Art.tsx";

/** Words land a 16th note apart. Words with a digit are the punchline: colored and bigger. */
function Caption({ text, field, settled = false }: { text: string; field: CardProps["field"]; settled?: boolean }) {
  const { square } = useLayout();
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const size = square ? 92 : 124;
  const at = (i: number) => SLAM_BEAT + i / 4;
  // Every number is a punchline: the screen hits as it lands.
  const punch = settled ? [] : words.flatMap((word, i) => (/\d/.test(word) ? [at(i)] : []));
  return (
    <Frame field={field} backdrop={<Art name="genz" dim={0.1} style={{ top: "55%" }} />} punch={punch} punchAmount={0.7}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", columnGap: size * 0.28, rowGap: size * 0.05, textAlign: "center" }}>
        {words.map((word, i) => {
          const start = at(i) * BEAT;
          if (!settled && frame < start) return null;
          const age = settled ? 99 : frame - start;
          const pop = age < 4 ? 1.35 - age * 0.09 : 1;
          const big = /\d/.test(word);
          return (
            <span
              key={i}
              style={{
                ...display(800, 1.05),
                fontSize: big ? size * 1.25 : size,
                color: big ? field.hi : "#ffffff",
                WebkitTextStroke: `${square ? 10 : 14}px #000`,
                paintOrder: "stroke fill",
                scale: String(pop),
                rotate: `${big ? Math.sin(frame / 2) * 3 : 0}deg`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </Frame>
  );
}

const caption = (line: (w: CardProps["w"]) => string, settled = false) => {
  return ({ w, field, line: written }: CardProps) => <Caption text={written ?? line(w)} field={field} settled={settled} />;
};

export const ZPov = caption((w) => `pov: you spent ${int(w.totals.hours)} hours talking to ai`, true);
export const ZRoman = caption((w) => `${(w.agents[0]?.name ?? "ai").toLowerCase()} is lowkey my roman empire. ${int(w.agents[0]?.sessions ?? 0)} sessions`);
export const ZDuality = caption((w) => {
  const top = w.swears.words[0];
  return top ? `said please ${int(w.swears.please)} times. said ${censor(top.name)} ${int(top.count)} times. the duality` : `said please ${int(w.swears.please)} times. never swore once. who raised me`;
});
export const ZSkill = caption((w) => `${int(w.totals.failedCommands)} failed commands. it's giving skill issue`);
export const ZSleep = caption((w) => {
  const late = w.lateNight ? clock(w.lateNight.time) : undefined;
  return late ? `${late.time} ${late.half.toLowerCase()}. sleep? never heard of her` : `${w.streak.days} day streak. touching grass? never heard of her`;
});
export const ZAura = caption((w) => `told my agent no ${int(w.corrections.total)} times. negative aura fr`);
