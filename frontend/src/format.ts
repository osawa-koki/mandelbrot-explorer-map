/** 座標を、1 ピクセルの幅が見分けられる桁数で表示する */
export function formatCoordinate(value: number, pixelSize: number): string {
  const digits = Math.min(17, Math.max(4, Math.ceil(-Math.log10(pixelSize)) + 1));
  const text = value.toFixed(digits);
  return value >= 0 ? ` ${text}` : text;
}

/** ズームレベルを倍率（×2^zoom）で表示する */
export function formatMagnification(zoom: number): string {
  const m = 2 ** zoom;
  if (m < 1000) return `×${m.toPrecision(3)}`;
  const exponent = Math.floor(Math.log10(m));
  return `×${(m / 10 ** exponent).toFixed(2)}e${exponent}`;
}
