import { textOf, xmlParser } from '../xml'

export type RssItem = {
  guid?: string
  title: string
  link?: string
  pubDate?: string
  description?: string
  raw: unknown
}

export function parseRss(xml: string): RssItem[] {
  const doc = xmlParser.parse(xml) as { rss?: { channel?: { item?: Record<string, unknown>[] } } }
  const items = doc.rss?.channel?.item ?? []
  return items.map(item => ({
    guid: textOf(item.guid),
    title: textOf(item.title) ?? '(untitled)',
    link: textOf(item.link),
    pubDate: textOf(item.pubDate) ?? textOf(item['dc:date']),
    description: textOf(item['content:encoded']) ?? textOf(item.description),
    raw: item,
  }))
}
