# ---- WebAssembly（Rust）のビルド ----
FROM rust:1.99.1-slim AS wasm-builder
WORKDIR /app/wasm
# rust-toolchain.toml を先に置き、ターゲット（wasm32-unknown-unknown）を入れる
COPY wasm/rust-toolchain.toml ./
RUN rustup toolchain install
COPY wasm/ ./
RUN cargo build --release --target wasm32-unknown-unknown

# ---- フロントエンドのビルド ----
FROM node:26-slim AS web-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY --from=wasm-builder /app/wasm/target/wasm32-unknown-unknown/release/mandelbrot.wasm ./src/generated/mandelbrot.wasm
RUN npm run build:web

# ---- 配信（nginx） ----
FROM nginx:1.29-alpine
# 待ち受けるポート。Render は PORT を環境変数で渡す
ENV PORT=8080
# templates/*.template は起動時に環境変数を埋め込んで conf.d/ に置かれる
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=web-builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
