import { renderMedia, selectComposition, type OnBrowserDownload } from "@remotion/renderer";
import { existsSync, realpathSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join } from "node:path";
import { soundtrack } from "./audio/soundtrack.ts";
import type { Wrapped } from "./types.ts";
import { COMPOSITION_ID, planCards, quoteCount, type Cut, type Format, type WrappedProps } from "./video/plan.ts";

// The installed binary sits next to a prebuilt Remotion site and the compositor
// binaries (see scripts/build.ts). From source, the site is bundled on the fly.
const home = dirname(realpathSync(process.execPath));
const installed = existsSync(join(home, "site", "index.html"));

// Remotion logs a progress line every 10 MB, which floods an agent's tool output.
const onBrowserDownload: OnBrowserDownload = () => {
  process.stderr.write("Downloading Chrome Headless Shell (about 170 MB, first video only)\n");
  return { version: null, onProgress: () => {} };
};

export interface RenderOptions {
  format: Format;
  cut: Cut;
  blurProjects: boolean;
}

/** Renders the Wrapped video as an H.264 MP4 at 30 fps, with its soundtrack. The first run downloads Chrome Headless Shell. */
export async function renderVideo(wrapped: Wrapped, { format, cut, blurProjects }: RenderOptions, outputLocation: string, onProgress: (progress: number) => void): Promise<void> {
  let serveUrl: string;
  if (installed) {
    serveUrl = join(home, "site");
    // Remotion caches Chrome under the nearest package.json, so keep it in the install directory.
    process.chdir(home);
  } else {
    const { bundle } = await import("@remotion/bundler");
    serveUrl = await bundle({ entryPoint: new URL("./video/entry.ts", import.meta.url).pathname, publicDir: new URL("../public", import.meta.url).pathname });
  }
  const binariesDirectory = installed ? join(home, "compositor") : null;
  // Remotion fetches audio over HTTP, so the generated WAV is served locally for the render.
  const wav = soundtrack(planCards(wrapped, cut), quoteCount(wrapped, format, cut));
  using server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(wav, { headers: { "content-type": "audio/wav" } }) });
  const inputProps: WrappedProps = { wrapped, format, cut, blurProjects, soundtrack: `http://127.0.0.1:${server.port}/soundtrack.wav` };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, binariesDirectory, onBrowserDownload });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    imageFormat: "jpeg",
    jpegQuality: 92,
    concurrency: Math.max(1, Math.min(8, cpus().length - 1)),
    outputLocation,
    inputProps,
    binariesDirectory,
    onBrowserDownload,
    onProgress: ({ progress }) => onProgress(progress),
  });
}
