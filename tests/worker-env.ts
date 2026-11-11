import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import type { Bindings } from '../src/worker/env'
import worker from '../src/worker/index'

export type WorkerEnv = {
  env: Bindings
  dispose(): Promise<void>
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext

/** インメモリ D1 を起動してマイグレーションを適用する */
export async function createWorkerEnv(): Promise<WorkerEnv> {
  const proxy = await getPlatformProxy<Bindings>({ persist: false })
  const sql = readFileSync(join(import.meta.dirname, '../migrations/0001_initial.sql'), 'utf8')
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean)
  await proxy.env.DB.batch(statements.map(statement => proxy.env.DB.prepare(statement)))
  return { env: proxy.env, dispose: () => proxy.dispose() }
}

export async function request(env: Bindings, path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(new Request(`http://localhost${path}`, init), env, executionContext)
}

export async function getJson<T>(
  env: Bindings,
  path: string,
): Promise<{ status: number; body: T }> {
  const res = await request(env, path)
  return { status: res.status, body: (await res.json()) as T }
}

type ProviderSeed = {
  id: string
  name: string
  category: string
  supportsStatus?: boolean
  supportsSecurity?: boolean
  statusUrl?: string
}

export async function seedProviders(env: Bindings, providers: ProviderSeed[]): Promise<void> {
  const ts = '2026-11-01T00:00:00.000Z'
  await env.DB.batch(
    providers.map(p =>
      env.DB.prepare(
        `INSERT INTO providers (
           id, name, category, homepage_url, status_url, supports_status, supports_security, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        p.id,
        p.name,
        p.category,
        `https://${p.id}.example.com`,
        p.statusUrl ?? null,
        p.supportsStatus ? 1 : 0,
        p.supportsSecurity ? 1 : 0,
        ts,
        ts,
      ),
    ),
  )
}

export async function seedStatuses(
  env: Bindings,
  statuses: { providerId: string; status: string; checkedAt: string; message?: string }[],
): Promise<void> {
  await env.DB.batch(
    statuses.map(s =>
      env.DB.prepare(
        'INSERT INTO provider_statuses (provider_id, status, message, checked_at, raw_json) VALUES (?, ?, ?, ?, ?)',
      ).bind(s.providerId, s.status, s.message ?? null, s.checkedAt, '{}'),
    ),
  )
}

export type IncidentSeed = {
  id: string
  kind: 'service' | 'security'
  source?: string
  providerId?: string
  title?: string
  status?: string
  severity?: string
  ecosystem?: string
  externalId?: string
  startedAt?: string
  publishedAt: string
  resolvedAt?: string
  raw?: unknown
}

export async function seedIncidents(env: Bindings, incidents: IncidentSeed[]): Promise<void> {
  await env.DB.batch(
    incidents.map(i =>
      env.DB.prepare(
        `INSERT INTO incidents (
           id, provider_id, kind, source, external_id, title, url, status, severity, ecosystem,
           started_at, published_at, resolved_at, collected_at, raw_json, created_at, updated_record_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        i.id,
        i.providerId ?? null,
        i.kind,
        i.source ?? 'test',
        i.externalId ?? null,
        i.title ?? i.id,
        `https://example.com/${i.id}`,
        i.status ?? null,
        i.severity ?? null,
        i.ecosystem ?? null,
        i.startedAt ?? null,
        i.publishedAt,
        i.resolvedAt ?? null,
        i.publishedAt,
        JSON.stringify(i.raw ?? { secret: 'raw-only' }),
        i.publishedAt,
        i.publishedAt,
      ),
    ),
  )
}
