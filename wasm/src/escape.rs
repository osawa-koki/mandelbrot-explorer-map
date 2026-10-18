//! 脱出時間（エスケープタイム）の計算。

/// 脱出半径の 2 乗。半径を大きくするとスムーズカラーリングの段差が目立たなくなる。
const BAILOUT_SQUARED: f64 = 256.0 * 256.0;

/// 点 c = (cr, ci) の脱出時間を返す。集合に含まれる（と判定した）点は `None`。
///
/// 戻り値は連続値（スムーズカラーリング用の正規化された反復回数）。
/// `period_epsilon` は周期検出のしきい値で、ピクセルの幅より十分小さい値を渡す。
pub fn smooth_escape_time(cr: f64, ci: f64, max_iter: u32, period_epsilon: f64) -> Option<f64> {
    if in_main_cardioid_or_bulb(cr, ci) {
        return None;
    }

    let (mut zr, mut zi) = (0.0_f64, 0.0_f64);
    // 周期検出（Brent 法）：ときどき保存した z に戻ってきたら、周期軌道に入ったとみなす
    let (mut saved_r, mut saved_i) = (0.0_f64, 0.0_f64);
    let mut check_interval = 8_u32;
    let mut steps_since_save = 0_u32;

    for i in 0..max_iter {
        let zr2 = zr * zr;
        let zi2 = zi * zi;
        let norm = zr2 + zi2;
        if norm > BAILOUT_SQUARED {
            // ν = n + 1 − log₂(ln|z|)
            let log_zn = norm.ln() * 0.5;
            let nu = (log_zn / std::f64::consts::LN_2).log2();
            return Some(f64::from(i) + 1.0 - nu);
        }
        zi = 2.0 * zr * zi + ci;
        zr = zr2 - zi2 + cr;

        if (zr - saved_r).abs() < period_epsilon && (zi - saved_i).abs() < period_epsilon {
            return None;
        }
        steps_since_save += 1;
        if steps_since_save == check_interval {
            steps_since_save = 0;
            check_interval = check_interval.saturating_mul(2);
            saved_r = zr;
            saved_i = zi;
        }
    }
    None
}

/// 主カルジオイドと周期 2 の円の内側にある点は、反復せずに集合内と判定できる。
fn in_main_cardioid_or_bulb(cr: f64, ci: f64) -> bool {
    let ci2 = ci * ci;
    let x = cr - 0.25;
    let q = x * x + ci2;
    if q * (q + x) <= 0.25 * ci2 {
        return true;
    }
    (cr + 1.0) * (cr + 1.0) + ci2 <= 0.0625
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPS: f64 = 1e-12;

    #[test]
    fn origin_is_in_the_set() {
        assert_eq!(smooth_escape_time(0.0, 0.0, 1000, EPS), None);
    }

    #[test]
    fn period_two_bulb_is_in_the_set() {
        assert_eq!(smooth_escape_time(-1.0, 0.0, 1000, EPS), None);
    }

    #[test]
    fn points_outside_radius_two_escape_quickly() {
        let t = smooth_escape_time(2.5, 0.0, 1000, EPS).expect("should escape");
        assert!(t < 5.0, "t = {t}");
    }

    #[test]
    fn interior_point_outside_cardioid_is_detected_by_periodicity() {
        // 周期 3 の成分（カルジオイド・周期 2 の円の外側）の中心付近
        assert_eq!(smooth_escape_time(-0.1226, 0.7449, 100_000, EPS), None);
    }

    #[test]
    fn escape_time_increases_near_the_boundary() {
        let far = smooth_escape_time(-0.75, 0.5, 10_000, EPS).expect("escapes");
        let near = smooth_escape_time(-0.75, 0.05, 10_000, EPS).expect("escapes");
        assert!(near > far, "near = {near}, far = {far}");
    }

    #[test]
    fn smooth_value_is_continuous_across_iteration_bands() {
        // 隣り合う点の値の差が小さい（帯の境目で 1 も飛ばない）
        let step = 1e-4;
        let mut prev = smooth_escape_time(-2.0, 0.3, 1000, EPS).unwrap();
        let mut x = -2.0;
        while x < -1.9 {
            x += step;
            let t = smooth_escape_time(x, 0.3, 1000, EPS).unwrap();
            assert!((t - prev).abs() < 0.5, "jump at x = {x}: {prev} -> {t}");
            prev = t;
        }
    }

    #[test]
    fn respects_max_iter() {
        // 境界のすぐ外側の点は、反復回数が足りなければ集合内扱いになる
        let c = (-0.75, 0.001);
        assert_eq!(smooth_escape_time(c.0, c.1, 10, EPS), None);
        assert!(smooth_escape_time(c.0, c.1, 100_000, EPS).is_some());
    }
}
