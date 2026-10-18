import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, parseState, serializeState, type AppState } from "./params";
import { MAX_ZOOM } from "./viewport";

describe("parseState", () => {
  it("returns the defaults for an empty query", () => {
    expect(parseState("")).toEqual(DEFAULT_STATE);
  });

  it("falls back to the defaults for invalid values", () => {
    expect(parseState("?re=abc&im=&z=NaN&scheme=rainbow&iter=123&aa=yes")).toEqual(DEFAULT_STATE);
  });

  it("clamps the zoom level", () => {
    expect(parseState("?z=999").zoom).toBe(MAX_ZOOM);
  });

  it("reads all fields", () => {
    expect(parseState("?re=-0.75&im=0.1&z=12.5&scheme=fire&iter=4096&aa=1")).toEqual({
      re: -0.75,
      im: 0.1,
      zoom: 12.5,
      colorScheme: "fire",
      maxIter: 4096,
      antialias: true,
    });
  });
});

describe("serializeState", () => {
  it("round-trips the state without losing coordinate precision", () => {
    const state: AppState = {
      re: -0.7436438870371587,
      im: 0.13182590420531198,
      zoom: 31.25,
      colorScheme: "ocean",
      maxIter: "auto",
      antialias: false,
    };
    expect(parseState(serializeState(state))).toEqual(state);
  });
});
