// Rust のクレート（../wasm）を WebAssembly にビルドし、src/generated/ にコピーする
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const crateDir = resolve(root, "wasm");
const target = "wasm32-unknown-unknown";

execFileSync("cargo", ["build", "--release", "--target", target], {
  cwd: crateDir,
  stdio: "inherit",
});

const outDir = resolve(root, "frontend/src/generated");
mkdirSync(outDir, { recursive: true });
copyFileSync(
  resolve(crateDir, "target", target, "release/mandelbrot.wasm"),
  resolve(outDir, "mandelbrot.wasm"),
);
console.log("Copied mandelbrot.wasm to src/generated/");
