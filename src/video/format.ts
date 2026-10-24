const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** One decimal under 100 hours, whole hours above. */
export function hours(h: number): string {
  if (h >= 100) return int(h);
  return h.toFixed(1).replace(/\.0$/, "");
}

/** Thousands separators up to a million, then 1.2M / 3.4B. */
export function big(n: number): string {
  if (n < 1_000_000) return int(n);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** "2026-10-12" -> "Oct 12" */
export function day(date: string): string {
  const [, month, dayOfMonth] = date.split("-").map(Number);
  return `${MONTHS[(month ?? 1) - 1]} ${dayOfMonth ?? ""}`;
}

/** "03:47" -> { time: "03:47", half: "AM" }, "15:20" -> { time: "03:20", half: "PM" } */
export function clock(time: string): { time: string; half: "AM" | "PM" } {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return { time: `${String(twelve).padStart(2, "0")}:${String(m).padStart(2, "0")}`, half: h < 12 ? "AM" : "PM" };
}

/** 0 -> "12 AM", 23 -> "11 PM" */
export function hourLabel(hour: number): string {
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${hour < 12 ? "AM" : "PM"}`;
}

/** "anthropic/claude-opus-4-5-20251101" -> "claude-opus-4-5" */
export function model(id: string): string {
  return (id.split("/").at(-1) ?? id).replace(/-\d{8}$/, "");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
