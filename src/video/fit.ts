// Shrink-to-fit for text of unknown length (names, titles, rules). Measured
// against a hidden DOM node so variable-font widths and wrapping are exact.

export interface Type {
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: string;
  fontStretch?: string;
  fontVariantNumeric?: string;
}

export interface FitOptions {
  width: number;
  max: number;
  min: number;
  /** Lines the text may wrap to. 1 keeps it on a single line. */
  lines?: number;
  type: Type;
}

let probe: HTMLDivElement | undefined;
const cache = new Map<string, { size: number; fits: boolean }>();

function measure(text: string, size: number, { width, lines = 1, type }: FitOptions): boolean {
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden";
    document.body.appendChild(probe);
  }
  probe.style.fontFamily = type.fontFamily;
  probe.style.fontWeight = String(type.fontWeight);
  probe.style.lineHeight = String(type.lineHeight);
  probe.style.letterSpacing = type.letterSpacing ?? "normal";
  probe.style.fontStretch = type.fontStretch ?? "100%";
  probe.style.fontVariantNumeric = type.fontVariantNumeric ?? "normal";
  probe.style.fontSize = `${size}px`;
  // `text-wrap` and `white-space` both set the wrap mode, so only one of them is used.
  probe.style.whiteSpace = lines === 1 ? "nowrap" : "normal";
  probe.style.textWrap = lines === 1 ? "nowrap" : "balance";
  probe.style.width = lines === 1 ? "max-content" : `${width}px`;
  probe.textContent = text;
  const fitsWidth = probe.scrollWidth <= width + 0.5;
  const fitsHeight = probe.getBoundingClientRect().height <= lines * type.lineHeight * size + 1;
  return fitsWidth && fitsHeight;
}

/** The largest size between `min` and `max` at which `text` fits, and whether even `min` fits. */
export function fitSize(text: string, options: FitOptions): { size: number; fits: boolean } {
  const key = JSON.stringify([text, options]);
  const hit = cache.get(key);
  if (hit) return hit;
  let size = options.max;
  while (size > options.min && !measure(text, size, options)) {
    size = Math.max(options.min, Math.floor(size * 0.95));
  }
  const result = { size, fits: size > options.min || measure(text, size, options) };
  cache.set(key, result);
  return result;
}
