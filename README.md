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

パッケージ管理には pnpm 12.14.0 を使用します。

```bash
pnpm install
cp .dev.vars.example .dev.vars       # ADMIN_TOKEN などを設定
pnpm run db:migrate:local             # ローカル D1 に migration
pnpm run dev                          # http://localhost:5173

# 手動で収集を走らせる (ADMIN_TOKEN 設定時のみ有効)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:5173/api/admin/collect?group=status"
```

```bash
pnpm test          # vitest (Adapter 単体 + ローカル D1 を使った収集〜集約の結合テスト)
pnpm run typecheck
pnpm run build
```

## 依存関係の安全性

`pnpm-workspace.yaml` で以下を適用します。

- 公開から7日（10080分）未満のバージョンを禁止。間接依存・ロック済み依存も検査し、公開日時不明の場合も停止します。例外は設定していません。
- 過去のリリースより公開元の信頼性が低下したバージョンを拒否し、間接依存の Git / 外部 tarball 取得を制限します。信頼性チェックのみ、公開後365日以上の旧版は対象外にします（古い型定義などと現在の署名方式の差による誤検知を避けるため）。7日ルールと脆弱性監査は旧版にも適用します。
- インストールスクリプトは `esbuild` と `workerd` のみ許可し、新しい未承認スクリプトがあれば停止します。
- 今後追加する依存は完全なバージョン番号で保存し、peer dependency の不整合をエラーにします。
- `pnpm install` の `postinstall` で開発用・間接依存を含め `pnpm audit` を実行し、low 以上の既知の脆弱性があれば失敗します。依存に変更がない再インストールでも監査を実行します。監査サービスへの接続失敗も無視しません。
- GitHub Actions で push / PR / 毎日（日本時間09:23）にインストール・監査・型チェック・テスト・ビルドを実行します。定期実行はワークフローがデフォルトブランチに反映された後に有効です。

```bash
pnpm run security:audit # 現在の依存の既知の脆弱性を再確認
```

監査はレジストリに登録された既知のセキュリティ問題が対象です。一般的な不具合や GitHub Issue、未報告の問題まで自動的に確認するものではありません。7日経過は安全性の保証ではないため、更新時にはリリースノートも確認してください。
`--ignore-scripts` はインストール時の監査も省略するため、通常のインストールでは使用しません。CI はロックファイルを固定して検査します。

設定の仕様: [pnpm の依存解決設定](https://pnpm.io/settings/dependency-resolution)、[ビルド許可設定](https://pnpm.io/settings/build)、[pnpm audit](https://pnpm.io/cli/audit)。

## デプロイ

```bash
pnpm exec wrangler d1 create dadada        # 出力された database_id を wrangler.jsonc に設定
pnpm run db:migrate:remote
pnpm exec wrangler secret put GITHUB_TOKEN # 任意 (Advisory API のレート制限緩和)
pnpm run deploy
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
