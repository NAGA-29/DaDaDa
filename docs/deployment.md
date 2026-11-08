# デプロイ

```bash
pnpm exec wrangler d1 create dadada        # 出力された database_id を wrangler.jsonc に設定
pnpm run db:migrate:remote
pnpm exec wrangler secret put GITHUB_TOKEN # 任意 (Advisory API のレート制限緩和)
pnpm exec wrangler secret put ADMIN_TOKEN  # 任意 (本番で手動収集を使う場合)
pnpm run deploy
```

画面と API は同じ Worker に公開します。通常は必ず `pnpm run deploy` を使用してください。このコマンドは Vite で画面と Worker をビルドし、生成された設定で `dist/client` の HTML・JS・画像も一緒にアップロードします。Worker のコードだけをアップロードすると、API は動いてもトップページが `{"error":"not found"}` になる場合があります。公開後は `/` が HTML、`/api/health` が JSON を返すことを確認してください。

Cron (`wrangler.jsonc` / `src/worker/collectors/schedule.ts`):

- `*/5 * * * *` → Status Source
- `*/30 * * * *` → Security Source
