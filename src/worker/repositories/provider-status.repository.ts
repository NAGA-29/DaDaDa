import type { ProviderStatus, ProviderStatusValue } from '../domain/provider-status'

type ProviderStatusRow = {
  provider_id: string
  status: string
  message: string | null
  checked_at: string
}

function toProviderStatus(row: ProviderStatusRow): ProviderStatus {
  return {
    providerId: row.provider_id,
    status: row.status as ProviderStatusValue,
    message: row.message ?? undefined,
    checkedAt: row.checked_at,
  }
}

export class ProviderStatusRepository {
  constructor(private readonly db: D1Database) {}

  async upsertMany(statuses: ProviderStatus[]): Promise<void> {
    if (!statuses.length) return
    const stmt = this.db.prepare(
      `INSERT INTO provider_statuses (provider_id, status, message, checked_at, raw_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(provider_id) DO UPDATE SET
         status = excluded.status,
         message = excluded.message,
         checked_at = excluded.checked_at,
         raw_json = excluded.raw_json`,
    )
    await this.db.batch(
      statuses.map(s =>
        stmt.bind(s.providerId, s.status, s.message ?? null, s.checkedAt, s.raw === undefined ? null : JSON.stringify(s.raw)),
      ),
    )
  }

  async list(): Promise<ProviderStatus[]> {
    const { results } = await this.db
      .prepare('SELECT provider_id, status, message, checked_at FROM provider_statuses')
      .all<ProviderStatusRow>()
    return results.map(toProviderStatus)
  }

  async get(providerId: string): Promise<ProviderStatus | null> {
    const row = await this.db
      .prepare('SELECT provider_id, status, message, checked_at FROM provider_statuses WHERE provider_id = ?')
      .bind(providerId)
      .first<ProviderStatusRow>()
    return row ? toProviderStatus(row) : null
  }
}
