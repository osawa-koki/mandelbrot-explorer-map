import { formatCoordinate, formatMagnification } from "./format";
import { DEFAULT_STATE, parseState, serializeState, type AppState } from "./params";
import { COLOR_SCHEMES, MAX_ITER_OPTIONS, autoMaxIter, isColorScheme, type MaxIterSetting, type RenderSettings } from "./settings";
import { TileMap } from "./tileMap";
import { levelFor } from "./tiles";
import { Viewport, fitZoom } from "./viewport";

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const canvas = $<HTMLCanvasElement>("canvas");
const ctx = canvas.getContext("2d", { alpha: false })!;
const colorSchemeEl = $<HTMLSelectElement>("colorScheme");
const maxIterEl = $<HTMLSelectElement>("maxIter");
const antialiasEl = $<HTMLInputElement>("antialias");
const hudCenter = $<HTMLDivElement>("hudCenter");
const hudCursor = $<HTMLDivElement>("hudCursor");
const hudStatus = $<HTMLDivElement>("hudStatus");
const toastEl = $<HTMLDivElement>("toast");

// ---- 状態 ----

const initial = parseState(window.location.search);
const hasZoom = new URLSearchParams(window.location.search).has("z");
const viewport = new Viewport(
  initial.re,
  initial.im,
  hasZoom ? initial.zoom : fitZoom(window.innerWidth, window.innerHeight),
);
let settings: RenderSettings = {
  colorScheme: initial.colorScheme,
  maxIter: initial.maxIter,
  antialias: initial.antialias,
};

const workers = Math.max(2, Math.min(16, (navigator.hardwareConcurrency || 4) - 1));
const tileMap = new TileMap(settings, workers, () => requestRender());

let cssWidth = 0;
let cssHeight = 0;
let dpr = 1;
let cursor: { x: number; y: number } | null = null;

// ---- コントロール ----

for (const { id, label } of COLOR_SCHEMES) {
  colorSchemeEl.add(new Option(label, id));
}
for (const value of MAX_ITER_OPTIONS) {
  maxIterEl.add(new Option(value === "auto" ? "自動（拡大に合わせる）" : value.toLocaleString(), String(value)));
}

function syncControls(): void {
  colorSchemeEl.value = settings.colorScheme;
  maxIterEl.value = String(settings.maxIter);
  antialiasEl.checked = settings.antialias;
}

function applySettings(next: RenderSettings): void {
  settings = next;
  tileMap.setSettings(settings);
  syncControls();
  requestRender();
  scheduleUrlSync();
}

colorSchemeEl.addEventListener("change", () => {
  if (isColorScheme(colorSchemeEl.value)) applySettings({ ...settings, colorScheme: colorSchemeEl.value });
});
maxIterEl.addEventListener("change", () => {
  const v = maxIterEl.value === "auto" ? "auto" : Number(maxIterEl.value);
  applySettings({ ...settings, maxIter: v as MaxIterSetting });
});
antialiasEl.addEventListener("change", () => applySettings({ ...settings, antialias: antialiasEl.checked }));

function reset(): void {
  stopAnimation();
  viewport.re = DEFAULT_STATE.re;
  viewport.im = DEFAULT_STATE.im;
  viewport.zoom = fitZoom(cssWidth, cssHeight);
  applySettings({
    colorScheme: DEFAULT_STATE.colorScheme,
    maxIter: DEFAULT_STATE.maxIter,
    antialias: DEFAULT_STATE.antialias,
  });
}

$<HTMLButtonElement>("resetBtn").addEventListener("click", reset);
$<HTMLButtonElement>("copyBtn").addEventListener("click", async () => {
  syncUrlNow();
  try {
    await navigator.clipboard.writeText(window.location.href);
    showToast("リンクをコピーしました");
  } catch {
    showToast("コピーできませんでした");
  }
});
$<HTMLButtonElement>("zoomInBtn").addEventListener("click", () => animateZoom(1, cssWidth / 2, cssHeight / 2));
$<HTMLButtonElement>("zoomOutBtn").addEventListener("click", () => animateZoom(-1, cssWidth / 2, cssHeight / 2));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1600);
}

// ---- 描画 ----

let renderScheduled = false;

function requestRender(): void {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(frame);
}

function frame(now: number): void {
  renderScheduled = false;
  if (animation && !animation(now)) animation = null;
  tileMap.draw(ctx, viewport, cssWidth, cssHeight, dpr);
  updateHud();
  updateFavicon();
  if (animation) requestRender();
}

function resize(): void {
  cssWidth = window.innerWidth;
  cssHeight = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  requestRender();
}

function updateHud(): void {
  const ps = viewport.pixelSize;
  const level = levelFor(viewport.zoom, dpr);
  const iter = settings.maxIter === "auto" ? autoMaxIter(level) : settings.maxIter;
  hudCenter.textContent =
    `中心 Re ${formatCoordinate(viewport.re, ps)}\n` +
    `     Im ${formatCoordinate(viewport.im, ps)}\n` +
    `倍率 ${formatMagnification(viewport.zoom)}  反復 ${iter.toLocaleString()}`;
  if (cursor) {
    const c = viewport.toComplex(cursor.x, cursor.y, cssWidth, cssHeight);
    hudCursor.textContent = `カーソル ${formatCoordinate(c.re, ps)} ${c.im < 0 ? "-" : "+"} ${formatCoordinate(Math.abs(c.im), ps).trim()}i`;
  } else {
    hudCursor.textContent = "";
  }
  const pending = tileMap.pendingCount;
  hudStatus.textContent =
    pending > 0
      ? `計算中 ${pending} タイル（Worker ${workers}）`
      : `完了（直近 ${tileMap.lastTileMs.toFixed(0)} ms/タイル、Worker ${workers}）`;
}

// ---- ファビコン（画面中央を縮小して使う） ----

const faviconCanvas = document.createElement("canvas");
faviconCanvas.width = 32;
faviconCanvas.height = 32;
const faviconCtx = faviconCanvas.getContext("2d")!;
const faviconEl = $<HTMLLinkElement>("favicon");
let faviconTimer: ReturnType<typeof setTimeout> | undefined;

function updateFavicon(): void {
  clearTimeout(faviconTimer);
  faviconTimer = setTimeout(() => {
    const size = Math.min(canvas.width, canvas.height);
    faviconCtx.drawImage(canvas, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size, 0, 0, 32, 32);
    faviconEl.href = faviconCanvas.toDataURL();
  }, 500);
}

// ---- URL ----

let urlTimer: ReturnType<typeof setTimeout> | undefined;

function currentState(): AppState {
  return { re: viewport.re, im: viewport.im, zoom: viewport.zoom, ...settings };
}

function syncUrlNow(): void {
  clearTimeout(urlTimer);
  history.replaceState(null, "", serializeState(currentState()));
}

function scheduleUrlSync(): void {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(syncUrlNow, 300);
}

function viewChanged(): void {
  requestRender();
  scheduleUrlSync();
}

// ---- アニメーション（ズーム・慣性スクロール） ----

/** 毎フレーム呼ばれ、続けるなら true を返す */
let animation: ((now: number) => boolean) | null = null;

function stopAnimation(): void {
  animation = null;
}

function animateZoom(delta: number, sx: number, sy: number): void {
  const duration = 260;
  let start: number | null = null;
  let applied = 0;
  animation = (now) => {
    start ??= now;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    viewport.zoomAt(delta * eased - applied, sx, sy, cssWidth, cssHeight);
    applied = delta * eased;
    return t < 1;
  };
  viewChanged();
}

function animateFling(vx: number, vy: number): void {
  let last: number | null = null;
  animation = (now) => {
    const dt = last === null ? 16 : now - last;
    last = now;
    viewport.pan(vx * dt, vy * dt);
    const decay = Math.exp(-dt / 180);
    vx *= decay;
    vy *= decay;
    return Math.hypot(vx, vy) > 0.02;
  };
  viewChanged();
}

// ---- ポインター操作（マウス・タッチ・ペン） ----

const pointers = new Map<number, { x: number; y: number }>();
/** 慣性スクロール用に、直近の移動を残す */
let moveSamples: { t: number; x: number; y: number }[] = [];

function pinchInfo(): { x: number; y: number; distance: number } | null {
  if (pointers.size < 2) return null;
  const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

canvas.addEventListener("pointerdown", (e) => {
  stopAnimation();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moveSamples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
  canvas.classList.add("grabbing");
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") {
    cursor = { x: e.clientX, y: e.clientY };
    if (pointers.size === 0) {
      updateHud();
      return;
    }
  }
  const prev = pointers.get(e.pointerId);
  if (!prev) return;

  const before = pinchInfo();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const after = pinchInfo();

  if (before && after) {
    // 2 本指：中点の移動でパン、指の間隔の変化でズーム
    viewport.pan(after.x - before.x, after.y - before.y);
    if (before.distance > 0 && after.distance > 0) {
      viewport.zoomAt(Math.log2(after.distance / before.distance), after.x, after.y, cssWidth, cssHeight);
    }
    moveSamples = [];
  } else if (pointers.size === 1) {
    viewport.pan(e.clientX - prev.x, e.clientY - prev.y);
    moveSamples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    moveSamples = moveSamples.filter((s) => e.timeStamp - s.t < 100);
  }
  viewChanged();
});

function endPointer(e: PointerEvent): void {
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0) {
    canvas.classList.remove("grabbing");
    const first = moveSamples[0];
    const last = moveSamples[moveSamples.length - 1];
    if (first && last && last.t - first.t > 10 && e.timeStamp - last.t < 50) {
      const dt = last.t - first.t;
      animateFling((last.x - first.x) / dt, (last.y - first.y) / dt);
    }
  }
  moveSamples = [];
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse") {
    cursor = null;
    updateHud();
  }
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    stopAnimation();
    // deltaMode: 0 = ピクセル、1 = 行、2 = ページ
    const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? cssHeight : 1;
    // トラックパッドのピンチは ctrlKey 付きの小さな wheel として届くので、感度を上げる
    const sensitivity = e.ctrlKey ? 0.01 : 0.002;
    const delta = Math.max(-1, Math.min(1, -e.deltaY * unit * sensitivity));
    viewport.zoomAt(delta, e.clientX, e.clientY, cssWidth, cssHeight);
    viewChanged();
  },
  { passive: false },
);

canvas.addEventListener("dblclick", (e) => {
  animateZoom(e.shiftKey ? -1 : 1, e.clientX, e.clientY);
});

// ---- キーボード ----

window.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("select, input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  const step = 120;
  switch (e.key) {
    case "ArrowLeft":
      stopAnimation();
      viewport.pan(step, 0);
      break;
    case "ArrowRight":
      stopAnimation();
      viewport.pan(-step, 0);
      break;
    case "ArrowUp":
      stopAnimation();
      viewport.pan(0, step);
      break;
    case "ArrowDown":
      stopAnimation();
      viewport.pan(0, -step);
      break;
    case "+":
    case "=":
      animateZoom(1, cssWidth / 2, cssHeight / 2);
      break;
    case "-":
    case "_":
      animateZoom(-1, cssWidth / 2, cssHeight / 2);
      break;
    case "0":
      reset();
      break;
    default:
      return;
  }
  e.preventDefault();
  viewChanged();
});

// ---- 起動 ----

syncControls();
window.addEventListener("resize", resize);
// 別の画面に移って devicePixelRatio が変わったときも描き直す
function watchDevicePixelRatio(): void {
  window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
    "change",
    () => {
      resize();
      watchDevicePixelRatio();
    },
    { once: true },
  );
}
watchDevicePixelRatio();
if (window.innerWidth < 600) $<HTMLDetailsElement>("panel").open = false;
resize();
syncUrlNow();
