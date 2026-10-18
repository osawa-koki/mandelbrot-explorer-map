import type { WorkerRequest } from "./render.worker";
import { maxIterFor, schemeIndex, type RenderSettings } from "./settings";
import { LruCache } from "./tileCache";
import { ancestor, children, levelFor, tileBounds, visibleTiles, type TileCoord } from "./tiles";
import { TILE_SIZE, type Viewport } from "./viewport";
import { WorkerPool } from "./workerPool";

/** 仮表示に使う祖先タイルを、何段上までさかのぼるか */
const MAX_FALLBACK_LEVELS = 10;
const CACHE_CAPACITY = 512;

/** 描画設定とタイルの座標から、キャッシュのキーを作る */
function tileKey(settings: RenderSettings, { level, tx, ty }: TileCoord): string {
  const samples = settings.antialias ? 2 : 1;
  return `${settings.colorScheme}|${maxIterFor(settings, level)}|${samples}|${level}/${tx}/${ty}`;
}

/** 画面上の矩形（物理ピクセル） */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * タイルの計算依頼・キャッシュ・Canvas への描画をまとめて扱う。
 * まだ計算できていないタイルは、キャッシュにある祖先（粗い）や子（細かい）のタイルで仮に埋める。
 */
export class TileMap {
  private readonly cache = new LruCache<ImageBitmap>(CACHE_CAPACITY);
  private readonly pool: WorkerPool;
  private settings: RenderSettings;
  /** 設定を変えた直後に、仮表示に使う前の設定 */
  private previousSettings: RenderSettings | null = null;

  constructor(settings: RenderSettings, workers: number, onTileLoaded: () => void) {
    this.settings = settings;
    this.pool = new WorkerPool(workers, (key, bitmap) => {
      this.cache.set(key, bitmap);
      onTileLoaded();
    });
  }

  get pendingCount(): number {
    return this.pool.pendingCount;
  }

  get lastTileMs(): number {
    return this.pool.lastTileMs;
  }

  setSettings(settings: RenderSettings): void {
    this.previousSettings = this.settings;
    this.settings = settings;
  }

  /** 画面全体を描き直し、足りないタイルの計算を依頼する */
  draw(ctx: CanvasRenderingContext2D, viewport: Viewport, cssWidth: number, cssHeight: number, dpr: number): void {
    const canvas = ctx.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const level = levelFor(viewport.zoom, dpr);
    const requests: WorkerRequest[] = [];

    for (const tile of visibleTiles(viewport, cssWidth, cssHeight, level)) {
      // 端を物理ピクセルに丸め、隣のタイルとの間にすき間ができないようにする
      const x0 = Math.round(tile.x * dpr);
      const y0 = Math.round(tile.y * dpr);
      const rect = {
        x: x0,
        y: y0,
        w: Math.round((tile.x + tile.size) * dpr) - x0,
        h: Math.round((tile.y + tile.size) * dpr) - y0,
      };

      const key = tileKey(this.settings, tile);
      const bitmap = this.cache.get(key);
      if (bitmap) {
        ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h);
        continue;
      }
      this.drawFallback(ctx, tile, rect);
      requests.push({
        key,
        ...tileBounds(tile),
        maxIter: maxIterFor(this.settings, level),
        scheme: schemeIndex(this.settings.colorScheme),
        samples: this.settings.antialias ? 2 : 1,
      });
    }

    this.pool.setQueue(requests);
  }

  private lookup(coord: TileCoord): ImageBitmap | undefined {
    return (
      this.cache.get(tileKey(this.settings, coord)) ??
      (this.previousSettings ? this.cache.get(tileKey(this.previousSettings, coord)) : undefined)
    );
  }

  private drawFallback(ctx: CanvasRenderingContext2D, tile: TileCoord, rect: Rect): void {
    // 前の設定で計算した同じタイルがあれば、それで十分
    if (this.previousSettings) {
      const same = this.cache.get(tileKey(this.previousSettings, tile));
      if (same) {
        ctx.drawImage(same, rect.x, rect.y, rect.w, rect.h);
        return;
      }
    }

    // 祖先（拡大したときに残っている粗いタイル）の一部を引き伸ばして描く
    for (let up = 1; up <= MAX_FALLBACK_LEVELS; up++) {
      const a = ancestor(tile, up);
      if (!a) break;
      const bitmap = this.lookup(a.coord);
      if (bitmap) {
        ctx.drawImage(bitmap, a.sx, a.sy, a.sSize, a.sSize, rect.x, rect.y, rect.w, rect.h);
        break;
      }
    }

    // 子（縮小したときに残っている細かいタイル）があれば、その上から描く
    const halfW = rect.w / 2;
    const halfH = rect.h / 2;
    for (const { coord, ox, oy } of children(tile)) {
      const bitmap = this.lookup(coord);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, TILE_SIZE, TILE_SIZE, rect.x + ox * halfW, rect.y + oy * halfH, halfW, halfH);
      }
    }
  }
}
