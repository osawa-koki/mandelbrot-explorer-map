import { MAX_ZOOM, TILE_SIZE, WORLD_SIZE, type Viewport } from "./viewport";

/** タイルのレベルの上限（高 DPI の画面ではズームレベルより 1〜2 大きくなる） */
export const MAX_LEVEL = MAX_ZOOM + 2;

/**
 * タイルの座標。レベル L のタイルは一辺 `WORLD_SIZE / 2^L` の正方形で、
 * (tx, ty) のタイルは実部 [tx·W, (tx+1)·W]、虚部 [-(ty+1)·W, -ty·W] を覆う（ty は下向きに増える）。
 */
export interface TileCoord {
  level: number;
  tx: number;
  ty: number;
}

export function tileWidth(level: number): number {
  return WORLD_SIZE / 2 ** level;
}

/** タイル左上の角の座標と、1 ピクセルの幅（Rust の `render` に渡す値） */
export function tileBounds({ level, tx, ty }: TileCoord): { reMin: number; imMax: number; step: number } {
  const w = tileWidth(level);
  return { reMin: tx * w, imMax: -ty * w, step: w / TILE_SIZE };
}

/**
 * 表示に使うタイルのレベルを決める。
 * タイルの 1 ピクセルが画面の物理ピクセルとおおむね同じ大きさになるレベルを選ぶ。
 */
export function levelFor(zoom: number, devicePixelRatio: number): number {
  const ideal = zoom + Math.log2(Math.max(1, devicePixelRatio));
  // 少しだけ拡大表示（最大 2^0.25 倍）を許して、計算するタイルの数を抑える
  return Math.min(MAX_LEVEL, Math.max(0, Math.ceil(ideal - 0.25)));
}

/** 画面に描くタイル 1 枚 */
export interface PlacedTile extends TileCoord {
  /** 画面上の左上の座標と一辺（CSS ピクセル） */
  x: number;
  y: number;
  size: number;
}

/** 画面（width × height の CSS ピクセル）を覆うレベル `level` のタイルを、画面の中心に近い順に返す */
export function visibleTiles(viewport: Viewport, width: number, height: number, level: number): PlacedTile[] {
  const w = tileWidth(level);
  const ps = viewport.pixelSize;
  const size = w / ps;

  const reLeft = viewport.re - (width / 2) * ps;
  const reRight = viewport.re + (width / 2) * ps;
  const imTop = viewport.im + (height / 2) * ps;
  const imBottom = viewport.im - (height / 2) * ps;

  const txMin = Math.floor(reLeft / w);
  const txMax = Math.ceil(reRight / w) - 1;
  const tyMin = Math.floor(-imTop / w);
  const tyMax = Math.ceil(-imBottom / w) - 1;

  const tiles: (PlacedTile & { distance: number })[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      // 画面座標は「タイルの角 − 中心」の差から求める（大きな座標どうしの引き算で桁が落ちないように）
      const x = (tx * w - viewport.re) / ps + width / 2;
      const y = (viewport.im + ty * w) / ps + height / 2;
      const distance = Math.hypot(x + size / 2 - width / 2, y + size / 2 - height / 2);
      tiles.push({ level, tx, ty, x, y, size, distance });
    }
  }
  tiles.sort((a, b) => a.distance - b.distance);
  return tiles.map(({ distance: _distance, ...tile }) => tile);
}

/** `levelsUp` 段上（粗い側）の祖先のタイルと、その中で自分が占める範囲（タイルのピクセル単位） */
export function ancestor(
  tile: TileCoord,
  levelsUp: number,
): { coord: TileCoord; sx: number; sy: number; sSize: number } | null {
  if (levelsUp <= 0 || tile.level - levelsUp < 0) return null;
  const scale = 2 ** levelsUp;
  const ptx = Math.floor(tile.tx / scale);
  const pty = Math.floor(tile.ty / scale);
  const sSize = TILE_SIZE / scale;
  return {
    coord: { level: tile.level - levelsUp, tx: ptx, ty: pty },
    sx: (tile.tx - ptx * scale) * sSize,
    sy: (tile.ty - pty * scale) * sSize,
    sSize,
  };
}

/** 1 段下（細かい側）の 4 枚の子タイルと、自分の中で占める位置（0 か 1） */
export function children(tile: TileCoord): { coord: TileCoord; ox: number; oy: number }[] {
  const result: { coord: TileCoord; ox: number; oy: number }[] = [];
  for (let oy = 0; oy < 2; oy++) {
    for (let ox = 0; ox < 2; ox++) {
      result.push({ coord: { level: tile.level + 1, tx: tile.tx * 2 + ox, ty: tile.ty * 2 + oy }, ox, oy });
    }
  }
  return result;
}
