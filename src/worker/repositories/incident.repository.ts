import {
  HIDDEN_STATUSES,
  RESOLVED_STATUSES,
  type Incident,
  type IncidentKind,
} from '../domain/incident'

type IncidentRow = {
  id: string
  provider_id: string | null
  kind: string
  source: string
  external_id: string | null
  title: string
  description: string | null
  url: string
  status: string | null
  severity: string | null
  product: string | null
  ecosystem: string | null
  cves_json: string | null
  started_at: string | null
  published_at: string
  updated_at: string | null
  resolved_at: string | null
  collected_at: string
  raw_json?: string
}

export type IncidentFilter = {
  kind?: IncidentKind
  providerId?: string
  source?: string
  excludeSource?: string
  ecosystem?: string
  severity?: string
  unscored?: boolean
  status?: string
  /** true: 未解決のみ / false: 解決済みのみ */
  active?: boolean
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export type IncidentPage = {
  items: Incident[]
  nextCursor: string | null
}

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

const LIST_COLUMNS =
  'id, provider_id, kind, source, external_id, title, description, url, status, severity, product, ecosystem, cves_json, started_at, published_at, updated_at, resolved_at, collected_at'

const RESOLVED_SQL = RESOLVED_STATUSES.map(s => `'${s}'`).join(', ')
const HIDDEN_SQL = HIDDEN_STATUSES.map(s => `'${s}'`).join(', ')

function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    providerId: row.provider_id ?? undefined,
    kind: row.kind as IncidentKind,
    source: row.source,
    externalId: row.external_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    url: row.url,
    status: row.status ?? undefined,
    severity: row.severity ?? undefined,
    product: row.product ?? undefined,
    ecosystem: row.ecosystem ?? undefined,
    cves: row.cves_json ? (JSON.parse(row.cves_json) as string[]) : undefined,
    startedAt: row.started_at ?? undefined,
    publishedAt: row.published_at,
    updatedAt: row.updated_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    collectedAt: row.collected_at,
    raw: row.raw_json === undefined ? undefined : JSON.parse(row.raw_json),
  }
}

// cursor は [published_at, id] の JSON を base64url にしたもの
export function encodeCursor(incident: Pick<Incident, 'publishedAt' | 'id'>): string {
  const bytes = new TextEncoder().encode(JSON.stringify([incident.publishedAt, incident.id]))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function decodeCursor(cursor: string): { publishedAt: string; id: string } | null {
  try {
    const binary = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'))
    const json = new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)))
    const [publishedAt, id] = JSON.parse(json) as unknown[]
    return typeof publishedAt === 'string' && typeof id === 'string' ? { publishedAt, id } : null
  } catch {
    return null
  }
}

export class IncidentRepository {
  constructor(private readonly db: D1Database) {}

  /** id で upsert する。created_at は初回の値を保つ */
  async upsertMany(incidents: Incident[], now: Date): Promise<void> {
    if (!incidents.length) return
    const ts = now.toISOString()
    const stmt = this.db.prepare(
      `INSERT INTO incidents (
         id, provider_id, kind, source, external_id, title, description, url, status, severity, product, ecosystem,
         cves_json, started_at, published_at, updated_at, resolved_at, collected_at, raw_json, created_at, updated_record_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         provider_id = excluded.provider_id,
         title = excluded.title,
         description = excluded.description,
         url = excluded.url,
         status = excluded.status,
         severity = excluded.severity,
         product = excluded.product,
         ecosystem = excluded.ecosystem,
         cves_json = excluded.cves_json,
         started_at = excluded.started_at,
         published_at = excluded.published_at,
         updated_at = excluded.updated_at,
         resolved_at = excluded.resolved_at,
         collected_at = excluded.collected_at,
         raw_json = excluded.raw_json,
         updated_record_at = excluded.updated_record_at`,
    )
    const statements = incidents.map(i =>
      stmt.bind(
        i.id,
        i.providerId ?? null,
        i.kind,
        i.source,
        i.externalId || null,
        i.title,
        i.description ?? null,
        i.url,
        i.status ?? null,
        i.severity ?? null,
        i.product ?? null,
        i.ecosystem ?? null,
        i.cves?.length ? JSON.stringify(i.cves) : null,
        i.startedAt ?? null,
        i.publishedAt,
        i.updatedAt ?? null,
        i.resolvedAt ?? null,
        i.collectedAt,
        JSON.stringify(i.raw ?? null),
        ts,
        ts,
      ),
    )
    // D1 の batch は 1 トランザクション。大きくしすぎないよう分割する
    for (let i = 0; i < statements.length; i += 50) {
      await this.db.batch(statements.slice(i, i + 50))
    }
  }

  async list(filter: IncidentFilter = {}): Promise<IncidentPage> {
    const where: string[] = []
    const params: unknown[] = []
    const add = (clause: string, ...values: unknown[]) => {
      where.push(clause)
      params.push(...values)
    }

    if (filter.kind) add('kind = ?', filter.kind)
    if (filter.providerId) add('provider_id = ?', filter.providerId)
    if (filter.source) add('source = ?', filter.source)
    if (filter.excludeSource) add('source != ?', filter.excludeSource)
    if (filter.ecosystem) add('ecosystem = ?', filter.ecosystem)
    if (filter.severity) add('severity = ?', filter.severity)
    if (filter.unscored) add("(severity IS NULL OR severity = 'unknown')")
    // withdrawn などの非表示 status は、明示的に指定されたときだけ返す
    if (filter.status) add('status = ?', filter.status)
    else add(`(status IS NULL OR status NOT IN (${HIDDEN_SQL}))`)
    if (filter.active === true)
      add(`resolved_at IS NULL AND (status IS NULL OR status NOT IN (${RESOLVED_SQL}))`)
    if (filter.active === false) add(`(resolved_at IS NOT NULL OR status IN (${RESOLVED_SQL}))`)
    if (filter.from) add('published_at >= ?', filter.from)
    if (filter.to) add('published_at <= ?', filter.to)
    if (filter.cursor) {
      const c = decodeCursor(filter.cursor)
      if (c)
        add(
          '(published_at < ? OR (published_at = ? AND id < ?))',
          c.publishedAt,
          c.publishedAt,
          c.id,
        )
    }

    const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const sql = `SELECT ${LIST_COLUMNS} FROM incidents
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY published_at DESC, id DESC
      LIMIT ?`
    const { results } = await this.db
      .prepare(sql)
      .bind(...params, limit + 1)
      .all<IncidentRow>()

    const items = results.slice(0, limit).map(toIncident)
    const last = items.at(-1)
    return { items, nextCursor: results.length > limit && last ? encodeCursor(last) : null }
  }

  /** 詳細取得。raw も含める */
  async get(id: string): Promise<Incident | null> {
    const row = await this.db
      .prepare('SELECT * FROM incidents WHERE id = ?')
      .bind(id)
      .first<IncidentRow>()
    return row ? toIncident(row) : null
  }
}
