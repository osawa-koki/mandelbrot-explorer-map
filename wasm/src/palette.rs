//! カラースキーム（脱出時間 → 色）。

/// パレットの段数。
pub const PALETTE_SIZE: usize = 2048;

/// 集合内の点の色（不透明な黒）。
pub const INTERIOR_COLOR: u32 = rgba(0, 0, 0);

/// パレットを 1 周する速さ。脱出時間の平方根に掛ける（深く拡大して反復回数が増えても色の帯が細かくなりすぎないように）。
const CYCLE_DENSITY: f64 = 0.18;

type Stop = (f64, [u8; 3]);

/// グラデーションの区切り（位置 0〜1 と色）。最後の色から最初の色へ戻って 1 周する。
const CLASSIC: &[Stop] = &[
    (0.0, [0, 7, 100]),
    (0.16, [32, 107, 203]),
    (0.42, [237, 255, 255]),
    (0.6425, [255, 170, 0]),
    (0.8575, [0, 2, 0]),
];
const FIRE: &[Stop] = &[
    (0.0, [10, 0, 0]),
    (0.25, [140, 10, 0]),
    (0.5, [255, 100, 0]),
    (0.72, [255, 220, 60]),
    (0.86, [255, 255, 225]),
];
const OCEAN: &[Stop] = &[
    (0.0, [0, 8, 32]),
    (0.3, [0, 60, 140]),
    (0.55, [0, 170, 210]),
    (0.75, [210, 255, 255]),
    (0.9, [0, 100, 170]),
];
const NEON: &[Stop] = &[
    (0.0, [18, 0, 40]),
    (0.3, [140, 20, 170]),
    (0.55, [255, 80, 170]),
    (0.78, [255, 230, 140]),
    (0.9, [60, 220, 255]),
];
const MONO: &[Stop] = &[(0.0, [8, 8, 8]), (0.5, [245, 245, 245])];

/// カラースキームの一覧。インデックスがフロントエンドから渡す番号になる。
const SCHEMES: &[&[Stop]] = &[CLASSIC, FIRE, OCEAN, NEON, MONO];

/// メモリ上で R, G, B, A の順に並ぶ u32 を作る（WebAssembly はリトルエンディアン）。
pub const fn rgba(r: u8, g: u8, b: u8) -> u32 {
    (r as u32) | ((g as u32) << 8) | ((b as u32) << 16) | (0xff << 24)
}

/// カラースキームの番号から、パレット（`PALETTE_SIZE` 段）を作る。範囲外の番号は 0 番になる。
pub fn build_palette(scheme: u32) -> Vec<u32> {
    let stops = SCHEMES.get(scheme as usize).copied().unwrap_or(CLASSIC);
    (0..PALETTE_SIZE)
        .map(|i| interpolate(stops, i as f64 / PALETTE_SIZE as f64))
        .collect()
}

/// 脱出時間をパレットのインデックスに変換する。
#[inline]
pub fn palette_index(escape_time: f64) -> usize {
    let t = escape_time.max(0.0).sqrt() * CYCLE_DENSITY;
    let frac = t - t.floor();
    ((frac * PALETTE_SIZE as f64) as usize).min(PALETTE_SIZE - 1)
}

fn interpolate(stops: &[Stop], t: f64) -> u32 {
    let n = stops.len();
    let mut idx = n - 1;
    for (i, stop) in stops.iter().enumerate() {
        if stop.0 <= t {
            idx = i;
        }
    }
    let (t0, c0) = stops[idx];
    let (t1, c1) = if idx + 1 < n {
        stops[idx + 1]
    } else {
        (1.0 + stops[0].0, stops[0].1)
    };
    let u = ((t - t0) / (t1 - t0)).clamp(0.0, 1.0);
    // smoothstep で区切りの折れ目を目立たなくする
    let u = u * u * (3.0 - 2.0 * u);
    let mix = |a: u8, b: u8| (f64::from(a) + (f64::from(b) - f64::from(a)) * u).round() as u8;
    rgba(mix(c0[0], c1[0]), mix(c0[1], c1[1]), mix(c0[2], c1[2]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rgba_is_little_endian_bytes() {
        assert_eq!(rgba(1, 2, 3).to_le_bytes(), [1, 2, 3, 255]);
    }

    #[test]
    fn palette_starts_at_first_stop() {
        for (i, stops) in SCHEMES.iter().enumerate() {
            let c = stops[0].1;
            assert_eq!(build_palette(i as u32)[0], rgba(c[0], c[1], c[2]));
        }
    }

    #[test]
    fn palette_wraps_around_smoothly() {
        // 最後の段と最初の段の色がほぼ同じ（1 周してつながる）
        for i in 0..SCHEMES.len() {
            let p = build_palette(i as u32);
            let a = p[PALETTE_SIZE - 1].to_le_bytes();
            let b = p[0].to_le_bytes();
            for ch in 0..3 {
                assert!(a[ch].abs_diff(b[ch]) <= 2, "scheme {i}: {a:?} vs {b:?}");
            }
        }
    }

    #[test]
    fn unknown_scheme_falls_back_to_classic() {
        assert_eq!(build_palette(999), build_palette(0));
    }

    #[test]
    fn palette_index_is_in_range() {
        for t in [0.0, 0.5, 1.0, 10.0, 1234.5, 1e9, -1.0] {
            assert!(palette_index(t) < PALETTE_SIZE);
        }
    }
}
