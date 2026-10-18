# CLAUDE.md

マンデルブロ集合を地図アプリのように探索できる Web アプリ。計算は Rust（WebAssembly）、画面は TypeScript で、サーバーサイドを持たない。詳細は [README.md](README.md) を参照。

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

## Terraform

- `modules/app/`：リソースの本体（全環境で共通のモジュール）。S3 バケット（アプリの静的ファイル）と CloudFront（OAC）
- `environments/{dev,stg,prod}/`：環境ごとのルートモジュール。`modules/app` を `environment` を変えて呼び出すだけにする
- Terraform のバージョンは `.terraform-version`、AWS プロバイダーのバージョンは各環境の `.terraform.lock.hcl` で固定している
- state は S3 バックエンド（`backend.hcl` で環境ごとにキーを分ける）
- コミット前に `terraform fmt -recursive` をかける。
- PR では、ジョブの成功に加えて「Terraform Plan (dev/stg/prod)」のコメントを読み、差分が意図どおりであることを確認する（`gh pr view <PR番号> --comments`）。コメントは環境ごとに 1 つで、push のたびに更新される。

### ローカル開発

```bash
cd ./environments/dev/
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
# -> 各種値を設定

terraform init -backend-config=backend.hcl
terraform plan
```

- `backend.hcl`・`*.tfvars`・`.terraform/`・`*.tfstate` は git 管理しない（`.gitignore` 済み）。中身をコミットや PR・Issue に書かない。
- **`terraform apply` はローカルで実行しない。** 反映は CD に任せる。
- AWS の認証情報が必要な操作（`init`・`plan`）は、ユーザーの環境に認証情報があるときだけ行う。ないときは CI の plan コメントで確認する。

### 検証コマンド

```bash
terraform fmt -check -recursive

# 各環境で（バックエンドなしで構文・型を確認する）
cd ./environments/<環境>/
terraform init -backend=false
terraform validate
```

- 3 環境（dev / stg / prod）すべてで `validate` を通す。環境ごとのファイル（`variables.tf` など）に差がないかも確認する。
- AWS プロバイダーは 1 プラットフォームで数百 MB ある。リポジトリ内で `init` せず、scratchpad などへのコピーで行い、終わったら消す（`TF_PLUGIN_CACHE_DIR` を使うと 3 環境で共有できる）。
- プロバイダーを更新したら、ロックファイルに 3 プラットフォームのハッシュを入れる。3 環境のロックファイルは同じ内容になる。
  ```bash
  terraform providers lock -platform=linux_amd64 -platform=linux_arm64 -platform=darwin_arm64
  ```

### CI

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `ci.yml` | すべての PR | `terraform fmt -check -recursive` と、各環境での `terraform validate` のあと、dev・stg・prod それぞれで `terraform plan` を実行し、結果を PR にコメントする。plan が失敗したらジョブも失敗する（Dependabot の PR では plan しない） |

- AWS への認証は OIDC（シークレット `AWS_ROLE_ARN`、変数 `AWS_REGION`）。秘密でない値はシークレットにしない（ログ内の同じ文字列がすべて `***` に伏せられる）。このリポジトリは immutable subject（`repo:osawa-koki@<ID>/mandelbrot-explorer-map@<ID>:...`）が有効で、ロール `GitHubOIDCRole` の信頼ポリシーはこの形式だけを許可している。`backend.hcl` と `terraform.tfvars` は GitHub の Environment（dev / stg / prod）のシークレット `BACKEND_HCL` / `TF_VARS` から作る。
- GitHub Actions の式（`if:` の `==`）の文字列比較は大文字・小文字を区別しない。完全一致が必要な比較は、環境変数で渡してシェルで行う。

### 設計上の約束ごと

- **環境の差分**：環境ごとの違いは `environments/<環境>/main.tf` から `modules/app` に渡す変数だけにする。リソースは `modules/app` に書き、3 環境のファイル構成をそろえる。
- **環境名**：`dev` / `stg` / `prod` のみ（`modules/app/variables.tf` の `validation` で制限）。
- **state のキー**：`mandelbrot-explorer-map/terraform.<環境>.tfstate`（バケット `osawa-koki-tfstate`）。ロックは S3 のネイティブロック（`providers.tf` の `use_lockfile = true`）。DynamoDB は使わない。
- **タグ**：`Project` / `Environment` / `ManagedBy` は各環境の `providers.tf` の `default_tags` で付ける。リソースには `Name = "${local.name_prefix}-<種類>"` を付ける。
- **配信のバケット**：非公開（パブリックアクセスブロック、`BucketOwnerEnforced`）・暗号化（SSE-S3）。読み取りは CloudFront の OAC だけに許可する（バケットポリシーの `AWS:SourceArn` で配信を限定）。
- **キャッシュ**：CloudFront は `Managed-CachingOptimized` で、オブジェクトの `Cache-Control` に従う。
- **既存リソースの置き換えに注意**：リソース名の変更や、置き換えが起きる属性（バケット名など）の変更は、plan で `destroy` が出ないか確認する。リソース名を変えるときは `moved` ブロックを使う。
- **バージョン**：Terraform を上げるときは `.terraform-version` を変える（CI・CD はこのファイルを読む）。`.terraform-version` は末尾に改行を入れない（`.editorconfig`）。
