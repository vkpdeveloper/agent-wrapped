import { Img, staticFile } from "remotion";
import type { AgentId } from "../types.ts";

/** The agent's real logo (public/logos/<id>.svg) on a white app-icon tile, so every mark reads on any field. */
export function AgentIcon({ agent, size, round = false }: { agent: AgentId; size: number; round?: boolean }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0, borderRadius: round ? "50%" : size * 0.24, background: "#ffffff", display: "grid", placeItems: "center" }}>
      <Img src={staticFile(`logos/${agent}.svg`)} style={{ width: size * 0.66, height: size * 0.66 }} />
    </div>
  );
}
