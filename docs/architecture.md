# 構成と実装方針

```text
src/
├─ shared/                  API レスポンス型・セキュリティの言語定義 (Worker / Web 共有)
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
   ├─ lib/                  API 取得 / ルーティング / 日英翻訳 / 日時整形
   └─ features/             happening-now / services / security / provider-detail
public/                     ロゴ / favicon（Vite の静的アセット）
migrations/                 D1 schema
tests/                      vitest + fixtures
e2e/                        Playwright E2E + シード SQL + テストケース一覧
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

- Severity は上流が提供する値を使用し、重要度のない告知に独自の重要度を付けない
- Incident ID: externalId があれば `source:externalId`、なければ SHA-256 fingerprint
- raw payload は必ず `raw_json` に保存
- 日時は内部 UTC、表示時にローカルタイム
- Runtime / Library には Current Status を付けない
