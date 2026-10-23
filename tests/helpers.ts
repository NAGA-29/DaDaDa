import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')
}

export function fixtureJson<T>(name: string): T {
  return JSON.parse(fixture(name)) as T
}

/** URL → fixture 名 の対応で応答する fetch。未登録 URL は 404 */
export function fakeFetch(routes: Record<string, string | (() => Response)>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const route = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1]
    if (!route) return new Response('not found', { status: 404 })
    if (typeof route === 'function') return route()
    return new Response(fixture(route), { status: 200 })
  }) as typeof fetch
}
