import { fetchJson } from '../../adapters/http'
import { githubHeaders, normalizeGithubAdvisory, type GithubAdvisory } from '../github-advisory'
import type { IncidentSource } from '../types'

export const LARAVEL_ADVISORIES_URL =
  'https://api.github.com/repos/laravel/framework/security-advisories?per_page=100'

export const laravelSecurity: IncidentSource = {
  id: 'laravel-security',
  type: 'api',
  group: 'security',
  provider: {
    id: 'laravel',
    name: 'Laravel',
    category: 'runtime',
    homepageUrl: 'https://laravel.com',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const items = await fetchJson<GithubAdvisory[]>(
      context.fetch,
      LARAVEL_ADVISORIES_URL,
      githubHeaders(context),
    )
    return items
      .filter(item => ['high', 'critical'].includes(item.severity) || item.withdrawn_at)
      .map(item => ({
        ...normalizeGithubAdvisory(this.id, item, context.now),
        providerId: this.provider.id,
        ecosystem: 'composer',
      }))
  },
}
