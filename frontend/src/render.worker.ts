/// <reference lib="webworker" />
import wasmUrl from "./generated/mandelbrot.wasm?url";
import { WasmRenderer, type TileRequest } from "./wasm";

export interface WorkerRequest extends TileRequest {
  key: string;
}

export type WorkerResponse =
  | { key: string; bitmap: ImageBitmap; elapsedMs: number }
  | { key: string; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const rendererPromise = WasmRenderer.fromUrl(wasmUrl);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    const renderer = await rendererPromise;
    const start = performance.now();
    const pixels = renderer.render(req);
    const image = new ImageData(pixels, renderer.tileSize, renderer.tileSize);
    const bitmap = await createImageBitmap(image);
    const response: WorkerResponse = { key: req.key, bitmap, elapsedMs: performance.now() - start };
    scope.postMessage(response, [bitmap]);
  } catch (e) {
    const response: WorkerResponse = { key: req.key, error: String(e) };
    scope.postMessage(response);
  }
};
