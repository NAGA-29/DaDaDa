# DaDaDa

What's breaking now?

Developer が使っている Cloud / SaaS / Runtime / OSS の **現在状態・発生中の障害・Security Advisory** を 1 画面で確認する Developer Status / Security Radar。
自分で監視はせず、公開 Status Page / Security Feed を **Collect → Normalize → Browse** する。

## Stack

- Cloudflare Workers + Hono (API / Cron)
- Cloudflare D1
- React + Vite (`@cloudflare/vite-plugin` で Worker と SPA を 1 プロジェクトに)
- Vanilla CSS

## Source (19)

| 種別 | Source | 取得方法 |
| --- | --- | --- |
| Status | Cloudflare / GitHub / Vercel / Netlify | Statuspage API (`StatuspageAdapter`) |
| Status | AWS | 公式 RSS（公開告知のみ。稼働状態は未判定） |
| Status | さくらインターネット | 公式 RSS（障害・メンテナンスの告知のみ。稼働状態は未判定） |
| Status | Google Cloud | `status.cloud.google.com/incidents.json` |
| Security | PHP | php.net Atom (security release のみ) |
| Security | Node.js | Vulnerability RSS |
| Security | GitHub Advisory | REST API（全体の reviewed / Critical） |
| Security | Go / Java / Rust / C# (.NET) のライブラリ | GitHub Advisory を `go` / `maven` / `rust` / `nuget` 別に High / Critical 収集（4 Source） |
| Security | Go 標準ライブラリ・toolchain | Go 公式 Vulnerability Database（OSV JSON） |
| Security | Java SE / GraalVM | Oracle 公式 Security Alerts RSS と Java SE Risk Matrix |
| Security | Rust / Cargo / rustup | Rust 公式ブログ Atom のセキュリティ告知 |
| Security | .NET / ASP.NET Core | Microsoft 公式リポジトリの Security Advisory API（2 Source） |
| Security | CISA KEV | JSON feed (直近 30 日の追加分) |

## さくらインターネットの告知

AWS は [公式の全サービス RSS](https://status.aws.amazon.com/rss/all.rss) を5分間隔で収集し、Services と共通の「Incidents & notices」に表示します。ホームは各社の最新1件、詳細画面は最新30件です。GUID のサービスコード・リージョンを読み取れる場合は併記し、識別子と元データを保持します。RSS の文言や記事の消失から障害の発生中・復旧を推測せず、稼働状態は「未判定」、記事は `status=notice` として扱います。アカウント固有のイベントは対象外です。

AWS 公式は RSS の形式変更・網羅性の制約を説明し、プログラム連携には [EventBridge](https://docs.aws.amazon.com/health/latest/ug/cloudwatch-events-health.html) を推奨しています。将来の対応は [Issue #3](https://github.com/NAGA-29/DaDaDa/issues/3) で管理します。

Services に「さくらインターネット」を表示し、[公式の障害・メンテナンス RSS](https://www.sakura.ad.jp/rss/mainte.rdf) を5分間隔の Status 収集で取得します。クラウド・VPS・レンタルサーバ・専用サーバなどの告知が混在します。

RSS だけでは発生中・復旧済み・実施中の状態を確定できないため、状態は「未判定」（API: `unverified`）、記事は `kind=service` / `status=notice` として保存します。発生中のインシデント数や解決済み履歴には含めません。ホームでは他社と共通の「Incidents & notices」一覧に各サービスの最新告知1件を表示し、サービス名から詳細画面へ進むと最新30件の公式告知を確認できます。対象サービス・設備・実施日時・復旧状況は公式リンクから確認してください。

RSS から項目が消えても、復旧したとは判断しません。元データと記事 URL のクエリ ID を保持し、同じ告知の再取得は上書きします。

## セキュリティアラートの表示・収集範囲

- 言語フィルターで Go / Java / Rust / C# (.NET) と既存の JavaScript・PHP・Python を選べます。初期表示は Critical、High または High + Critical に切り替えられます。C++ の専用収集は追加していません。
- PHP フィルターは PHP 本体（`php`）と Composer ライブラリ（`composer`）の両方を対象にします。
- 上流が重要度を提供しない公式告知は、重要度を推測せず「Official notices」に別表示します。言語フィルターはこの欄にも適用します。KEV は言語別情報がないため全言語共通の別枠です。
- CVE / GHSA が一致する情報は集約して表示し、複数言語にまたがる情報は各言語のフィルターで見つけられます。元のデータは取得元ごとに保存します。
- ライブラリは各言語・各重要度について更新日時順に最大200件を毎回確認します。過去全件の同期ではありません。1 Source の取得失敗はほかの Source に波及させません。
- トップ画面は各言語の High / Critical / 重要度未設定それぞれ最大30件と全体の最新30件を取得してから重複をまとめます。件数が多い言語によって他言語が一覧から押し出されるのを防ぎます。
- Go 本体は標準ライブラリ・toolchain の更新順12件、Rust は公式 Atom に残っている告知、Java は過去120日内の最新4告知（Java SE 部分のみ）、.NET / ASP.NET Core は各公式リポジトリの最新100件が対象です。Java は Oracle Java SE / GraalVM の範囲で、全 JDK ベンダーを網羅するものではありません。
- GitHub API の呼び出しが増えるため、`GITHUB_TOKEN` の設定を推奨します。未設定でも取得できますが、公開 API のレート制限に達した Source は収集結果にエラーを返します。

取得元仕様: [GitHub Advisory API](https://docs.github.com/en/rest/security-advisories/global-advisories)、[Go 公式 DB](https://go.dev/doc/security/vuln/database)、[Rust の告知方針](https://rust-lang.org/security)、[Oracle Security Alerts](https://www.oracle.com/security-alerts/)、[.NET 公式告知](https://github.com/dotnet/runtime/security/advisories)。

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
