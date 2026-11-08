# 開発

Node.js 22（CIと同じバージョン）と pnpm 12.14.0 を使用します。

```bash
pnpm install
cp wrangler.sample.jsonc wrangler.jsonc # 環境固有の設定を手元に作成
cp .dev.vars.example .dev.vars       # ADMIN_TOKEN などを設定
pnpm run db:migrate:local             # ローカル D1 に migration
pnpm run dev                          # http://localhost:5173
```

`wrangler.sample.jsonc` を Git 管理し、環境固有の `wrangler.jsonc` は管理しません。サンプルの D1 ID はローカル開発用のダミーです。本番へデプロイする前に、作成した D1 の `database_id` を手元の `wrangler.jsonc` に設定してください。`DB` と `dadada` は同じ D1 を参照するため、両方に同じ ID を設定します。共通設定（バインディング・Cron など）を変更した場合はサンプルにも反映します。トークンは `.dev.vars` または Cloudflare の Secrets に設定します。すでに手元に設定がある場合、サンプルのコピーで上書きしないでください。

初回はDBが空のため、開発サーバーを起動したまま別のターミナルから手動収集を実行してください。`.dev.vars` はWorker用の設定ファイルで、シェルの環境変数には自動で読み込まれません。以下の `ADMIN_TOKEN` には `.dev.vars` に設定した値を指定します。

```bash
export ADMIN_TOKEN='設定したトークン'

# 全Sourceを収集
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect"

# グループを指定して収集
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect?group=status"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect?group=security"
```

`ADMIN_TOKEN` が未設定、または認証ヘッダーが一致しない場合、手動収集APIは404を返します。収集レスポンスの `results` にSourceごとの成功・失敗を返すため、HTTPステータスだけでなく `ok` / `error` も確認してください。

開発サーバーのポートは5173に固定しています。使用中の場合は起動を停止するため、既存の開発サーバーを終了してから起動してください。

`jq` が `Invalid numeric literal` を返す場合は、JSON以外のエラーページが返っている可能性があります。`curl -sS -i http://localhost:5173/api/health` でHTTPステータスを確認してください。開発サーバーが `fetch failed` のHTMLを返している場合は、実行中の `pnpm run dev` をCtrl+Cで終了し、起動し直してください。

```bash
pnpm test          # vitest (Adapter 単体 + ローカル D1 を使った収集〜集約の結合テスト)
pnpm run typecheck
pnpm run build
```

## E2E テスト

[Playwright](https://playwright.dev/) で本番ビルド（Worker + 静的アセット）を `vite preview` で起動し、シード済みのローカル D1 に対してブラウザと HTTP API を検証します。外部フィードには接続しません。

```bash
pnpm exec playwright install chromium  # 初回のみ
pnpm run test:e2e
```

- テストケース一覧: [`e2e/TEST_CASES.md`](../e2e/TEST_CASES.md)
- シードデータ: [`e2e/fixtures/seed.sql`](../e2e/fixtures/seed.sql)（時刻は投入時点からの相対値）
- 毎回 `.wrangler/e2e-state` を作り直すため、開発用のローカル D1（`.wrangler/state`）には影響しません
- ポート4173を使います。`wrangler.jsonc` が必要です（`wrangler.sample.jsonc` をコピー）

## コミット前のチェック

`pnpm install` の `prepare` で [Husky](https://typicode.github.io/husky/) を設定します。コミット時は `.husky/pre-commit` から次のチェックを順番に実行し、失敗した場合はコミットを停止します。

1. Biome による lint（警告もエラー扱い）
2. Biome によるフォーマット確認
3. TypeScript 型チェック
4. 全テスト
5. 本番ビルド

```bash
pnpm run check        # コミット時・CI と同じ全チェック
pnpm run lint         # lint のみ
pnpm run lint:fix     # 安全に自動修正できる lint を修正
pnpm run format       # 書式を自動修正
pnpm run format:check # 書式の確認のみ
```

コミット時にはファイルを自動修正しません。書式の指摘は `pnpm run format` で修正してから、変更をステージし直してください。チェック対象はプロジェクト全体の Biome 対応ファイル（ソース・テスト・設定など）で、外部フィードの fixture と生成物は除外します。README / YAML / SQL は Biome の対象外です。既存コードの非 null アサーションは許可しています。
CI は Git フックの登録を省略し、同じ `pnpm run check` を直接実行します。
