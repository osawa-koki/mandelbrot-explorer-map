#!/usr/bin/env bash
# 配信しているサーバー（nginx のコンテナなど）の応答を確かめる
# 使い方: ./scripts/check-server.sh http://localhost:8080
set -euo pipefail

base="${1:?base URL is required}"
fail() {
  echo "::error::$*"
  exit 1
}

# ヘルスチェック
[[ "$(curl -fsS "$base/healthz")" == "ok" ]] || fail "/healthz did not return ok"

# トップページ：index.html を返し、キャッシュさせない
headers=$(curl -fsS -D - -o /tmp/index.html "$base/")
grep -q "<title>Mandelbrot Explorer Map</title>" /tmp/index.html || fail "/ did not return index.html"
grep -qi "^cache-control: no-cache" <<<"$headers" || fail "/ should have Cache-Control: no-cache"
grep -qi "^content-security-policy:.*wasm-unsafe-eval" <<<"$headers" || fail "/ should have the CSP header"

# WebAssembly：application/wasm で返し、ずっとキャッシュさせる
wasm_path=$(curl -fsS "$base/" | grep -o 'assets/index-[^"]*\.js' | head -n 1)
[[ -n "$wasm_path" ]] || fail "could not find the main script in index.html"
worker_path=$(curl -fsS "$base/$wasm_path" | grep -o 'render\.worker-[^"]*\.js' | head -n 1)
[[ -n "$worker_path" ]] || fail "could not find the worker script"
wasm_file=$(curl -fsS "$base/assets/$worker_path" | grep -o 'mandelbrot-[^"]*\.wasm' | head -n 1)
[[ -n "$wasm_file" ]] || fail "could not find the wasm file"
headers=$(curl -fsS -D - -o /dev/null -H "Accept-Encoding: gzip" "$base/assets/$wasm_file")
grep -qi "^content-type: application/wasm" <<<"$headers" || fail "wasm should be served as application/wasm"
grep -qi "^cache-control: public, max-age=31536000, immutable" <<<"$headers" || fail "assets should be immutable"
grep -qi "^content-encoding: gzip" <<<"$headers" || fail "wasm should be gzipped"

# 存在しないパスは 404
[[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/no-such-file")" == "404" ]] || fail "unknown paths should return 404"

echo "All checks passed."
