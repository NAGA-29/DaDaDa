# DaDaDa — AI実装指示書 / MVP設計書

## 1. プロジェクト概要

### 1.1 プロジェクト名

**DaDaDa**

### 1.2 コンセプト

DaDaDaは、開発者が利用しているクラウドサービス、開発プラットフォーム、Runtime、OSS、Security Advisoryなどの状態を、1画面で素早く確認するためのDeveloper Status / Security Radarである。

狙いは以下。

> **Is anything I build with breaking or vulnerable right now?**

単なるStatus Page Aggregatorではなく、

- SaaS / Cloud / Developer Toolの現在状態
- 発生中のサービス障害
- Runtime / OSS / Security Advisory
- CVE / CISA KEVなどの脆弱性情報

を同じ場所で確認できることを目指す。

## 2. 参考にする体験

### Upstream Status

参考にする点:

- 開いた瞬間に現在問題があるサービスが分かる
- 多数Providerの現在状態を一覧できる
- Cloud / Developer / AIなどカテゴリで整理されている
- 余計な操作なしで「今どうなっているか」を確認できる

DaDaDaではこの「現在状態の一覧性」を取り入れる。

### UptimeRobot

参考にする点:

- 状態が非常に分かりやすい
- Current Status → Incident → History の階層が明確
- 詳細へ掘れるが、トップ画面は単純

ただし、DaDaDa自身がURL監視・Ping・SSL監視などを行うことは目的としない。

## 3. DaDaDaの立ち位置

```text
Upstream Status
    ↓
外部SaaS / Platformの現在状態

UptimeRobot
    ↓
自分のInfrastructureの監視

DaDaDa
    ↓
Developer Stackの状態 + Security情報
```

DaDaDaでは、

```text
Service Status
+
Service Incident
+
Security Advisory
+
CVE / KEV
```

を同じTimeline / Dashboardへ統合する。

## 4. MVPの目的

MVPでは以下に集中する。

1. Developerがよく使うProviderの現在状態を確認できる
2. 現在発生中のIncidentを確認できる
3. Runtime / OSS / Security Advisoryを確認できる
4. 各Providerの履歴を確認できる
5. Source追加が容易な構造にする
6. Cloudflare Workers上で軽量に運用する

## 5. MVPでやらないこと

- AIによる重要度判定
- Slack通知
- Email通知
- PagerDuty連携
- User Account
- Team管理
- SLA計測
- 独自Ping監視
- URL監視
- SSL expiration監視
- Cron監視
- AI要約
- 全世界のCVE収集
- 大規模検索
- 独自Reliability Score

まずは「見る場所」を作る。

## 6. 技術スタック

### Backend / Worker

- TypeScript
- Cloudflare Workers
- Hono
- Cloudflare D1
- Cloudflare Cron Triggers
- Wrangler

### Frontend

- React
- Vite
- TypeScript

### Styling

MVPでは過剰なUI Framework導入を避ける。

候補:

- Tailwind CSS
- CSS Modules
- Vanilla CSS

デザインは軽量で、Status情報が読みやすいことを優先する。

## 7. システム構成

```text
                           Internet
                              │
             ┌────────────────┼─────────────────┐
             │                │                 │
             ▼                ▼                 ▼
       Status Sources   Security Sources    Webhooks
             │                │                 │
             └─────────┬──────┴──────────┬──────┘
                       │                 │
                       ▼                 ▼
                Source Adapters     Push Handlers
                       │                 │
                       └────────┬────────┘
                                ▼
                            Normalize
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
        ProviderStatus                        Incident
               │                                 │
               └────────────────┬────────────────┘
                                ▼
                               D1
                                │
                                ▼
                             Hono API
                                │
                                ▼
                          React / Vite
                                │
                                ▼
                              DaDaDa
```

## 8. DaDaDaの3本柱

### 8.1 Happening Now

現在発生中の情報のみを表示する。

サービス障害とSecurity Advisoryを混在させる。

```text
HAPPENING NOW

Cloudflare
Workers - Partial outage
18 min ago

GitHub
Actions - Degraded performance
42 min ago

PHP
Critical security release
2 hours ago
```

「今、何か起きているか？」を最短で確認できる場所。

### 8.2 Services

Providerの現在状態を一覧する。

```text
Cloud & Infrastructure

AWS          Operational
Cloudflare   Partial Outage
Google Cloud Operational
Vercel       Operational

Developer Tools

GitHub       Degraded
npm          Operational
Netlify      Operational

AI

OpenAI       Operational
Anthropic    Operational
```

Providerはカテゴリごとに整理する。

### 8.3 Security

Developer向けSecurity情報を一覧する。

```text
PHP
Critical security release
2h ago

Node.js
Security release
1d ago

OpenSSL
High severity advisory
2d ago
```

Status Aggregatorとの差別化要素にする。

## 9. Provider分類

```ts
export type ProviderCategory =
  | 'cloud'
  | 'developer'
  | 'database'
  | 'ai'
  | 'security'
  | 'communication'
  | 'payment'
  | 'runtime'
  | 'other'
```

## 10. Providerモデル

```ts
export type Provider = {
  id: string
  name: string
  category: ProviderCategory
  homepageUrl: string
  statusUrl?: string
  iconUrl?: string
  supportsStatus: boolean
  supportsSecurity: boolean
}
```

## 11. Provider Statusモデル

```ts
export type ProviderStatusValue =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown'

export type ProviderStatus = {
  providerId: string
  status: ProviderStatusValue
  message?: string
  checkedAt: string
}
```

## 12. Incidentモデル

```ts
export type IncidentKind =
  | 'service'
  | 'security'

export type Incident = {
  id: string
  providerId?: string
  kind: IncidentKind
  source: string
  externalId?: string
  title: string
  description?: string
  url: string
  status?: string
  severity?: string
  product?: string
  ecosystem?: string
  cves?: string[]
  startedAt?: string
  publishedAt: string
  updatedAt?: string
  resolvedAt?: string
  collectedAt: string
  raw: unknown
}
```

## 13. StatusとIncidentは分離する

Providerの現在状態とIncidentは別概念として扱う。

```text
Provider
Cloudflare

Current Status
Partial Outage

Incidents
- Workers API elevated errors
- Zero Trust degraded
```

一方PHPはCurrent Statusを持たなくてよい。

```text
Provider
PHP

Security Incidents
- Critical Security Release
```

RuntimeやLibraryへ無理にOperationalという状態を付与しない。

## 14. Source設計

```ts
export type SourceType =
  | 'rss'
  | 'atom'
  | 'api'
  | 'webhook'
  | 'provider_event'
  | 'scrape'
```

RSS中心ではなく、Source Adapter中心で設計する。

## 15. Source Adapter

```ts
export interface IncidentSource {
  readonly id: string

  collect(
    context: SourceContext
  ): Promise<Incident[]>
}
```

Provider Status用:

```ts
export interface StatusSource {
  readonly id: string

  collectStatus(
    context: SourceContext
  ): Promise<ProviderStatus>
}
```

## 16. SourceContext

```ts
export type SourceContext = {
  now: Date
  db: D1Database
  fetch: typeof fetch
}
```

## 17. 共通Adapter

```text
adapters/
  rss/
  atom/
  statuspage/
  json/
  webhook/
```

特にStatuspage互換APIは複数Providerで再利用する。

```ts
new StatuspageAdapter({
  providerId: 'github',
  baseUrl: 'https://www.githubstatus.com'
})
```

```ts
new StatuspageAdapter({
  providerId: 'vercel',
  baseUrl: 'https://www.vercel-status.com'
})
```

## 18. Status Source候補

### Cloud / Infrastructure

- AWS
- Cloudflare
- Google Cloud
- Vercel

### Developer Tools

- GitHub
- npm
- Netlify

### Database

- Supabase
- MongoDB Atlas
- Redis Cloud

### AI

- OpenAI
- Anthropic
- Google Gemini

### Communication

- Slack
- Discord

MVPでは全て実装しなくてよい。最初は10〜20 Provider程度でよい。

## 19. Security Source候補

MVP優先候補:

- PHP Security Releases
- Node.js Security Releases
- OpenSSL Security Advisory
- GitHub Security Advisory Database
- CISA KEV

Phase 2:

- JPCERT/CC
- IPA
- JVN
- Laravel Security Advisory
- Go Security
- npm Security
- Composer ecosystem
- PostgreSQL
- Redis
- Linux Kernel

## 20. Security情報の方針

全CVEを収集しない。

大量のCVEを流すとDaDaDa自体がノイズになるため、Developer Stackに関連するSecurity Advisoryに限定する。

## 21. Severity方針

独自Severity判定はしない。

上流Sourceが提供したSeverityのみ保持する。

```text
GitHub Advisory:
critical

Node.js:
high

Statuspage:
major
```

DaDaDa側ではそれを表示するだけ。

## 22. CISA KEV

CISA KEVは通常のCVE一覧と別枠で扱う。

理由:

- Known Exploited Vulnerabilitiesである
- 実際に悪用が確認されている
- Developerにとって優先度が高い

## 23. D1 Schema

### providers

```sql
CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    homepage_url TEXT NOT NULL,
    status_url TEXT,
    icon_url TEXT,
    supports_status INTEGER NOT NULL DEFAULT 0,
    supports_security INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### provider_statuses

```sql
CREATE TABLE provider_statuses (
    provider_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    message TEXT,
    checked_at TEXT NOT NULL,
    raw_json TEXT,

    FOREIGN KEY(provider_id)
      REFERENCES providers(id)
);
```

### incidents

```sql
CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    provider_id TEXT,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    status TEXT,
    severity TEXT,
    product TEXT,
    ecosystem TEXT,
    cves_json TEXT,
    started_at TEXT,
    published_at TEXT NOT NULL,
    updated_at TEXT,
    resolved_at TEXT,
    collected_at TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_record_at TEXT NOT NULL,

    FOREIGN KEY(provider_id)
      REFERENCES providers(id)
);
```

Index:

```sql
CREATE UNIQUE INDEX idx_incident_source_external
ON incidents(source, external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX idx_incident_published
ON incidents(published_at DESC);

CREATE INDEX idx_incident_kind_published
ON incidents(kind, published_at DESC);

CREATE INDEX idx_incident_provider_published
ON incidents(provider_id, published_at DESC);
```

## 24. raw_json

Sourceの元データを必ず保存する。

理由:

- Adapter修正
- Schema変更
- 再解析
- Incident詳細追加
- AI解析追加
- デバッグ

## 25. 重複排除

external IDが取得できる場合:

```text
source + externalId
```

取得できない場合:

```text
SHA-256(
  source
  + canonicalUrl
  + normalizedTitle
  + publishedDate
)
```

などでfingerprintを生成する。

## 26. Cron

MVPではCloudflare Cron Triggerを使う。

```text
Cron
  ↓
Status Collectors
Security Collectors
  ↓
Normalize
  ↓
D1
```

更新間隔の目安:

- Status: 5〜10分
- Security: 15〜60分

## 27. Collector Runner

```ts
const results = await Promise.allSettled(
  sources.map(source => source.collect(context))
)
```

1Sourceの取得失敗で全体を失敗させない。

## 28. Webhook

Webhook対応ProviderについてはPush型も許容する。

```http
POST /api/webhooks/:source
```

MVPでは必須ではない。

## 29. AWS Health

AWSはProvider固有EventとしてEventBridgeを利用できる。

```text
AWS Health
   ↓
EventBridge
   ↓
API Destination / Lambda
   ↓
DaDaDa Webhook
```

ただしAWS依存が発生するため、MVPでは公開Status Feed / APIで実装してよい。

## 30. Scraping

最後の手段としてのみ使う。

- RSSなし
- APIなし
- Webhookなし

の場合に限る。Adapter単位で隔離する。

## 31. API

### GET /api/status

Provider Status一覧。

query:

```text
category
status
```

### GET /api/incidents

Incident一覧。

query:

```text
kind
provider
ecosystem
status
from
to
cursor
limit
```

### GET /api/incidents/:id

Incident詳細。

### GET /api/providers

Provider一覧。

### GET /api/providers/:id

Provider詳細。

返却内容:

- Provider
- Current Status
- Active Incident
- Recent Incident History
- Security Advisory

## 32. Frontend構成

MVPは基本1ページ。

```text
DaDaDa                                      LIVE

3 incidents now
2 security advisories

------------------------------------------------

HAPPENING NOW

Cloudflare
Workers - Partial outage
18 min ago

GitHub
Actions - Degraded performance
42 min ago

PHP
Critical security release
2 hours ago

------------------------------------------------

SERVICES

Cloud & Infrastructure

AWS            Operational
Cloudflare     Partial outage
Google Cloud   Operational
Vercel         Operational

Developer Tools

GitHub         Degraded
npm            Operational
Netlify        Operational

AI

OpenAI         Operational
Anthropic      Operational

------------------------------------------------

SECURITY

PHP
Critical security release
2h

Node.js
Security release
1d

OpenSSL
High severity advisory
2d
```

## 33. UI設計方針

最優先は「一目で分かる」。

避けること:

- カードを過剰に並べる
- グラフを大量に置く
- 複雑なAnalytics
- 説明文だらけにする
- Dashboard感を出しすぎる

目標:

```text
開く
↓
5秒見る
↓
今何か起きているか分かる
```

## 34. Happening Nowの条件

Service:

```text
status != operational
AND
resolvedAt IS NULL
```

Security:

```text
publishedAt >= now - 72h
```

期間は後から調整可能。

## 35. 個別Providerページ

URL例:

```text
/d/cloudflare
/d/github
/d/php
```

Cloudflare例:

```text
Cloudflare

Partial outage

Official Status
cloudflarestatus.com

Current Incidents

Workers API
Partial outage
Started 18m ago

Recent History

Oct 23 Workers API issue
Oct 20 R2 latency
Oct 18 Scheduled maintenance
```

PHP例:

```text
PHP

Security

Critical Security Release
CVE-xxxx
CVE-yyyy

Oct 21, 2026
```

Runtime等ではCurrent Statusを無理に表示しない。

## 36. My Stack

V2候補。

```text
My Stack

AWS
Cloudflare
GitHub
PHP
Laravel
Node.js
PostgreSQL
```

初期はログイン不要で、localStorageにProvider IDを保存する。

表示切替:

```text
Everything
My Stack
```

## 37. AI機能

MVPでは使用しない。

将来的な候補:

- Advisory要約
- affected products抽出
- CVE抽出
- 同一Incidentのcluster化
- Watch Listとの関連判定
- 「今、自分のStackに何が起きている？」回答

重要度そのものをAIに決めさせない。

## 38. Slack通知

MVPには実装しない。

将来:

```text
Incident
  ↓
Watch List
  ↓
Notification Rule
  ↓
Slack
```

## 39. Queue

初期版では不要。

```text
Cron
 ↓
Collectors
 ↓
D1
```

以下の条件が出たらCloudflare Queuesを導入する。

- Source数増加
- timeout
- retry制御
- scraping増加
- AI処理
- Source別worker分離

## 40. Directory Structure

```text
dadada/
├─ src/
│  ├─ worker/
│  │  ├─ index.ts
│  │  ├─ routes/
│  │  │  ├─ status.ts
│  │  │  ├─ incidents.ts
│  │  │  ├─ providers.ts
│  │  │  └─ webhooks.ts
│  │  ├─ collectors/
│  │  │  └─ collector-runner.ts
│  │  ├─ sources/
│  │  │  ├─ cloudflare/
│  │  │  ├─ github-status/
│  │  │  ├─ google-cloud/
│  │  │  ├─ vercel/
│  │  │  ├─ php/
│  │  │  ├─ nodejs/
│  │  │  ├─ openssl/
│  │  │  ├─ github-advisory/
│  │  │  └─ cisa-kev/
│  │  ├─ adapters/
│  │  │  ├─ rss/
│  │  │  ├─ atom/
│  │  │  ├─ json/
│  │  │  ├─ statuspage/
│  │  │  └─ webhook/
│  │  ├─ domain/
│  │  │  ├─ provider.ts
│  │  │  ├─ provider-status.ts
│  │  │  └─ incident.ts
│  │  ├─ repositories/
│  │  │  ├─ provider.repository.ts
│  │  │  ├─ provider-status.repository.ts
│  │  │  └─ incident.repository.ts
│  │  └─ services/
│  │     ├─ status.service.ts
│  │     └─ incident.service.ts
│  └─ web/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ components/
│     │  ├─ Header.tsx
│     │  ├─ StatusBadge.tsx
│     │  └─ ProviderIcon.tsx
│     └─ features/
│        ├─ happening-now/
│        ├─ services/
│        ├─ security/
│        └─ provider-detail/
├─ migrations/
├─ tests/
├─ wrangler.jsonc
├─ vite.config.ts
├─ package.json
└─ README.md
```

## 41. Worker Entry Point

```ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.route('/api/status', statusRoute)
app.route('/api/incidents', incidentsRoute)
app.route('/api/providers', providersRoute)
app.route('/api/webhooks', webhooksRoute)

export default {
  fetch: app.fetch,

  async scheduled(
    event: ScheduledController,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      runCollectors(env)
    )
  },
}
```

## 42. 初期実装Source

AIは最初から大量Sourceを実装しないこと。

### Status

1. Cloudflare
2. GitHub
3. Vercel
4. Google Cloud

### Security

5. PHP
6. Node.js
7. GitHub Advisory
8. CISA KEV

この8 SourceでMVP構造を検証する。

## 43. 実装順序

### Step 1

```text
Hono
Cloudflare Workers
D1
React
Vite
```

の最小構成を作る。

`GET /api/health` が動き、Reactから取得できるところまで実装する。

### Step 2

Domain Modelを作成。

```text
Provider
ProviderStatus
Incident
```

### Step 3

D1 migration作成。

```text
providers
provider_statuses
incidents
```

### Step 4

Repositoryを作成。

### Step 5

Cloudflare Statusを最初のSourceとして実装。

Current StatusとIncidentをD1へ保存。

### Step 6

Statuspage Adapterを作成。

GitHub / Vercelへ展開する。

### Step 7

Cron Triggerを追加。

### Step 8

PHP / Node.js Security Sourceを追加。

### Step 9

GitHub Advisory / CISA KEVを追加。

### Step 10

Frontend実装。

順番:

1. Happening Now
2. Services
3. Security
4. Provider Detail

## 44. MVP完成条件

- Cloudflare Workers上で稼働
- Hono APIが動作
- D1利用
- Cronによる定期収集
- 8前後のSource
- Provider Status取得
- Service Incident取得
- Security Advisory取得
- 重複排除
- Source失敗が全体へ波及しない
- raw data保存
- Happening Now表示
- Services表示
- Security表示
- Provider Detail表示
- 元SourceへのLink
- レスポンシブ表示

## 45. コーディング方針

- Source固有ロジックをDomain層へ漏らさない
- RSS / JSON / Statuspageを共通Adapter化する
- 取得失敗をthrowしっぱなしにしない
- `Promise.allSettled()`でSourceを独立させる
- Dateは内部ではUTC
- UI表示時にlocal timeへ変換
- raw payloadは必ず保存
- external IDがあるSourceはそれを利用
- external IDがないSourceはfingerprintを生成
- API response型を明示する
- unnecessary abstractionは避ける
- 最初からDDDをやりすぎない
- Cloudflare Workerの実行時間・fetch数を意識する

## 46. デザイン方針

ブランド名:

```text
DaDaDa
```

技術サービス感を出しすぎない。

印象:

- 軽い
- 速い
- 見やすい
- 少し遊びがある
- Developer向け
- 監視ツール特有の重苦しさを避ける

候補コピー:

```text
DaDaDa

What's happening to the tools we use?
```

または:

```text
DaDaDa

What's breaking now?
```

トップ画面は「Dashboard」より「Radar」に近い視覚体験を目指す。

## 47. 最終方針

DaDaDaの本質は `Monitor` ではない。

自分たちでInfrastructureを監視するのではなく、

```text
Collect
Normalize
Summarize
Browse
```

する。

最も重要な問いは、

> 今、自分が使っているDeveloper Stack周辺で何が起きているか？

である。

MVPでは賢くしすぎない。

```text
Current Status
+
Active Incidents
+
Security Advisories
```

を、1画面で5秒以内に把握できることを最優先する。
