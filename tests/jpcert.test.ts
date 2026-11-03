import { describe, expect, it, vi } from 'vitest'
import { parseRss } from '../src/worker/adapters/rss'
import { incidentId } from '../src/worker/domain/fingerprint'
import { JPCERT_FEED_URL, jpcertSecurity, normalizeJpcertItem } from '../src/worker/sources/jpcert'
import type { SourceContext } from '../src/worker/sources/types'
import { fakeFetch, fixture } from './helpers'

const now = new Date('2026-10-23T10:30:00Z')

describe('JPCERT/CC RSS', () => {
  it('reads RDF sibling items, Japanese text, JST dates and CVEs without inferring severity', async () => {
    const context = {
      now,
      env: {},
      db: {
        batch: vi.fn<D1Database['batch']>(),
        exec: vi.fn<D1Database['exec']>(),
        dump: vi.fn<D1Database['dump']>(),
        withSession: vi.fn<D1Database['withSession']>(),
        prepare: vi
          .fn<D1Database['prepare']>()
          .mockReturnValue({ bind: () => ({ first: async () => null }) } as D1PreparedStatement),
      },
      fetch: fakeFetch({ [JPCERT_FEED_URL]: 'jpcert.rdf' }),
    } as SourceContext
    const notices = await jpcertSecurity.collect(context)
    expect(notices).toHaveLength(3)
    expect(notices[0]).toMatchObject({
      providerId: 'jpcert',
      source: 'jpcert-security',
      kind: 'security',
      cves: ['CVE-2026-55555', 'CVE-2026-55556'],
      publishedAt: '2026-10-23T07:25:00.000Z',
      updatedAt: '2026-10-23T07:25:00.000Z',
      raw: { 'dc:identifier': 'at260001' },
    })
    expect(notices[1]!.description).toBe('PHP & 関連製品に脆弱性')
    for (const notice of notices) {
      expect(notice.severity).toBeUndefined()
      expect(notice.ecosystem).toBeUndefined()
    }
    const ids = await Promise.all(notices.map(incidentId))
    expect(new Set(ids).size).toBe(3)
    const item = parseRss(fixture('jpcert.rdf'))[0]!
    const updated = normalizeJpcertItem({ ...item, pubDate: '2026-10-24T12:00+09:00' }, now)!
    expect(await incidentId(updated)).toBe(ids[0])
  })

  it('handles a single RDF item and an empty feed', () => {
    expect(parseRss('<rdf:RDF><item><title>single</title></item></rdf:RDF>')).toHaveLength(1)
    expect(parseRss('<rdf:RDF><channel/></rdf:RDF>')).toEqual([])
  })

  it('only collects named Developer Stack products, never CVEs alone or link text', () => {
    const items = parseRss(fixture('jpcert.rdf'))
    expect(items).toHaveLength(4)
    expect(normalizeJpcertItem(items[3]!, now)).toBeUndefined()
    const item = items[0]!
    for (const title of [
      'CVE-2026-11111 Critical',
      'Go to the security seminar',
      'Server update',
    ]) {
      expect(normalizeJpcertItem({ ...item, title }, now)).toBeUndefined()
    }
    expect(normalizeJpcertItem({ ...item, title: 'Node.js security update' }, now)).toBeDefined()
    expect(normalizeJpcertItem({ ...item, title: 'Linuxカーネルの脆弱性' }, now)).toBeUndefined()
  })

  it('rejects invalid dates and links', () => {
    const item = parseRss(fixture('jpcert.rdf'))[0]!
    expect(normalizeJpcertItem({ ...item, pubDate: 'invalid' }, now)).toBeUndefined()
    for (const link of [
      undefined,
      'invalid',
      'javascript:alert(1)',
      'https://www.jpcert.or.jp.evil.test/',
      'https://user@www.jpcert.or.jp/',
    ]) {
      expect(normalizeJpcertItem({ ...item, link }, now)).toBeUndefined()
    }
  })

  it('reports upstream failures and unexpected documents', async () => {
    const context = { now, env: {}, fetch: fakeFetch({}) } as SourceContext
    await expect(jpcertSecurity.collect(context)).rejects.toThrow('HTTP 404')
    await expect(
      jpcertSecurity.collect({
        ...context,
        fetch: fakeFetch({ [JPCERT_FEED_URL]: () => new Response('<html>error</html>') }),
      }),
    ).rejects.toThrow('Unexpected JPCERT/CC RSS format')
  })
})
