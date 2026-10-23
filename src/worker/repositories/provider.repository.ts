import type { Provider, ProviderCategory } from '../domain/provider'

type ProviderRow = {
  id: string
  name: string
  category: string
  homepage_url: string
  status_url: string | null
  icon_url: string | null
  supports_status: number
  supports_security: number
}

function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ProviderCategory,
    homepageUrl: row.homepage_url,
    statusUrl: row.status_url ?? undefined,
    iconUrl: row.icon_url ?? undefined,
    supportsStatus: row.supports_status === 1,
    supportsSecurity: row.supports_security === 1,
  }
}

export class ProviderRepository {
  constructor(private readonly db: D1Database) {}

  async upsertMany(providers: Provider[], now: Date): Promise<void> {
    if (!providers.length) return
    const ts = now.toISOString()
    const stmt = this.db.prepare(
      `INSERT INTO providers (id, name, category, homepage_url, status_url, icon_url, supports_status, supports_security, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         category = excluded.category,
         homepage_url = excluded.homepage_url,
         status_url = excluded.status_url,
         icon_url = excluded.icon_url,
         supports_status = excluded.supports_status,
         supports_security = excluded.supports_security,
         updated_at = excluded.updated_at`,
    )
    await this.db.batch(
      providers.map(p =>
        stmt.bind(
          p.id,
          p.name,
          p.category,
          p.homepageUrl,
          p.statusUrl ?? null,
          p.iconUrl ?? null,
          p.supportsStatus ? 1 : 0,
          p.supportsSecurity ? 1 : 0,
          ts,
          ts,
        ),
      ),
    )
  }

  async list(filter: { category?: string } = {}): Promise<Provider[]> {
    const query = filter.category
      ? this.db
          .prepare('SELECT * FROM providers WHERE category = ? ORDER BY name')
          .bind(filter.category)
      : this.db.prepare('SELECT * FROM providers ORDER BY name')
    const { results } = await query.all<ProviderRow>()
    return results.map(toProvider)
  }

  async get(id: string): Promise<Provider | null> {
    const row = await this.db
      .prepare('SELECT * FROM providers WHERE id = ?')
      .bind(id)
      .first<ProviderRow>()
    return row ? toProvider(row) : null
  }
}
