import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, Viewport, fitZoom, pixelSizeAt } from "./viewport";

describe("Viewport", () => {
  it("maps the screen center to the viewport center", () => {
    const v = new Viewport(-0.5, 0.25, 3);
    expect(v.toComplex(400, 300, 800, 600)).toEqual({ re: -0.5, im: 0.25 });
  });

  it("treats the top of the screen as positive imaginary", () => {
    const v = new Viewport(0, 0, 0);
    expect(v.toComplex(400, 0, 800, 600).im).toBeGreaterThan(0);
  });

  it("pans so that the grabbed point follows the pointer", () => {
    const v = new Viewport(0, 0, 2);
    const grabbed = v.toComplex(100, 100, 800, 600);
    v.pan(50, -30);
    const now = v.toComplex(150, 70, 800, 600);
    expect(now.re).toBeCloseTo(grabbed.re, 12);
    expect(now.im).toBeCloseTo(grabbed.im, 12);
  });

  it("keeps the anchor point fixed while zooming", () => {
    const v = new Viewport(-0.5, 0, 1);
    const anchor = v.toComplex(123, 456, 800, 600);
    v.zoomAt(2.5, 123, 456, 800, 600);
    expect(v.zoom).toBe(3.5);
    const after = v.toComplex(123, 456, 800, 600);
    expect(after.re).toBeCloseTo(anchor.re, 12);
    expect(after.im).toBeCloseTo(anchor.im, 12);
  });

  it("clamps the zoom level", () => {
    const v = new Viewport();
    v.zoomAt(1000, 0, 0, 800, 600);
    expect(v.zoom).toBe(MAX_ZOOM);
    v.zoomAt(-1000, 0, 0, 800, 600);
    expect(v.zoom).toBe(MIN_ZOOM);
  });

  it("fits the whole set on the screen", () => {
    for (const [w, h] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      const v = new Viewport(-0.75, 0, fitZoom(w, h));
      const topLeft = v.toComplex(0, 0, w, h);
      const bottomRight = v.toComplex(w, h, w, h);
      expect(topLeft.re).toBeLessThanOrEqual(-2.5);
      expect(bottomRight.re).toBeGreaterThanOrEqual(1);
      expect(topLeft.im).toBeGreaterThanOrEqual(1.25);
      expect(bottomRight.im).toBeLessThanOrEqual(-1.25);
    }
  });

  it("halves the pixel size per zoom level", () => {
    expect(pixelSizeAt(1)).toBeCloseTo(pixelSizeAt(0) / 2, 15);
  });
});
