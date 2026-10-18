import { defineConfig } from "vitest/config";

export default defineConfig({
  // 相対パスにして、GitHub Pages のサブパス（/mandelbrot-explorer-map/）でも nginx のルートでも動くようにする
  base: "./",
  build: {
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  test: {
    environment: "node",
  },
});
