const USER_AGENT = 'DaDaDa/0.1 (+https://github.com/naga-29/dadada)'
const DEFAULT_TIMEOUT_MS = 15_000

export class SourceFetchError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} failed with HTTP ${status}`)
  }
}

async function get(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const res = await fetcher(url, {
    headers: { 'User-Agent': USER_AGENT, ...headers },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) throw new SourceFetchError(url, res.status)
  return res
}

export async function fetchJson<T>(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await get(fetcher, url, { Accept: 'application/json', ...headers })
  return (await res.json()) as T
}

export async function fetchText(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const res = await get(fetcher, url, headers)
  return res.text()
}
