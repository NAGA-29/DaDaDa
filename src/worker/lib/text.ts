const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#?\w+);/g, (m, name: string) => {
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
    return ENTITIES[name] ?? m
  })
}

/** HTML を素のテキストにする (表示用の簡易版。raw は別に保存する) */
export function htmlToText(html: string | undefined, maxLength = 2000): string | undefined {
  if (!html) return undefined
  const stripped = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  const text = decodeEntities(stripped)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  if (!text) return undefined
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function extractCves(...texts: (string | undefined)[]): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    for (const m of text?.matchAll(/CVE-\d{4}-\d{4,}/gi) ?? []) found.add(m[0].toUpperCase())
  }
  return [...found]
}
