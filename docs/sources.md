# Source

| 種別 | Source | 取得方法 |
| --- | --- | --- |
| Status | Cloudflare / GitHub / Vercel / Netlify | Statuspage API (`StatuspageAdapter`) |
| Status | AWS | 公式 RSS（公開告知のみ。稼働状態は未判定） |
| Status | Azure | 公式 RSS（公開告知のみ。稼働状態は未判定） |
| Status | さくらインターネット | 公式 RSS（障害・メンテナンスの告知のみ。稼働状態は未判定） |
| Status | Supabase | incident.io の Statuspage 互換 API（未解決の障害の影響度も状態に反映） |
| Status | Railway | 公式ステータス JSON (`status.railway.com/api/status`) |
| Status | Google Cloud | `status.cloud.google.com/incidents.json` |
| Status (AI) | Anthropic | Statuspage API (`StatuspageAdapter`, `status.claude.com`) |
| Status (AI) | OpenAI | incident.io の Statuspage 互換 API（`IncidentIoStatuspageAdapter`。未解決の障害の影響度も状態に反映） |
| Status (AI) | Google Gemini | Google Cloud の `incidents.json` から影響プロダクト名に "Gemini" を含むものを抽出（Google Cloud と 1 fetch を共有） |
| Security | PHP | php.net Atom (security release のみ) |
| Security | Node.js | Vulnerability RSS |
| Security | GitHub Advisory | REST API（全体の reviewed / Critical） |
| Security | Go / Java / Rust / C# (.NET) のライブラリ | GitHub Advisory を `go` / `maven` / `rust` / `nuget` 別に High / Critical 収集（4 Source） |
| Security | Go 標準ライブラリ・toolchain | Go 公式 Vulnerability Database（OSV JSON） |
| Security | Java SE / GraalVM | Oracle 公式 Security Alerts RSS と Java SE Risk Matrix |
| Security | Rust / Cargo / rustup | Rust 公式ブログ Atom のセキュリティ告知 |
| Security | .NET / ASP.NET Core | Microsoft 公式リポジトリの Security Advisory API（2 Source） |
| Security | CISA KEV | JSON feed (直近 30 日の追加分) |
| Security | JPCERT/CC | 公式 RSS 1.0（注意喚起・緊急報告と Weekly Report。Developer Stack 関連のみ） |
| Security | IPA | 公式 RSS（重要なセキュリティ情報。Developer Stack 関連のみ） |
| Security | JVN | 公式 RSS 1.0（脆弱性対策情報。Developer Stack 関連のみ） |
| Security | Laravel | `laravel/framework` の GitHub Security Advisory（全件。上流の重要度を保持） |
| Security | Redis | `redis/redis` の GitHub Security Advisory（全件。上流の重要度を保持） |
| Security | PostgreSQL | 公式ニュース RSS（セキュリティリリースのみ） |
| Security | npm / Composer のライブラリ | GitHub Advisory を `npm` / `composer` 別に収集（2 Source） |
