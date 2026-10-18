import { describe, expect, it } from "vitest";
import { MAX_LEVEL, ancestor, children, levelFor, tileBounds, tileWidth, visibleTiles } from "./tiles";
import { MAX_ZOOM, TILE_SIZE, Viewport } from "./viewport";

describe("levelFor", () => {
  it("matches the zoom level on a standard display", () => {
    expect(levelFor(3, 1)).toBe(3);
  });

  it("uses finer tiles on high-DPI displays", () => {
    expect(levelFor(3, 2)).toBe(4);
  });

  it("stays within the valid range", () => {
    expect(levelFor(-5, 1)).toBe(0);
    expect(levelFor(MAX_ZOOM, 3)).toBe(MAX_LEVEL);
  });
});

describe("tileBounds", () => {
  it("returns the top-left corner and the pixel size", () => {
    expect(tileBounds({ level: 0, tx: -1, ty: -1 })).toEqual({ reMin: -4, imMax: 4, step: 4 / TILE_SIZE });
    expect(tileBounds({ level: 2, tx: 3, ty: 1 })).toEqual({ reMin: 3, imMax: -1, step: 1 / TILE_SIZE });
  });
});

describe("visibleTiles", () => {
  it("covers the whole screen without gaps", () => {
    const v = new Viewport(-0.7436, 0.1318, 10.3);
    const width = 1280;
    const height = 720;
    const level = levelFor(v.zoom, 1);
    const tiles = visibleTiles(v, width, height, level);

    const left = Math.min(...tiles.map((t) => t.x));
    const top = Math.min(...tiles.map((t) => t.y));
    const right = Math.max(...tiles.map((t) => t.x + t.size));
    const bottom = Math.max(...tiles.map((t) => t.y + t.size));
    expect(left).toBeLessThanOrEqual(0);
    expect(top).toBeLessThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(width);
    expect(bottom).toBeGreaterThanOrEqual(height);

    // 列 × 行の数だけ、重複なくある
    const cols = new Set(tiles.map((t) => t.tx)).size;
    const rows = new Set(tiles.map((t) => t.ty)).size;
    expect(tiles.length).toBe(cols * rows);
    expect(new Set(tiles.map((t) => `${t.tx}/${t.ty}`)).size).toBe(tiles.length);
  });

  it("places tiles consistently with the viewport mapping", () => {
    const v = new Viewport(-0.5, 0.2, 4.6);
    const [tile] = visibleTiles(v, 800, 600, 5);
    const { reMin, imMax } = tileBounds(tile!);
    const corner = v.toComplex(tile!.x, tile!.y, 800, 600);
    expect(corner.re).toBeCloseTo(reMin, 12);
    expect(corner.im).toBeCloseTo(imMax, 12);
    expect(tile!.size).toBeCloseTo(tileWidth(5) / v.pixelSize, 9);
  });

  it("sorts tiles from the screen center outwards", () => {
    const v = new Viewport(0.1, -0.3, 6);
    const tiles = visibleTiles(v, 1000, 800, 6);
    const center = tiles[0]!;
    expect(center.x).toBeLessThanOrEqual(500);
    expect(center.x + center.size).toBeGreaterThanOrEqual(500);
    expect(center.y).toBeLessThanOrEqual(400);
    expect(center.y + center.size).toBeGreaterThanOrEqual(400);
  });
});

describe("ancestor / children", () => {
  it("finds the parent and the source rectangle, including negative coordinates", () => {
    expect(ancestor({ level: 5, tx: -3, ty: 5 }, 1)).toEqual({
      coord: { level: 4, tx: -2, ty: 2 },
      sx: TILE_SIZE / 2,
      sy: TILE_SIZE / 2,
      sSize: TILE_SIZE / 2,
    });
    expect(ancestor({ level: 5, tx: 7, ty: -1 }, 2)).toEqual({
      coord: { level: 3, tx: 1, ty: -1 },
      sx: (3 * TILE_SIZE) / 4,
      sy: (3 * TILE_SIZE) / 4,
      sSize: TILE_SIZE / 4,
    });
  });

  it("returns null above level 0", () => {
    expect(ancestor({ level: 1, tx: 0, ty: 0 }, 2)).toBeNull();
  });

  it("is the inverse of children", () => {
    const tile = { level: 7, tx: -11, ty: 4 };
    for (const { coord } of children(tile)) {
      expect(ancestor(coord, 1)?.coord).toEqual(tile);
    }
  });
});
