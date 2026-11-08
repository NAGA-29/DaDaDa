# API

| Method | Path | 内容 |
| --- | --- | --- |
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/summary` | トップ画面用の集約 (Happening Now / Services / Security / KEV) |
| GET | `/api/status?category=&status=` | Provider Status 一覧 |
| GET | `/api/incidents?kind=&provider=&ecosystem=&status=&active=&from=&to=&cursor=&limit=` | Incident 一覧 (cursor pagination) |
| GET | `/api/incidents/:id` | Incident 詳細 (raw 含む) |
| GET | `/api/providers?category=` | Provider 一覧 |
| GET | `/api/providers/:id` | Provider 詳細 (Status / Active / History / Security) |
| POST | `/api/webhooks/:source` | Push 型 Source 用 (現在ハンドラ未登録のため404) |
| POST | `/api/admin/collect?group=` | 手動収集 (`ADMIN_TOKEN` 必須、`status` / `security`、省略時は両方) |
