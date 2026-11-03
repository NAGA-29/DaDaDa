import { fetchJsonPage } from '../adapters/http'
import type { IncidentInput } from '../domain/incident'
import { githubHeaders, normalizeGithubAdvisory, type GithubAdvisory } from './github-advisory'
import type { SourceContext } from './types'

const MAX_PAGES = 5

// Collect every published advisory of one repository, with pagination. Lower-severity
// notices are kept too (with the upstream severity) so that an advisory downgraded
// from High is overwritten instead of lingering as a stale High row.
export async function collectRepoAdvisories(
  context: SourceContext,
  url: string,
  sourceId: string,
  providerId: string,
  extra: Partial<IncidentInput> = {},
): Promise<IncidentInput[]> {
  const first = new URL(url)
  let next: URL | undefined = first
  const result: IncidentInput[] = []
  for (let page = 0; page < MAX_PAGES && next; page++) {
    const { data: items, headers }: { data: GithubAdvisory[]; headers: Headers } =
      await fetchJsonPage<GithubAdvisory[]>(context.fetch, next.toString(), githubHeaders(context))
    for (const item of items) {
      result.push({
        ...normalizeGithubAdvisory(sourceId, item, context.now),
        providerId,
        ...extra,
      })
    }
    const link: string | undefined = /<([^>]+)>;\s*rel="next"/.exec(headers.get('Link') ?? '')?.[1]
    next = link ? new URL(link) : undefined
    // Never forward the token to a host or endpoint supplied by an untrusted Link header.
    if (
      next &&
      (next.origin !== first.origin ||
        next.pathname !== first.pathname ||
        next.username ||
        next.password)
    ) {
      throw new Error('Unexpected GitHub pagination URL')
    }
  }
  return result
}
