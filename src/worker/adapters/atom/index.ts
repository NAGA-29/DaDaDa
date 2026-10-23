import { decodeEntities } from '../../lib/text'
import { atomParser, textOf } from '../xml'

export type AtomEntry = {
  id?: string
  title: string
  link?: string
  published?: string
  updated?: string
  summary?: string
  content?: string
  raw: unknown
}

type AtomLink = { '@_href'?: string; '@_rel'?: string }

/** type="html" はエスケープされた HTML、type="xhtml" はそのままの HTML として返す */
function markupOf(node: unknown): string | undefined {
  const text = textOf(node)
  if (!text) return undefined
  const type = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)['@_type'] : undefined
  return type === 'xhtml' ? text : decodeEntities(text)
}

function pickLink(links: AtomLink[] | undefined): string | undefined {
  if (!links?.length) return undefined
  const alternate = links.find(l => !l['@_rel'] || l['@_rel'] === 'alternate')
  return (alternate ?? links[0])?.['@_href']
}

export function parseAtom(xml: string): AtomEntry[] {
  const doc = atomParser.parse(xml) as { feed?: { entry?: Record<string, unknown>[] } }
  const entries = doc.feed?.entry ?? []
  return entries.map(entry => ({
    id: textOf(entry.id),
    title: textOf(entry.title) ?? '(untitled)',
    link: pickLink(entry.link as AtomLink[] | undefined),
    published: textOf(entry.published),
    updated: textOf(entry.updated),
    summary: markupOf(entry.summary),
    content: markupOf(entry.content),
    raw: entry,
  }))
}
