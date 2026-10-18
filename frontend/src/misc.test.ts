import { describe, expect, it, vi } from "vitest";
import { formatCoordinate, formatMagnification } from "./format";
import { COLOR_SCHEMES, autoMaxIter, maxIterFor, schemeIndex } from "./settings";
import { LruCache } from "./tileCache";

describe("LruCache", () => {
  const closable = () => ({ close: vi.fn() });

  it("evicts and closes the least recently used value", () => {
    const cache = new LruCache<ReturnType<typeof closable>>(2);
    const a = closable();
    const b = closable();
    const c = closable();
    cache.set("a", a);
    cache.set("b", b);
    cache.get("a"); // a を最近使ったことにする
    cache.set("c", c);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(b.close).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
  });

  it("closes the old value when a key is overwritten", () => {
    const cache = new LruCache<ReturnType<typeof closable>>(2);
    const a1 = closable();
    cache.set("a", a1);
    cache.set("a", closable());
    expect(a1.close).toHaveBeenCalledOnce();
    expect(cache.size).toBe(1);
  });
});

describe("settings", () => {
  it("keeps scheme indices in the order the Rust side expects", () => {
    expect(COLOR_SCHEMES.map((s) => s.id)).toEqual(["classic", "fire", "ocean", "neon", "mono"]);
    expect(schemeIndex("ocean")).toBe(2);
  });

  it("increases the automatic iteration count with the level", () => {
    expect(autoMaxIter(0)).toBe(256);
    expect(autoMaxIter(20)).toBeGreaterThan(autoMaxIter(10));
    expect(autoMaxIter(1000)).toBe(20000);
  });

  it("uses the fixed iteration count when not automatic", () => {
    expect(maxIterFor({ colorScheme: "classic", maxIter: 1024, antialias: false }, 30)).toBe(1024);
  });
});

describe("format", () => {
  it("shows more digits as the pixel size gets smaller", () => {
    expect(formatCoordinate(-0.5, 0.01)).toBe("-0.5000");
    expect(formatCoordinate(0.25, 1e-10)).toBe(" 0.25000000000");
  });

  it("formats the magnification", () => {
    expect(formatMagnification(0)).toBe("×1.00");
    expect(formatMagnification(20)).toBe("×1.05e6");
  });
});
