import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import type { Bindings } from '../src/worker/env'
import worker from '../src/worker/index'

let proxy: Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>
let env: Bindings

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext

async function mcpRequest(id: number, method: string, params?: unknown) {
  return worker.fetch(
    new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Host: 'localhost',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
    }),
    env,
    executionContext,
  )
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const event = (await response.text()).split('\n').find(line => line.startsWith('data: '))
    if (!event) throw new Error('MCP response did not contain an event payload')
    return JSON.parse(event.slice('data: '.length)) as Record<string, unknown>
  }
  return (await response.json()) as Record<string, unknown>
}

beforeAll(async () => {
  proxy = await getPlatformProxy<Bindings>({ persist: false })
  env = proxy.env
  const sql = readFileSync(join(import.meta.dirname, '../migrations/0001_initial.sql'), 'utf8')
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean)
  await env.DB.batch(statements.map(statement => env.DB.prepare(statement)))

  await env.DB.prepare(
    `INSERT INTO providers (
      id, name, category, homepage_url, supports_status, supports_security, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      'example',
      'Example Service',
      'cloud',
      'https://example.com',
      1,
      0,
      '2026-11-01',
      '2026-11-01',
    )
    .run()

  await env.DB.prepare(
    `INSERT INTO incidents (
      id, provider_id, kind, source, title, description, url, status, severity,
      published_at, collected_at, raw_json, created_at, updated_record_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      'test-incident',
      'example',
      'service',
      'test',
      'Example outage',
      'Public incident description',
      'https://example.com/incidents/1',
      'investigating',
      null,
      '2026-11-06T00:00:00.000Z',
      '2026-11-06T00:00:00.000Z',
      JSON.stringify({ internalPayload: 'must not be exposed' }),
      '2026-11-06T00:00:00.000Z',
      '2026-11-06T00:00:00.000Z',
    )
    .run()
}, 60_000)

afterAll(async () => {
  await proxy?.dispose()
})

describe('MCP endpoint', () => {
  it('lists read-only DaDaDa tools over Streamable HTTP', async () => {
    const response = await mcpRequest(1, 'tools/list')
    expect(response.status, await response.clone().text()).toBe(200)
    const body = (await responseJson(response)) as { result?: { tools?: { name: string }[] } }
    expect(body.result?.tools?.map(tool => tool.name)).toEqual([
      'get_dashboard_summary',
      'list_providers',
      'list_current_statuses',
      'list_incidents',
      'get_provider_details',
    ])
  })

  it('returns bounded public incident data without raw upstream payloads', async () => {
    const response = await mcpRequest(2, 'tools/call', {
      name: 'list_incidents',
      arguments: { kind: 'service', limit: 10 },
    })
    expect(response.status, await response.clone().text()).toBe(200)
    const body = (await responseJson(response)) as {
      result?: { content?: { text?: string }[] }
    }
    const result = JSON.parse(body.result?.content?.[0]?.text ?? '{}') as {
      items?: Record<string, unknown>[]
    }
    expect(result.items).toHaveLength(1)
    expect(result.items?.[0]).toMatchObject({ id: 'test-incident', title: 'Example outage' })
    expect(result.items?.[0]).not.toHaveProperty('raw')
    expect(JSON.stringify(result)).not.toContain('must not be exposed')
  })
})
