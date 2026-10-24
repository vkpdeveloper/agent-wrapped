// Builds dist/: the prebuilt Remotion site and compositor binaries used for
// rendering, and the compiled `agent-wrapped` binary.
import { bundle } from "@remotion/bundler";
import { $ } from "bun";
import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist);

await bundle({ entryPoint: join(root, "src/video/entry.ts"), publicDir: join(root, "public"), outDir: join(dist, "site") });
console.log("built dist/site");

const suffix = process.platform === "linux" ? "-gnu" : process.platform === "win32" ? "-msvc" : "";
const platform = `${process.platform}-${process.arch}${suffix}`;
const compositor = dirname(createRequire(import.meta.url).resolve(`@remotion/compositor-${platform}/package.json`));
await cp(compositor, join(dist, "compositor"), { recursive: true });
console.log("copied dist/compositor");

// The bundler (webpack) is only needed when rendering from source.
await $`bun build ${join(root, "src/cli.ts")} --compile --minify --external @remotion/bundler --outfile ${join(dist, "agent-wrapped")}`.quiet();
console.log("compiled dist/agent-wrapped");
