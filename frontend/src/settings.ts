/** カラースキーム。並び順が Rust（wasm/src/palette.rs の `SCHEMES`）に渡す番号になる */
export const COLOR_SCHEMES = [
  { id: "classic", label: "Classic" },
  { id: "fire", label: "Fire" },
  { id: "ocean", label: "Ocean" },
  { id: "neon", label: "Neon" },
  { id: "mono", label: "Mono" },
] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number]["id"];

/** 最大反復回数の選択肢。"auto" はズームレベルに合わせて増やす */
export const MAX_ITER_OPTIONS = ["auto", 256, 512, 1024, 2048, 4096, 8192, 16384] as const;

export type MaxIterSetting = (typeof MAX_ITER_OPTIONS)[number];

export interface RenderSettings {
  colorScheme: ColorScheme;
  maxIter: MaxIterSetting;
  /** アンチエイリアス（1 ピクセルを 2×2 で計算して平均する） */
  antialias: boolean;
}

export const DEFAULT_SETTINGS: RenderSettings = {
  colorScheme: "classic",
  maxIter: "auto",
  antialias: false,
};

export function isColorScheme(value: string): value is ColorScheme {
  return COLOR_SCHEMES.some((s) => s.id === value);
}

export function schemeIndex(scheme: ColorScheme): number {
  return COLOR_SCHEMES.findIndex((s) => s.id === scheme);
}

/** 自動のときの最大反復回数。拡大するほど境界の細部に反復が必要になるので増やす */
export function autoMaxIter(level: number): number {
  return Math.min(20000, Math.round(256 + 64 * Math.max(0, level) + 2 * Math.max(0, level) ** 2));
}

/** タイルのレベルに対する最大反復回数 */
export function maxIterFor(settings: RenderSettings, level: number): number {
  return settings.maxIter === "auto" ? autoMaxIter(level) : settings.maxIter;
}
