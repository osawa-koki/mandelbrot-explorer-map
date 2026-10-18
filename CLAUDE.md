# CLAUDE.md

マンデルブロ集合を地図アプリのように探索できる Web アプリ。計算は Rust（WebAssembly）、画面は TypeScript で、サーバーサイドを持たない。詳細は [README.md](README.md) を参照。

- `wasm/`：タイルを計算する Rust のクレート（`cdylib` で WebAssembly に、`rlib` でネイティブのテストに使う）
- `frontend/`：TypeScript / Vite の画面。`npm run build:wasm` が `wasm/` をビルドして `frontend/src/generated/mandelbrot.wasm`（git 管理しない）にコピーする
- Rust のバージョンは `wasm/rust-toolchain.toml`、Node.js のバージョンは `frontend/.node-version` で固定している

## 開発フロー

作業は必ず **Issue → ブランチ → PR → CI → マージ** の順で進める。小さな修正でも同じ。

1. **Issue を作る**
   - `gh issue create --assignee osawa-koki --title "..." --body-file -`
   - 本文に「概要」と「TODO」（チェックリスト）を書く。
2. **Issue に紐づくブランチを作る**
   - `gh issue develop <番号> --name issues/<番号> --base main`
   - `git fetch origin issues/<番号> && git switch -c issues/<番号> --track origin/issues/<番号>`
   - ブランチ名は `issues/<番号>`。`git switch -c` だけでローカルに作らない（Issue の Development 欄に紐づかないため）。
3. **実装してコミットする**
   - コミットメッセージは「英語の件名＋日本語の本文」。最後のコミットの本文に `Close #<番号>`、途中のコミットには `Refs #<番号>` を入れる。
4. **PR を作る**
   - `gh pr create --assignee osawa-koki --base main --head issues/<番号> --title "..." --body-file -`
   - **Assignees には必ず `osawa-koki` を設定する。**
   - 本文の先頭に `Close #<番号>` を書く（コメントに書いても Issue は自動クローズされない）。
   - 本文は日本語で、「概要」「変更内容」「確認したこと」（実際に確認した内容のチェックリスト）を書く。
5. **CI を確認する**
   - `gh pr checks <PR番号> --watch` で、すべてのジョブの成功を確認する。
6. **マージする**
   - マージは、ユーザーに指示されたときだけ行う。
   - `gh pr merge <PR番号> --merge`（マージコミット）。ブランチは消さない。

PR は役割ごとに分ける。前の PR に依存する場合は、マージ後の `main` から次のブランチを切る。

## ローカル開発

```bash
cd ./frontend/
npm ci
npm run dev   # http://localhost:3000
```

- Rust（rustup）と Node.js が必要。`wasm/` で cargo を実行すると、rustup が `rust-toolchain.toml` のバージョンと `wasm32-unknown-unknown` ターゲットを入れる。

## 検証コマンド

```bash
# Rust（wasm/ で）
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test

# フロントエンド（frontend/ で）
npm run typecheck
npm test
npm run build
```

- 画面の変更は、`npm run build && npx vite preview` で開いて、実際に描画・操作できることを確かめる（タイルの計算は Worker で動くので、ユニットテストだけでは分からない）。

## CI（GitHub Actions）

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `app-ci.yml` | すべての PR | Rust の fmt・clippy・test と、フロントエンドの型チェック・テスト・ビルド |

- ワークフローを変えたら actionlint で確認する（`docker run --rm -v "$PWD:/repo:ro" -w /repo rhysd/actionlint:1.7.7 -no-color`）。

## 設計上の約束ごと

- **サーバーサイドを持たない**：計算はすべてブラウザ（WebAssembly + Web Worker）で行う。配信するのは静的ファイルだけ。
- **Rust と TypeScript で合わせる値**：
  - カラースキームの並び順（`wasm/src/palette.rs` の `SCHEMES` と `frontend/src/settings.ts` の `COLOR_SCHEMES`）。番号で渡すので、追加するときは両方の末尾に足す。
  - タイルの一辺（`wasm/src/lib.rs` の `TILE_SIZE` と `frontend/src/viewport.ts` の `TILE_SIZE`）。
- **WebAssembly の境界**：wasm-bindgen は使わず、`extern "C"` の関数と線形メモリの読み出しだけでやり取りする。export を変えたら `frontend/src/wasm.ts` の型も直す。
- **座標と精度**：タイルの座標は整数（レベル L、`tx`、`ty`）で持ち、キャッシュのキーにする。倍精度浮動小数点数の限界があるので、ズームレベルの上限（`MAX_ZOOM = 42`）は上げない。
