# ステータスと公式告知の扱い

## Supabase / Railway

Supabase は公式ステータスサイトの Statuspage 互換 API から、状態と障害履歴を5分間隔で取得します。集約状態が正常でも未解決の障害がある場合は、上流の影響度もカードの状態に反映します。認証キーは不要です。

Railway は公式ステータスサイトの公開 JSON を5分間隔で取得します。公式の影響度から状態を集約し、発生中の障害と復旧履歴を共通画面に表示します。`TRIAGE`（公式表示: Notice）は告知として扱い、障害件数に含めません。Noticeのみの場合は稼働状態を「未判定」にします。予定メンテナンスは告知、実施中はメンテナンスとして扱い、予定終了日時から復旧を推測しません。認証キーは不要ですが、専用JSON形式の変更時には取得処理の更新が必要です。

## AI (OpenAI / Anthropic / Google Gemini)

Services 画面の「AI」カテゴリとして表示します。いずれも認証キーは不要で、5分間隔で取得します。

- Anthropic は Atlassian Statuspage の API をそのまま使います。
- OpenAI は incident.io の Statuspage 互換 API を使います。Supabase と同様に、集約状態が正常でも未解決の障害があれば上流の影響度を状態に反映します。
- Google Gemini は Gemini API（AI Studio）のステータスページに公開の機械可読フィードが無いため、Google Cloud の `incidents.json` のうち影響プロダクトに "Gemini" を含む Incident（Vertex Gemini API、Gemini Code Assist など）を対象にします。AI Studio のみで告知される障害は取得できません。Incident は Google Cloud と同じ ID・Source で1件だけ保存し、Gemini 詳細では影響プロダクトに Gemini を含む履歴を表示します。

## AWS / Azure

AWS は [公式の全サービス RSS](https://status.aws.amazon.com/rss/all.rss) を5分間隔で収集し、Services と共通の「Incidents & notices」に表示します。ホームは各社の最新1件、詳細画面は最新30件です。GUID のサービスコード・リージョンを読み取れる場合は併記し、識別子と元データを保持します。RSS の文言や記事の消失から障害の発生中・復旧を推測せず、稼働状態は「未判定」、記事は `status=notice` として扱います。アカウント固有のイベントは対象外です。

AWS 公式は RSS の形式変更・網羅性の制約を説明し、プログラム連携には [EventBridge](https://docs.aws.amazon.com/health/latest/ug/cloudwatch-events-health.html) を推奨しています。将来の対応は [Issue #3](https://github.com/NAGA-29/DaDaDa/issues/3) で管理します。

Azure は [公式 RSS](https://azure.status.microsoft/en-us/status/feed/) を認証なしで5分間隔で収集し、他のクラウドと同じ Services と共通の告知一覧に表示します。ホームは最新1件、詳細画面は最新30件です。GUID・記事URLのクエリ・元データを保持し、同じ告知の再取得は上書きします。記事は `status=notice`、稼働状態は「未判定」とし、記事が0件でも正常稼働や復旧とは判断しません。[公開ステータスの対象](https://learn.microsoft.com/en-us/azure/service-health/azure-status-overview)は広範囲の障害などに限られ、サブスクリプション固有の障害・計画メンテナンスを取得する Azure Service Health 連携は含みません。

## さくらインターネット

Services に「さくらインターネット」を表示し、[公式の障害・メンテナンス RSS](https://www.sakura.ad.jp/rss/mainte.rdf) を5分間隔の Status 収集で取得します。クラウド・VPS・レンタルサーバ・専用サーバなどの告知が混在します。

RSS だけでは発生中・復旧済み・実施中の状態を確定できないため、状態は「未判定」（API: `unverified`）、記事は `kind=service` / `status=notice` として保存します。発生中のインシデント数や解決済み履歴には含めません。ホームでは他社と共通の「Incidents & notices」一覧に各サービスの最新告知1件を表示し、サービス名から詳細画面へ進むと最新30件の公式告知を確認できます。対象サービス・設備・実施日時・復旧状況は公式リンクから確認してください。

RSS から項目が消えても、復旧したとは判断しません。元データと記事 URL のクエリ ID を保持し、同じ告知の再取得は上書きします。
