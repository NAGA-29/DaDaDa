import { SECURITY_LANGUAGES } from '../../../shared/security'
import { fetchJsonPage } from '../../adapters/http'
import type { IncidentInput } from '../../domain/incident'
import type { Provider } from '../../domain/provider'
import { githubHeaders, normalizeGithubAdvisory, type GithubAdvisory } from '../github-advisory'
import type { IncidentSource, SourceContext } from '../types'

type Language = (typeof SECURITY_LANGUAGES)[number]

export function languageProvider(language: Language): Provider {
  return {
    id: language.providerId,
    name: language.label,
    category: 'runtime',
    homepageUrl: language.homepageUrl,
    supportsStatus: false,
    supportsSecurity: true,
  }
}

export class LanguageAdvisorySource implements IncidentSource {
  readonly type = 'api'
  readonly group = 'security'
  readonly id: string
  readonly provider: Provider

  constructor(readonly language: Language) {
    this.id = `github-advisory-${language.ecosystem}`
    this.provider = languageProvider(language)
  }

  async collect(context: SourceContext): Promise<IncidentInput[]> {
    const result = new Map<string, IncidentInput>()
    // Independent severity requests keep High traffic from crowding out Critical.
    // Each severity polls the latest 200 updated records, including old CVEs and withdrawals.
    for (const severity of ['critical', 'high']) {
      const first = new URL('https://api.github.com/advisories')
      first.search = new URLSearchParams({
        type: 'reviewed',
        ecosystem: this.language.ecosystem,
        severity,
        sort: 'updated',
        direction: 'desc',
        per_page: '100',
      }).toString()
      let next: URL | undefined = first
      for (let page = 0; page < 2 && next; page++) {
        const { data: items, headers }: { data: GithubAdvisory[]; headers: Headers } =
          await fetchJsonPage<GithubAdvisory[]>(
            context.fetch,
            next.toString(),
            githubHeaders(context),
          )
        for (const item of items) {
          if (!['high', 'critical'].includes(item.severity)) continue
          const packages =
            item.vulnerabilities?.flatMap(v =>
              v.package?.ecosystem === this.language.ecosystem ? [v.package] : [],
            ) ?? []
          if (!packages.length) continue
          result.set(item.ghsa_id, {
            ...normalizeGithubAdvisory(this.id, item, context.now),
            providerId: this.provider.id,
            ecosystem: this.language.ecosystem,
            product: [...new Set(packages.map(p => p.name))].join(', '),
          })
        }
        const link: string | undefined = /<([^>]+)>;\s*rel="next"/.exec(
          headers.get('Link') ?? '',
        )?.[1]
        next = link ? new URL(link) : undefined
        // Never forward the token to a host or endpoint supplied by an untrusted Link header.
        if (
          next &&
          (next.origin !== 'https://api.github.com' ||
            next.pathname !== '/advisories' ||
            next.username ||
            next.password)
        ) {
          throw new Error('Unexpected GitHub pagination URL')
        }
      }
    }
    return [...result.values()]
  }
}

export const languageAdvisories = SECURITY_LANGUAGES.map(
  language => new LanguageAdvisorySource(language),
)
