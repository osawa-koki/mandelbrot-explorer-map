/** Rust（../wasm）が export する関数 */
interface MandelbrotExports {
  memory: WebAssembly.Memory;
  tile_size(): number;
  renderer_new(): number;
  renderer_pixels(renderer: number): number;
  renderer_render(
    renderer: number,
    reMin: number,
    imMax: number,
    step: number,
    maxIter: number,
    scheme: number,
    samples: number,
  ): void;
}

/** タイル 1 枚の計算に必要な値 */
export interface TileRequest {
  /** タイル左上の角の実部 */
  reMin: number;
  /** タイル左上の角の虚部（上が正） */
  imMax: number;
  /** 1 ピクセルの幅 */
  step: number;
  maxIter: number;
  /** カラースキームの番号（Rust の `SCHEMES` のインデックス） */
  scheme: number;
  /** アンチエイリアスのサンプル数（一辺）。1 で無効 */
  samples: number;
}

/** WebAssembly のレンダラー。Worker ごとに 1 つ作る */
export class WasmRenderer {
  readonly tileSize: number;
  private readonly handle: number;

  private constructor(private readonly exports: MandelbrotExports) {
    this.tileSize = exports.tile_size();
    this.handle = exports.renderer_new();
  }

  static async fromBytes(bytes: BufferSource): Promise<WasmRenderer> {
    const { instance } = await WebAssembly.instantiate(bytes);
    return new WasmRenderer(instance.exports as unknown as MandelbrotExports);
  }

  static async fromUrl(url: string): Promise<WasmRenderer> {
    const response = fetch(url);
    try {
      const { instance } = await WebAssembly.instantiateStreaming(response);
      return new WasmRenderer(instance.exports as unknown as MandelbrotExports);
    } catch {
      // Content-Type が application/wasm でないときは、バイト列から読み込む
      return WasmRenderer.fromBytes(await (await response).clone().arrayBuffer());
    }
  }

  /** タイルを計算し、RGBA のピクセル列（コピー）を返す */
  render(req: TileRequest): Uint8ClampedArray<ArrayBuffer> {
    const e = this.exports;
    e.renderer_render(this.handle, req.reMin, req.imMax, req.step, req.maxIter, req.scheme, req.samples);
    const ptr = e.renderer_pixels(this.handle);
    const length = this.tileSize * this.tileSize * 4;
    // memory.buffer はメモリが伸びると差し替わるので、毎回取り直してコピーする
    return new Uint8ClampedArray(e.memory.buffer, ptr, length).slice();
  }
}
