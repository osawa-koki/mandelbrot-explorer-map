# Mandelbrot Explorer Map

🗺️ マンデルブロ集合を地図アプリのように探索できる Web アプリ。

[osawa-koki/mandelbrot-map](https://github.com/osawa-koki/mandelbrot-map) をもとに、サーバーサイドを持たずブラウザだけで完結する形に作り直したもの。計算は Rust で書いて WebAssembly にコンパイルし、Web Worker で並列に実行する。
