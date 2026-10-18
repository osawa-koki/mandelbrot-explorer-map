//! マンデルブロ集合のタイルを計算する WebAssembly モジュール。
//!
//! JavaScript からは次の順で使う。
//!
//! 1. `renderer_new()` でレンダラーを作る（Worker ごとに 1 つ）
//! 2. `renderer_render(...)` でタイル 1 枚分（`TILE_SIZE` × `TILE_SIZE`）を計算する
//! 3. `renderer_pixels()` が返すアドレスから、RGBA のピクセル列を読み出す

pub mod escape;
pub mod palette;

use escape::smooth_escape_time;
use palette::{INTERIOR_COLOR, build_palette, palette_index};

/// タイルの一辺のピクセル数。
pub const TILE_SIZE: usize = 256;

/// 1 ピクセルあたりのサンプル数（一辺）の上限。
pub const MAX_SAMPLES: u32 = 4;

pub struct Renderer {
    pixels: Vec<u32>,
    palette: Vec<u32>,
    scheme: u32,
}

impl Default for Renderer {
    fn default() -> Self {
        Self::new()
    }
}

impl Renderer {
    pub fn new() -> Self {
        Self {
            pixels: vec![INTERIOR_COLOR; TILE_SIZE * TILE_SIZE],
            palette: build_palette(0),
            scheme: 0,
        }
    }

    pub fn pixels(&self) -> &[u32] {
        &self.pixels
    }

    /// タイルを計算する。
    ///
    /// - `re_min`, `im_max`：タイル左上の角の座標（虚部は上が正）
    /// - `step`：1 ピクセルの幅
    /// - `samples`：1 ピクセルを一辺 `samples` 個に分けて平均する（アンチエイリアス。1 で無効）
    pub fn render(
        &mut self,
        re_min: f64,
        im_max: f64,
        step: f64,
        max_iter: u32,
        scheme: u32,
        samples: u32,
    ) {
        if scheme != self.scheme {
            self.palette = build_palette(scheme);
            self.scheme = scheme;
        }
        let samples = samples.clamp(1, MAX_SAMPLES);
        let sub_step = step / f64::from(samples);
        // 周期検出のしきい値は、サブピクセルの幅より十分小さくする
        let period_epsilon = (sub_step * 1e-3).min(1e-10);

        for py in 0..TILE_SIZE {
            let row = &mut self.pixels[py * TILE_SIZE..(py + 1) * TILE_SIZE];
            for (px, out) in row.iter_mut().enumerate() {
                if samples == 1 {
                    let cr = re_min + (px as f64 + 0.5) * step;
                    let ci = im_max - (py as f64 + 0.5) * step;
                    *out = color(
                        &self.palette,
                        smooth_escape_time(cr, ci, max_iter, period_epsilon),
                    );
                    continue;
                }
                let (mut r, mut g, mut b) = (0_u32, 0_u32, 0_u32);
                for sy in 0..samples {
                    let ci = im_max - (py as f64 * step) - (f64::from(sy) + 0.5) * sub_step;
                    for sx in 0..samples {
                        let cr = re_min + (px as f64 * step) + (f64::from(sx) + 0.5) * sub_step;
                        let c = color(
                            &self.palette,
                            smooth_escape_time(cr, ci, max_iter, period_epsilon),
                        )
                        .to_le_bytes();
                        r += u32::from(c[0]);
                        g += u32::from(c[1]);
                        b += u32::from(c[2]);
                    }
                }
                let n = samples * samples;
                *out = palette::rgba((r / n) as u8, (g / n) as u8, (b / n) as u8);
            }
        }
    }
}

#[inline]
fn color(palette: &[u32], escape_time: Option<f64>) -> u32 {
    match escape_time {
        Some(t) => palette[palette_index(t)],
        None => INTERIOR_COLOR,
    }
}

// ---- WebAssembly から export する関数 ----

/// タイルの一辺のピクセル数を返す。
#[unsafe(no_mangle)]
pub extern "C" fn tile_size() -> u32 {
    TILE_SIZE as u32
}

/// レンダラーを作り、そのアドレスを返す（解放はしない。Worker の寿命と同じだけ使う）。
#[unsafe(no_mangle)]
pub extern "C" fn renderer_new() -> *mut Renderer {
    Box::into_raw(Box::new(Renderer::new()))
}

/// ピクセル列（RGBA、`TILE_SIZE * TILE_SIZE * 4` バイト）の先頭アドレスを返す。
///
/// # Safety
///
/// `renderer` は `renderer_new()` が返したアドレスであること。
#[unsafe(no_mangle)]
pub unsafe extern "C" fn renderer_pixels(renderer: *const Renderer) -> *const u32 {
    unsafe { (*renderer).pixels().as_ptr() }
}

/// タイルを計算する。引数は [`Renderer::render`] を参照。
///
/// # Safety
///
/// `renderer` は `renderer_new()` が返したアドレスであること。
#[unsafe(no_mangle)]
pub unsafe extern "C" fn renderer_render(
    renderer: *mut Renderer,
    re_min: f64,
    im_max: f64,
    step: f64,
    max_iter: u32,
    scheme: u32,
    samples: u32,
) {
    unsafe { (*renderer).render(re_min, im_max, step, max_iter, scheme, samples) }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 全体（実部 -2〜2、虚部 -2〜2）を 1 枚のタイルに描く
    fn render_whole_set(samples: u32) -> Renderer {
        let mut r = Renderer::new();
        r.render(-2.0, 2.0, 4.0 / TILE_SIZE as f64, 256, 0, samples);
        r
    }

    fn pixel(r: &Renderer, x: f64, y: f64) -> u32 {
        let px = ((x + 2.0) / 4.0 * TILE_SIZE as f64) as usize;
        let py = ((2.0 - y) / 4.0 * TILE_SIZE as f64) as usize;
        r.pixels()[py * TILE_SIZE + px]
    }

    #[test]
    fn interior_is_black_and_exterior_is_colored() {
        let r = render_whole_set(1);
        assert_eq!(pixel(&r, -0.2, 0.0), INTERIOR_COLOR);
        assert_eq!(pixel(&r, -1.0, 0.0), INTERIOR_COLOR);
        assert_ne!(pixel(&r, 1.5, 1.5), INTERIOR_COLOR);
    }

    #[test]
    fn image_is_symmetric_about_the_real_axis() {
        let r = render_whole_set(1);
        let p = r.pixels();
        for py in 0..TILE_SIZE / 2 {
            for px in 0..TILE_SIZE {
                let mirror = TILE_SIZE - 1 - py;
                assert_eq!(p[py * TILE_SIZE + px], p[mirror * TILE_SIZE + px]);
            }
        }
    }

    #[test]
    fn all_pixels_are_opaque() {
        let r = render_whole_set(2);
        assert!(r.pixels().iter().all(|c| c >> 24 == 0xff));
    }

    #[test]
    fn changing_scheme_changes_colors() {
        let mut r = Renderer::new();
        r.render(-2.0, 2.0, 4.0 / TILE_SIZE as f64, 256, 0, 1);
        let classic = r.pixels().to_vec();
        r.render(-2.0, 2.0, 4.0 / TILE_SIZE as f64, 256, 1, 1);
        assert_ne!(classic, r.pixels());
    }
}
