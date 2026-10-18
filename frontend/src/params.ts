import { DEFAULT_SETTINGS, MAX_ITER_OPTIONS, isColorScheme, type MaxIterSetting, type RenderSettings } from "./settings";
import { clampZoom } from "./viewport";

/** URL のクエリに保存する状態 */
export interface AppState extends RenderSettings {
  re: number;
  im: number;
  zoom: number;
}

/** 既定の状態。ズームレベルは画面の大きさで決まるので、表示するときに `fitZoom` で置き換える */
export const DEFAULT_STATE: AppState = {
  re: -0.75,
  im: 0,
  zoom: 0,
  ...DEFAULT_SETTINGS,
};

/** URL のクエリ（`?re=...&im=...`）から状態を読む。不正な値は既定値にする */
export function parseState(search: string): AppState {
  const p = new URLSearchParams(search);
  const num = (name: string): number | null => {
    const raw = p.get(name);
    if (raw === null || raw.trim() === "") return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };

  const scheme = p.get("scheme") ?? "";
  const iterRaw = p.get("iter");
  const iter = iterRaw === "auto" ? "auto" : Number(iterRaw);
  const maxIter = MAX_ITER_OPTIONS.includes(iter as MaxIterSetting) ? (iter as MaxIterSetting) : DEFAULT_STATE.maxIter;
  const zoom = num("z");

  return {
    re: num("re") ?? DEFAULT_STATE.re,
    im: num("im") ?? DEFAULT_STATE.im,
    zoom: zoom === null ? DEFAULT_STATE.zoom : clampZoom(zoom),
    colorScheme: isColorScheme(scheme) ? scheme : DEFAULT_STATE.colorScheme,
    maxIter,
    antialias: p.has("aa") ? p.get("aa") === "1" : DEFAULT_STATE.antialias,
  };
}

/** 状態を URL のクエリ（先頭の `?` を含む）にする。座標は往復で値が変わらない最短の表記にする */
export function serializeState(state: AppState): string {
  const p = new URLSearchParams({
    re: String(state.re),
    im: String(state.im),
    z: String(Math.round(state.zoom * 1000) / 1000),
    scheme: state.colorScheme,
    iter: String(state.maxIter),
    aa: state.antialias ? "1" : "0",
  });
  return `?${p.toString()}`;
}
