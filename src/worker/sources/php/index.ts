import { parseAtom, type AtomEntry } from '../../adapters/atom'
import { fetchText } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import { extractCves, htmlToText } from '../../lib/text'
import { toIsoUtc } from '../../lib/time'
import type { IncidentSource, SourceContext } from '../types'

// php.net のニュース Atom から security release のみ拾う
const FEED_URL = 'https://www.php.net/feed.atom'

export function isPhpSecurityEntry(entry: AtomEntry): boolean {
  return /security/i.test(`${entry.title}\n${entry.summary ?? ''}\n${entry.content ?? ''}`)
}

export function normalizePhpEntry(
  source: string,
  entry: AtomEntry,
  now: Date,
): IncidentInput | undefined {
  const publishedAt = toIsoUtc(entry.published) ?? toIsoUtc(entry.updated)
  const url = entry.link ?? entry.id
  if (!publishedAt || !url) return undefined
  const body = entry.content ?? entry.summary
  return {
    providerId: 'php',
    kind: 'security',
    source,
    externalId: entry.id,
    title: entry.title,
    description: htmlToText(body),
    url,
    product: 'PHP',
    ecosystem: 'php',
    cves: extractCves(entry.title, body),
    publishedAt,
    updatedAt: toIsoUtc(entry.updated),
    collectedAt: now.toISOString(),
    raw: entry.raw,
  }
}

class PhpSecuritySource implements IncidentSource {
  readonly id = 'php-security'
  readonly type = 'atom'
  readonly group = 'security'
  readonly provider: Provider = {
    id: 'php',
    name: 'PHP',
    category: 'runtime',
    homepageUrl: 'https://www.php.net',
    supportsStatus: false,
    supportsSecurity: true,
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const entries = parseAtom(await fetchText(context.fetch, FEED_URL))
    return entries
      .filter(isPhpSecurityEntry)
      .map(e => normalizePhpEntry(this.id, e, context.now))
      .filter(i => i !== undefined)
  }
}

export const phpSecurity = new PhpSecuritySource()
