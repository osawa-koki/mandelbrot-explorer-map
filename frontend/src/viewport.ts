/** ズームレベル 0 でタイル 1 枚が覆う幅（実部 -2〜2） */
export const WORLD_SIZE = 4;

/** タイルの一辺のピクセル数（CSS ピクセル。Rust の `TILE_SIZE` と同じ） */
export const TILE_SIZE = 256;

export const MIN_ZOOM = -1;
/** 倍精度浮動小数点数で描ける限界（これより拡大するとピクセルが粗くなる） */
export const MAX_ZOOM = 42;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** 集合全体（実部 -2.5〜1、虚部 -1.25〜1.25 に余白を足した範囲）が画面に収まるズームレベル */
export function fitZoom(width: number, height: number): number {
  const ps = Math.max(3.6 / Math.max(1, width), 2.7 / Math.max(1, height));
  return clampZoom(Math.log2(WORLD_SIZE / (TILE_SIZE * ps)));
}

/** ズームレベルから、1 CSS ピクセルあたりの複素平面上の幅を求める */
export function pixelSizeAt(zoom: number): number {
  return WORLD_SIZE / (2 ** zoom * TILE_SIZE);
}

/**
 * 画面に映す範囲。中心の座標とズームレベル（連続値）で表す。
 * ズームレベルが 1 増えると 2 倍に拡大する。虚部は画面の上が正。
 */
export class Viewport {
  constructor(
    public re = -0.5,
    public im = 0,
    public zoom = 0,
  ) {}

  get pixelSize(): number {
    return pixelSizeAt(this.zoom);
  }

  /** 画面の座標（CSS ピクセル）を複素平面の座標に変換する */
  toComplex(sx: number, sy: number, width: number, height: number): { re: number; im: number } {
    const ps = this.pixelSize;
    return {
      re: this.re + (sx - width / 2) * ps,
      im: this.im - (sy - height / 2) * ps,
    };
  }

  /** 画面上で (dx, dy) ピクセル動かす（地図と同じく、つかんだ点が指についてくる向き） */
  pan(dx: number, dy: number): void {
    const ps = this.pixelSize;
    this.re -= dx * ps;
    this.im += dy * ps;
  }

  /** 画面の点 (sx, sy) を動かさずに、ズームレベルを `deltaZoom` だけ変える */
  zoomAt(deltaZoom: number, sx: number, sy: number, width: number, height: number): void {
    const anchor = this.toComplex(sx, sy, width, height);
    this.zoom = clampZoom(this.zoom + deltaZoom);
    const ps = this.pixelSize;
    this.re = anchor.re - (sx - width / 2) * ps;
    this.im = anchor.im + (sy - height / 2) * ps;
  }
}
