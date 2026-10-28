# E2E テストケース一覧

本番ビルド（Worker + 静的アセット）を `vite preview`（workerd）で起動し、シード済みのローカル D1 に対してブラウザと HTTP の両方から検証する。

- 実行: `pnpm run test:e2e`（初回のみ `pnpm exec playwright install chromium`）
- シード: [`fixtures/seed.sql`](fixtures/seed.sql)（時刻は投入時点からの相対値）
- 外部フィードへの通信は行わない。収集（Cron / 有効トークンでの `POST /api/admin/collect`）は `tests/collector.test.ts` の結合テストで担保する
- 列「仕様の出典」は根拠となるソース

## シードデータの概要

| 種別 | データ | 狙い |
| --- | --- | --- |
| Provider 状態 | Cloudflare=大規模障害 / GitHub=正常 / Vercel=2時間前の性能低下 / さくら=未判定 / Netlify=未取得 | 並び順・鮮度切れ（unknown）・未判定・未取得の表示 |
| Service 障害 | Cloudflare 発生中・復旧済み、Provider なしの発生中 | 発生中ハイライト、詳細リンク / 公式情報リンク、復旧履歴 |
| Service 告知 | さくら 旧・新告知 | 告知は「発生中」に含めない、Provider ごとに最新のみ |
| Security | 緊急 npm×6 + composer×1、高 pip×1、取り下げ×1、深刻度なし Node.js×1、CVE 重複の JPCERT×1 | 深刻度・言語フィルタ、さらに表示、取り下げ非表示、重複統合 |
| KEV | 2日前 / 45日前 | 30日の期限 |

## API（`api.spec.ts`）

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| API-01 | `GET /api/health` | 200、`ok: true`・`name: DaDaDa`・ISO 時刻 | `src/worker/index.ts` |
| API-02 | `GET /api/summary` のキャッシュ | `Cache-Control: public, max-age=30` | `src/worker/index.ts` |
| API-03 | summary の発生中障害 | 未解決の Service のみ。復旧済み・告知は含まない | `incident.service.ts` / `incident.repository.ts` |
| API-04 | summary のセキュリティ | 取り下げは非表示、CVE 重複は緊急側に統合（CVE を合成）、KEV は含まない | `security.service.ts` |
| API-05 | summary の KEV | 30日以内のみ | `incident.service.ts` (`KEV_LOOKBACK_DAYS`) |
| API-06 | summary の公式告知 | Provider ごとに最新の告知のみ | `incident.service.ts` |
| API-07 | `GET /api/status` | Status 対応 Provider のみ、古い状態は `unknown` + `Status data is stale`、未判定は維持 | `status.service.ts` / `provider-status.ts` |
| API-08 | `GET /api/status?category=&status=` | カテゴリ・状態で絞り込める（未取得は `unknown` 扱い） | `status.service.ts` |
| API-09 | `GET /api/incidents` 一覧 | `raw` を返さない、公開日時の降順 | `routes/incidents.ts` |
| API-10 | `kind` の検証 | 不正値は 400 とエラーメッセージ | `routes/incidents.ts` |
| API-11 | `kind` / `provider` / `ecosystem` / `active` 絞り込み | 条件どおりの件数・ID | `incident.repository.ts` |
| API-12 | `from` / `to` 絞り込み | 期間内のみ | `incident.repository.ts` |
| API-13 | `limit` + `cursor` ページング | 重複・欠落なく全件を辿れ、最後は `nextCursor: null` | `incident.repository.ts` |
| API-14 | 取り下げの明示指定 | `status=withdrawn` のときだけ返る | `incident.repository.ts` |
| API-15 | `GET /api/incidents/:id` | `raw` と Provider を含む / 未知 ID は 404 | `routes/incidents.ts` |
| API-16 | `GET /api/providers` | 名前順、`category` で絞り込み | `provider.repository.ts` |
| API-17 | `GET /api/providers/:id` | 状態・発生中・履歴・告知・Advisory を集約 / 未知 ID は 404 | `incident.service.ts` |
| API-18 | 未定義の `/api/*` | 404 JSON | `src/worker/index.ts` |
| API-19 | `POST /api/webhooks/:source` | 未登録 Source は 404 | `routes/webhooks.ts` |
| API-20 | `POST /api/admin/collect` の認可 | トークンなし・不一致はいずれも 404（存在を隠す） | `routes/admin.ts` |

## ダッシュボード（`dashboard.spec.ts`）

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| UI-01 | 初期表示 | ロゴ・見出し・説明、ヘッダーに「接続中」と画面更新時刻、フッター | `App.tsx` / `Header.tsx` / `Home.tsx` |
| UI-02 | 発生中の障害ハイライト | 件数、Provider 名 · タイトル、状態ラベル（調査中など） | `Home.tsx` |
| UI-03 | ハイライトのリンク | Provider ありは詳細ページへ、なしは公式情報（別タブ） | `Home.tsx` |
| UI-04 | タブの初期状態と件数 | 「セキュリティ」が選択、各タブの件数バッジ | `Home.tsx` |
| UI-05 | 深刻度フィルタ | 緊急 / 高 / 高・緊急 で件数と表示が切り替わる | `Home.tsx` / `Security.tsx` |
| UI-06 | 言語フィルタ | 言語で絞り込み、該当なしは空メッセージ | `shared/security.ts` / `Security.tsx` |
| UI-07 | さらに表示 | 最初は4件、ボタンで残りを表示しボタンが消える | `Security.tsx` (`Feed`) |
| UI-08 | 公式告知タブ | Provider ごとの最新告知 + 深刻度なしの告知、深刻度フィルタは出ない | `Home.tsx` |
| UI-09 | 悪用確認済みタブ | 30日以内の KEV のみ、言語フィルタは出ない | `Home.tsx` |
| UI-10 | タブのキーボード操作 | ←/→/Home/End で選択とフォーカスが移動（WAI-ARIA） | `Home.tsx` (`handleTabKey`) |
| UI-11 | 行の表示 | CVE は3件まで + 残数、公式情報リンクは別タブ（noopener） | `IncidentRow.tsx` / `Link.tsx` |
| UI-12 | サービス稼働状況パネル | 深刻な順 → 名前順、状態ラベル、未判定=公開告知のみ、不明/未取得=最新状態を確認できません | `Services.tsx` |
| UI-13 | 取り下げ・重複・期限切れの非表示 | 取り下げ・統合された重複・45日前の KEV は画面に出ない | `security.service.ts` / `incident.service.ts` |

## Provider 詳細・ルーティング（`provider-detail.spec.ts`）

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| NAV-01 | 一覧 → 詳細の SPA 遷移 | ページを再読み込みせず `/d/:id` へ、戻る操作で一覧へ | `lib/router.ts` / `Link.tsx` |
| NAV-02 | 「一覧に戻る」リンク | トップへ戻る | `ProviderDetail.tsx` |
| NAV-03 | 詳細の直接アクセス | SPA フォールバックで詳細が表示される | `wrangler.sample.jsonc` (`not_found_handling`) |
| NAV-04a | 不正なパーセントエンコード（SPA 内遷移） | 「ページが見つかりません」 | `App.tsx` (`safeDecode`) |
| NAV-04b | 不正なパーセントエンコード（直接アクセス） | アセット配信が `%` を `%25` に 307 リダイレクトし、ID `%FF` の読み込み失敗が表示される（現状の挙動を記録） | Cloudflare Workers Assets |
| NAV-05 | 未知の Provider | 読み込み失敗メッセージ | `ProviderDetail.tsx` |
| DET-01 | Status 対応 Provider（Cloudflare） | カテゴリ・名前・状態バッジ・翻訳済みメッセージ・公式ステータス・発生中・復旧履歴、Advisory 欄なし | `ProviderDetail.tsx` / `format.ts` |
| DET-02 | 告知のみ Provider（さくら） | 発生中欄を出さず、公式告知欄に告知を新しい順で表示 | `ProviderDetail.tsx` |
| DET-03 | Security のみ Provider（GitHub Advisory） | 状態欄なし、ホームページへのリンク、Advisory 一覧（取り下げなし） | `ProviderDetail.tsx` |
| DET-04 | 状態が古い Provider（Vercel） | 「不明」と「稼働状況のデータが古くなっています」 | `provider-status.ts` / `format.ts` |

## 多言語（`i18n.spec.ts`）

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| I18N-01 | 既定は日本語 | `<html lang="ja">`、日本語の見出し | `lib/i18n.tsx` |
| I18N-02 | 英語へ切り替え | 見出し・タブ・状態ラベルが英語、`<html lang="en">` | `lib/messages.ts` |
| I18N-03 | 選択の保持 | 再読み込み・詳細ページでも英語を維持（localStorage） | `lib/i18n.tsx` |

## 耐障害性（`resilience.spec.ts`）

ネットワーク層で API 応答を差し替えて、DB では作れない状態を検証する。

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| RES-01 | 初回取得の失敗 | 「APIに接続できませんでした」と再試行ボタン、ヘッダーは「未接続」 | `Home.tsx` / `Header.tsx` |
| RES-02 | 再試行で回復 | ダッシュボードが表示される | `lib/api.ts` (`reload`) |
| RES-03 | 定期更新（60秒）の失敗 | 直前のデータを保持したまま「◯時点のデータ」バナー、ヘッダーは「未接続」 | `App.tsx` / `lib/api.ts` |
| RES-04 | 定期更新で最新化 | 60秒後の再取得で新しい障害が表示される | `App.tsx` (`REFRESH_MS`) |
| RES-05 | データが空 | 「発生中の障害はありません」「稼働状況はまだ取得されていません」、KEV の空メッセージ | `Home.tsx` / `Services.tsx` |

## レスポンシブ（`responsive.spec.ts`、モバイル端末エミュレーション）

| ID | 内容 | 期待結果 | 仕様の出典 |
| --- | --- | --- | --- |
| RWD-01 | トップ | 横スクロールが発生しない、主要要素が表示される | `styles.css` |
| RWD-02 | Provider 詳細 | 横スクロールが発生しない | `styles.css` |
