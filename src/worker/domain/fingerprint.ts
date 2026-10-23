import type { Incident, IncidentInput } from './incident'

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.search = ''
    u.hostname = u.hostname.toLowerCase()
    return u.toString().replace(/\/$/, '')
  } catch {
    return url.trim()
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Incident の安定 ID を決める。
 * - externalId あり: `source:externalId`
 * - なし: SHA-256(source + canonicalUrl + normalizedTitle + publishedDate)
 */
export async function incidentId(input: Pick<IncidentInput, 'source' | 'externalId' | 'url' | 'title' | 'publishedAt'>): Promise<string> {
  if (input.externalId) return `${input.source}:${input.externalId}`
  const publishedDate = input.publishedAt.slice(0, 10)
  const hash = await sha256Hex(
    [input.source, canonicalUrl(input.url), normalizeTitle(input.title), publishedDate].join('\n'),
  )
  return `${input.source}:fp:${hash.slice(0, 32)}`
}

export async function toIncident(input: IncidentInput): Promise<Incident> {
  return { ...input, id: await incidentId(input) }
}
