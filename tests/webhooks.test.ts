import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { IncidentListResponse } from '../src/shared/api'
import type { WebhookHandler } from '../src/worker/adapters/webhook'
import type { IncidentInput } from '../src/worker/domain/incident'
import type { Bindings } from '../src/worker/env'
import { createWebhooksRoute } from '../src/worker/routes/webhooks'
import { createWorkerEnv, getJson, request, type WorkerEnv } from './worker-env'

const TOKEN = 'secret-token'

const input = (externalId: string): IncidentInput => ({
  providerId: 'aws',
  kind: 'service',
  source: 'test-hook',
  externalId,
  title: `Event ${externalId}`,
  url: `https://example.com/${externalId}`,
  status: 'investigating',
  publishedAt: '2026-11-06T00:00:00.000Z',
  collectedAt: '2026-11-06T00:00:00.000Z',
  raw: { externalId },
})

const handler: WebhookHandler = {
  source: 'test-hook',
  async verify(request) {
    return request.headers.get('Authorization') === `Bearer ${TOKEN}`
  },
  async handle(payload) {
    const events = (payload as { events?: string[] }).events ?? []
    return events.map(input)
  },
}

let worker: WorkerEnv
let env: Bindings
const app = new Hono<{ Bindings: Bindings }>().route(
  '/api/webhooks',
  createWebhooksRoute([handler]),
)

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    env,
  )
}

beforeAll(async () => {
  worker = await createWorkerEnv()
  env = worker.env
}, 60_000)

afterAll(async () => {
  await worker?.dispose()
})

describe('POST /api/webhooks/:source', () => {
  it('returns 404 for an unknown source', async () => {
    const res = await post('/api/webhooks/unknown', { events: ['a'] })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'unknown webhook source' })
  })

  it('returns 401 when verification fails and stores nothing', async () => {
    for (const headers of [{} as Record<string, string>, { Authorization: 'Bearer wrong' }]) {
      const res = await post('/api/webhooks/test-hook', { events: ['denied'] }, headers)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    const { body } = await getJson<IncidentListResponse>(env, '/api/incidents')
    expect(body.items).toEqual([])
  })

  it('accepts a verified payload and stores the incidents', async () => {
    const res = await post(
      '/api/webhooks/test-hook',
      { events: ['one', 'two'] },
      { Authorization: `Bearer ${TOKEN}` },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ accepted: 2 })

    const { body } = await getJson<IncidentListResponse>(env, '/api/incidents?kind=service')
    expect(body.items.map(i => i.externalId).sort()).toEqual(['one', 'two'])
  })

  it('is idempotent: re-sending the same event updates instead of duplicating', async () => {
    const headers = { Authorization: `Bearer ${TOKEN}` }
    await post('/api/webhooks/test-hook', { events: ['one'] }, headers)
    await post('/api/webhooks/test-hook', { events: ['one'] }, headers)
    const { body } = await getJson<IncidentListResponse>(env, '/api/incidents')
    expect(body.items.filter(i => i.externalId === 'one')).toHaveLength(1)
  })

  it('accepts an empty batch', async () => {
    const res = await post(
      '/api/webhooks/test-hook',
      { events: [] },
      { Authorization: `Bearer ${TOKEN}` },
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ accepted: 0 })
  })

  it('only allows POST', async () => {
    const res = await app.request('/api/webhooks/test-hook', { method: 'GET' }, env)
    expect(res.status).toBe(404)
  })
})

describe('production webhook route', () => {
  it('has no registered sources in the MVP, so every source is 404', async () => {
    const res = await request(env, '/api/webhooks/aws-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'unknown webhook source' })
  })
})
