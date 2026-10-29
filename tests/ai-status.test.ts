import { describe, expect, it } from 'vitest'
import { registeredProviders } from '../src/worker/sources'
import { ANTHROPIC_STATUS_URL, anthropicStatus } from '../src/worker/sources/anthropic'
import { geminiStatus, isGeminiIncident } from '../src/worker/sources/gemini'
import type { GcpIncident } from '../src/worker/sources/google-cloud'
import { OPENAI_STATUS_URL, openaiStatus } from '../src/worker/sources/openai'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixtureJson } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')
const context = (fetcher: typeof fetch) => ({ now, env: {}, fetch: fetcher }) as SourceContext

describe('AI status sources', () => {
  it('registers OpenAI / Anthropic / Google Gemini in the ai category', () => {
    const ai = registeredProviders().filter(p => p.category === 'ai')
    expect(ai.map(p => p.id)).toEqual(['openai', 'anthropic', 'google-gemini'])
    expect(ai.every(p => p.supportsStatus && !p.supportsSecurity)).toBe(true)
  })

  it('collects Anthropic through the Statuspage API', async () => {
    const ctx = context(
      fakeFetch({
        [`${ANTHROPIC_STATUS_URL}/api/v2/summary.json`]: 'statuspage-summary.json',
        [`${ANTHROPIC_STATUS_URL}/api/v2/incidents.json`]: 'statuspage-incidents.json',
      }),
    )
    expect(await anthropicStatus.collectStatus(ctx)).toMatchObject({
      providerId: 'anthropic',
      status: 'partial_outage',
    })
    const incidents = await anthropicStatus.collect(ctx)
    expect(incidents).toHaveLength(2)
    expect(incidents[0]).toMatchObject({ providerId: 'anthropic', source: 'anthropic-status' })
  })

  it('reflects unresolved OpenAI incidents even when incident.io reports indicator=none', async () => {
    const ctx = context(
      fakeFetch({
        [`${OPENAI_STATUS_URL}/api/v2/summary.json`]: () =>
          Response.json({
            status: { indicator: 'none', description: 'All Systems Operational' },
            components: [{ id: 'c1', name: 'ChatGPT', status: 'operational' }],
            incidents: [
              {
                id: 'oai-1',
                name: 'Elevated errors on ChatGPT',
                status: 'investigating',
                impact: 'major',
                created_at: '2026-10-23T10:00:00Z',
              },
              {
                id: 'oai-0',
                name: 'Old incident',
                status: 'resolved',
                impact: 'critical',
                created_at: '2026-10-20T10:00:00Z',
                resolved_at: '2026-10-20T11:00:00Z',
              },
            ],
          }),
      }),
    )
    expect(await openaiStatus.collectStatus(ctx)).toMatchObject({
      providerId: 'openai',
      status: 'partial_outage',
      message: 'Elevated errors on ChatGPT',
    })
  })

  it('rejects an OpenAI summary without incidents', async () => {
    const ctx = context(
      fakeFetch({
        [`${OPENAI_STATUS_URL}/api/v2/summary.json`]: () =>
          Response.json({ status: { indicator: 'none', description: 'ok' } }),
      }),
    )
    await expect(openaiStatus.collectStatus(ctx)).rejects.toThrow(
      'Unexpected OpenAI summary format',
    )
  })

  it('derives Google Gemini from Gemini products on the Google Cloud feed', async () => {
    const fixture = fixtureJson<GcpIncident[]>('gcp-gemini-incidents.json')
    expect(fixture.filter(isGeminiIncident).map(i => i.id)).toEqual([
      'gcpGeminiActive1',
      'gcpGeminiOld1',
    ])

    const ctx = context(
      fakeFetch({ 'https://status.cloud.google.com/incidents.json': 'gcp-gemini-incidents.json' }),
    )
    expect(await geminiStatus.collectStatus(ctx)).toMatchObject({
      providerId: 'google-gemini',
      status: 'major_outage',
      message: '1 active incident',
    })
    const [active, old] = await geminiStatus.collect(ctx)
    expect(active).toMatchObject({
      providerId: 'google-gemini',
      source: 'google-gemini-status',
      externalId: 'gcpGeminiActive1',
      product: 'Vertex Gemini API',
      url: 'https://status.cloud.google.com/incidents/gcpGeminiActive1',
    })
    expect(old).toMatchObject({ status: 'resolved', resolvedAt: '2026-10-10T01:00:00.000Z' })
  })

  it('reports Gemini as operational when no Gemini incident is active', async () => {
    const ctx = context(
      fakeFetch({ 'https://status.cloud.google.com/incidents.json': 'gcp-incidents.json' }),
    )
    expect((await geminiStatus.collectStatus(ctx)).status).toBe('operational')
    expect(await geminiStatus.collect(ctx)).toEqual([])
  })
})
