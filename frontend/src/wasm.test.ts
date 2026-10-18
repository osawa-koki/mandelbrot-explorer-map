import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tileBounds } from "./tiles";
import { TILE_SIZE } from "./viewport";
import { WasmRenderer } from "./wasm";

// npm test の前に scripts/build-wasm.mjs が生成する
const wasmBytes = readFileSync(new URL("./generated/mandelbrot.wasm", import.meta.url));

describe("WasmRenderer", () => {
  it("renders a tile of the expected size", async () => {
    const renderer = await WasmRenderer.fromBytes(wasmBytes);
    expect(renderer.tileSize).toBe(TILE_SIZE);
    const pixels = renderer.render({ reMin: -2, imMax: 2, step: 4 / TILE_SIZE, maxIter: 256, scheme: 0, samples: 1 });
    expect(pixels.length).toBe(TILE_SIZE * TILE_SIZE * 4);
  });

  it("paints the set black and the outside in color", async () => {
    const renderer = await WasmRenderer.fromBytes(wasmBytes);
    // レベル 0 のタイル (-1, -1) は実部 -4〜0、虚部 0〜4 を覆う
    const pixels = renderer.render({
      ...tileBounds({ level: 0, tx: -1, ty: -1 }),
      maxIter: 256,
      scheme: 0,
      samples: 1,
    });
    const at = (re: number, im: number) => {
      const px = Math.floor((re + 4) / (4 / TILE_SIZE));
      const py = Math.floor((4 - im) / (4 / TILE_SIZE));
      const i = (py * TILE_SIZE + px) * 4;
      return [...pixels.slice(i, i + 4)];
    };
    expect(at(-0.2, 0.01)).toEqual([0, 0, 0, 255]);
    expect(at(-3, 3)).not.toEqual([0, 0, 0, 255]);
    expect(at(-3, 3)[3]).toBe(255);
  });

  it("returns an independent copy for each tile", async () => {
    const renderer = await WasmRenderer.fromBytes(wasmBytes);
    const req = { reMin: -2, imMax: 2, step: 4 / TILE_SIZE, maxIter: 128, samples: 1 };
    const classic = renderer.render({ ...req, scheme: 0 });
    const fire = renderer.render({ ...req, scheme: 1 });
    expect(classic).not.toEqual(fire);
  });
});
