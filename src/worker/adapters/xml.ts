import { XMLParser } from 'fast-xml-parser'

const ARRAY_TAGS = new Set(['item', 'entry', 'link', 'category'])

const BASE_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name: string) => ARRAY_TAGS.has(name),
  processEntities: true,
  htmlEntities: true,
}

export const xmlParser = new XMLParser(BASE_OPTIONS)

/** Atom 用。content/summary は (x)html を壊さないよう生のまま受け取る */
export const atomParser = new XMLParser({ ...BASE_OPTIONS, stopNodes: ['feed.entry.content', 'feed.entry.summary'] })

/** `<title type="html">x</title>` のような要素からテキストを取り出す */
export function textOf(node: unknown): string | undefined {
  if (node === null || node === undefined) return undefined
  if (typeof node === 'string') return node.trim() || undefined
  if (typeof node === 'number' || typeof node === 'boolean') return String(node)
  if (Array.isArray(node)) return textOf(node[0])
  if (typeof node === 'object' && '#text' in node) return textOf((node as Record<string, unknown>)['#text'])
  return undefined
}
