# セキュリティアラートの表示・収集範囲

- JPCERT/CC は通常版の [公式RSS](https://www.jpcert.or.jp/rss/jpcert.rdf) を30分間隔で収集します。フィードに掲載された注意喚起・緊急報告と Weekly Report のうち、タイトルまたは概要に Developer Stack の製品名（PHP / Laravel / Node.js / PostgreSQL / Redis など）を含む項目だけが対象です。重要度・言語を推測せず、全言語表示時の「Official notices」に表示します。リンクのフラグメントを保持して週報の各項目を区別し、同じURLの更新は上書きします。保存済みの項目は、更新文から製品名がなくなっても更新を取り込みます。RSSの日時は更新時にも変わるため、初回公開日時とは限りません。本文の追加取得・過去全件の同期・統合版のお知らせやJVN新着は対象外です。
- IPA（[重要なセキュリティ情報 RSS](https://www.ipa.go.jp/security/alert-rss.rdf)）と JVN（[新着 RSS](https://jvn.jp/rss/jvn.rdf)）は JPCERT/CC と同じ Developer Stack フィルター（`src/worker/lib/developer-stack.ts`）を通した項目だけを30分間隔で収集します。全 CVE は流しません。重要度は上流が提供しないため推測せず「Official notices」に表示します。IPA は更新のたびに同じ URL を繰り返すため、URL ごとに上流の最新日時の1件に集約します。製品名の許可リストにない製品の告知は表示されません。
- PostgreSQL は公式ニュース RSS のうちセキュリティリリースの告知だけを対象にします。Laravel と Redis は各公式リポジトリの公開済み（`state=published`）GitHub Security Advisory を `Link` ヘッダーのページングで最大5ページ（500件）まで収集します。上流で High から下がった告知を保存済みの High 行に残さないよう、重要度で絞らず上流の値のまま保存します。npm と Composer は GitHub Advisory を `npm` / `composer` 別に収集する専用 Source で、PHP フィルターには Composer が含まれます。Composer は専用の公式フィードを持たないため、GitHub Advisory 経由のみです。
- Linux Kernel は未対応です（[Issue #12](https://github.com/NAGA-29/DaDaDa/issues/12) で継続管理）。
- 「対象」フィルターで、言語（Go / Java / Rust / C# (.NET) / JavaScript・Node.js / PHP / Python）とフレームワーク・ミドルウェア（Laravel / PostgreSQL / Redis）を選べます。Laravel は PHP フィルターにも含まれます。IPA / JVN / JPCERT/CC は提供元の告知で対象を持たないため、「すべて」のときに「公式告知」へ表示します。初期表示は Critical、High または High + Critical に切り替えられます。C++ の専用収集は追加していません。
- Go / Java / Rust / C# (.NET) は専用SourceでHigh / Criticalを収集します。JavaScript・PHP・Pythonのライブラリ情報は全体向けGitHub Advisory SourceのCriticalが対象で、Highの専用収集はありません。全体向けSourceは公開日時順の最新50件を取得します。
- PHP フィルターは PHP 本体（`php`）と Composer ライブラリ（`composer`）の両方を対象にします。
- 上流が重要度を提供しない公式告知は、重要度を推測せず「Official notices」に別表示します。言語フィルターはこの欄にも適用します。KEV は言語別情報がないため全言語共通の別枠です。
- CVE / GHSA が一致する情報は集約して表示し、複数言語にまたがる情報は各言語のフィルターで見つけられます。元のデータは取得元ごとに保存します。
- Go / Java / Rust / C# (.NET) のライブラリは各言語・各重要度について更新日時順に最大200件を毎回確認します。npm / Composer を含む各言語 Source は、重要度を絞らない更新順の最大200件も確認して重要度の降格・取り下げを反映します。この範囲を超える更新は取得できない場合があります。過去全件の同期ではありません。1 Source の取得失敗はほかの Source に波及させません。
- トップ画面は各言語の High / Critical / 重要度未設定それぞれ最大30件と全体の最新30件に、直近72時間のセキュリティ情報（最大100件、KEVを除く）を加えて重複をまとめます。件数が多い言語によって他言語が一覧から押し出されるのを防ぎます。KEVは直近30日の最大20件を別表示します。
- 取得した取り下げ済みAdvisoryは保存済みデータを更新し、一覧から除外します。
- Go 本体は標準ライブラリ・toolchain の更新順12件、Rust は公式 Atom に残っている告知、Java は過去120日内の最新4告知（Java SE 部分のみ）、.NET / ASP.NET Core は各公式リポジトリの最新100件が対象です。Java は Oracle Java SE / GraalVM の範囲で、全 JDK ベンダーを網羅するものではありません。
- GitHub API の呼び出しが増えるため、`GITHUB_TOKEN` の設定を推奨します。未設定でも取得できますが、公開 API のレート制限に達した Source は収集結果にエラーを返します。

取得元仕様: [GitHub Advisory API](https://docs.github.com/en/rest/security-advisories/global-advisories)、[Go 公式 DB](https://go.dev/doc/security/vuln/database)、[Rust の告知方針](https://rust-lang.org/security)、[Oracle Security Alerts](https://www.oracle.com/security-alerts/)、[.NET 公式告知](https://github.com/dotnet/runtime/security/advisories)。
