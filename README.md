# DaDaDa

What's breaking now?

Developer が使っている Cloud / SaaS / Runtime / OSS の **現在状態・発生中の障害・Security Advisory** を 1 画面で確認する Developer Status / Security Radar。
自分で監視はせず、公開 Status Page / Security Feed を **Collect → Normalize → Browse** する。

## Stack

- Cloudflare Workers + Hono (API / Cron)
- Cloudflare D1
- React + Vite (`@cloudflare/vite-plugin` で Worker と SPA を 1 プロジェクトに)
- Vanilla CSS

## 初期 Source (8)

| 種別 | Source | 取得方法 |
| --- | --- | --- |
| Status | Cloudflare / GitHub / Vercel | Statuspage API (`StatuspageAdapter`) |
| Status | Google Cloud | `status.cloud.google.com/incidents.json` |
| Security | PHP | php.net Atom (security release のみ) |
| Security | Node.js | Vulnerability RSS |
| Security | GitHub Advisory | REST API (reviewed / critical) |
| Security | CISA KEV | JSON feed (直近 30 日の追加分) |

## 開発

```bash
npm install
cp .dev.vars.example .dev.vars       # ADMIN_TOKEN などを設定
npm run db:migrate:local             # ローカル D1 に migration
npm run dev                          # http://localhost:5173

# 手動で収集を走らせる (ADMIN_TOKEN 設定時のみ有効)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect?group=status"
```

```bash
npm test          # vitest (Adapter 単体 + ローカル D1 を使った収集〜集約の結合テスト)
npm run typecheck
npm run build
```

## デプロイ

```bash
npx wrangler d1 create dadada        # 出力された database_id を wrangler.jsonc に設定
npm run db:migrate:remote
npx wrangler secret put GITHUB_TOKEN # 任意 (Advisory API のレート制限緩和)
npm run deploy
```

Cron (`wrangler.jsonc` / `src/worker/collectors/schedule.ts`):

- `*/5 * * * *` → Status Source
- `*/30 * * * *` → Security Source

## API

| Method | Path | 内容 |
| --- | --- | --- |
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/summary` | トップ画面用の集約 (Happening Now / Services / Security / KEV) |
| GET | `/api/status?category=&status=` | Provider Status 一覧 |
| GET | `/api/incidents?kind=&provider=&ecosystem=&status=&active=&from=&to=&cursor=&limit=` | Incident 一覧 (cursor pagination) |
| GET | `/api/incidents/:id` | Incident 詳細 (raw 含む) |
| GET | `/api/providers` | Provider 一覧 |
| GET | `/api/providers/:id` | Provider 詳細 (Status / Active / History / Security) |
| POST | `/api/webhooks/:source` | Push 型 Source 用 (MVP ではハンドラ未登録) |
| POST | `/api/admin/collect?group=` | 手動収集 (`ADMIN_TOKEN` 必須) |

## 構成

```text
src/
├─ shared/api.ts            API レスポンス型 (Worker / Web 共有)
├─ worker/
│  ├─ index.ts              Hono app + scheduled
│  ├─ routes/               status / incidents / providers / webhooks / admin
│  ├─ collectors/           collector-runner (Promise.allSettled で Source を独立実行) / cron 対応表
│  ├─ sources/              Source 定義。index.ts に登録するだけで追加できる
│  ├─ adapters/             statuspage / rss / atom / json / webhook の共通 Adapter
│  ├─ domain/               Provider / ProviderStatus / Incident / fingerprint
│  ├─ repositories/         D1 アクセス
│  └─ services/             API 用の集約
└─ web/
   ├─ App.tsx               `/` と `/d/:providerId`
   ├─ components/
   └─ features/             happening-now / services / security / provider-detail
migrations/                 D1 schema
tests/                      vitest + fixtures
```

## Source の追加

Statuspage 互換なら 1 ファイルで済む:

```ts
// src/worker/sources/netlify/index.ts
export const netlifyStatus = new StatuspageAdapter({
  provider: {
    id: 'netlify',
    name: 'Netlify',
    category: 'developer',
    homepageUrl: 'https://www.netlify.com',
    statusUrl: 'https://www.netlifystatus.com',
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: 'https://www.netlifystatus.com',
})
```

`src/worker/sources/index.ts` の `sources` に足せば、Provider 登録・収集・表示まで自動で入る。

## 方針メモ

- Severity は上流の値をそのまま保持・表示する (独自判定しない)
- Incident ID: externalId があれば `source:externalId`、なければ SHA-256 fingerprint
- raw payload は必ず `raw_json` に保存
- 日時は内部 UTC、表示時にローカルタイム
- Runtime / Library には Current Status を付けない
