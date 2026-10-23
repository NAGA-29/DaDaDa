export type Bindings = {
  DB: D1Database
  ASSETS: Fetcher
  /** GitHub Advisory API 用 (任意) */
  GITHUB_TOKEN?: string
  /** POST /api/admin/collect を有効にする (任意) */
  ADMIN_TOKEN?: string
}
