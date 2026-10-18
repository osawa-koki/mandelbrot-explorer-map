# Mandelbrot Explorer Map

🗺️ マンデルブロ集合を地図アプリのように探索できる Web アプリ。

[osawa-koki/mandelbrot-map](https://github.com/osawa-koki/mandelbrot-map) をもとに、サーバーサイドを持たずブラウザだけで完結する形に作り直したもの。計算は Rust で書いて WebAssembly にコンパイルし、Web Worker で並列に実行する。

## インフラ（AWS）

静的ファイルを S3 に置き、CloudFront（OAC）で配信する。Terraform で管理する。

| ディレクトリ | 役割 |
|---|---|
| `modules/app/` | リソースの本体（S3 バケット、CloudFront、バケットポリシー） |
| `environments/{dev,stg,prod}/` | 環境ごとのルートモジュール（`modules/app` を呼ぶだけ） |

```bash
cd ./environments/dev/
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# -> 各種値を設定

terraform init -backend-config=backend.hcl
terraform plan
```

PR では、GitHub Actions（`ci.yml`）が fmt・validate と、各環境の `terraform plan` を実行して結果を PR にコメントする。
