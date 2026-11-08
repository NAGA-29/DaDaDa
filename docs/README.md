# DaDaDa ドキュメント

目的別に分けた詳細ドキュメントの一覧です。プロジェクトの概要とクイックスタートは [README](../README.md) を参照してください。

## 使う

| ドキュメント | 内容 |
| --- | --- |
| [mcp.md](mcp.md) | MCP サーバー (`/api/mcp`) の接続方法と提供ツール |
| [api.md](api.md) | HTTP API の一覧 |

## 運用する

| ドキュメント | 内容 |
| --- | --- |
| [deployment.md](deployment.md) | Cloudflare へのデプロイ手順と Cron |
| [sources.md](sources.md) | 収集している Source の一覧と取得方法 |
| [status-handling.md](status-handling.md) | Supabase / Railway / AI / AWS / Azure / さくらインターネットの状態・告知の扱い |
| [security-alerts.md](security-alerts.md) | セキュリティ情報の収集範囲・表示・絞り込みのルール |

## 開発する

| ドキュメント | 内容 |
| --- | --- |
| [development.md](development.md) | ローカル開発、手動収集、テスト、E2E、コミット前のチェック |
| [dependency-safety.md](dependency-safety.md) | 依存関係の安全性ポリシー (pnpm 設定と監査) |
| [architecture.md](architecture.md) | ディレクトリ構成、Source の追加方法、実装方針 |

## 設計・ライセンス

| ドキュメント | 内容 |
| --- | --- |
| [dadada-mvp-design.md](dadada-mvp-design.md) | 初期の MVP 設計書 (実装指示書)。現状との差分がある場合は、実装と上記ドキュメントを優先します |
| [license.md](license.md) | AGPL-3.0 の利用条件の解説 |
