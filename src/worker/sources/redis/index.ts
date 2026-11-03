import { fetchJson } from '../../adapters/http'
import { githubHeaders, normalizeGithubAdvisory, type GithubAdvisory } from '../github-advisory'
import type { IncidentSource } from '../types'

export const REDIS_ADVISORIES_URL =
  'https://api.github.com/repos/redis/redis/security-advisories?per_page=100'

export const redisSecurity: IncidentSource = {
  id: 'redis-security',
  type: 'api',
  group: 'security',
  provider: {
    id: 'redis',
    name: 'Redis',
    category: 'database',
    homepageUrl: 'https://redis.io',
    supportsStatus: false,
    supportsSecurity: true,
  },
  async collect(context) {
    const items = await fetchJson<GithubAdvisory[]>(
      context.fetch,
      REDIS_ADVISORIES_URL,
      githubHeaders(context),
    )
    return items
      .filter(item => ['high', 'critical'].includes(item.severity) || item.withdrawn_at)
      .map(item => ({
        ...normalizeGithubAdvisory(this.id, item, context.now),
        providerId: this.provider.id,
      }))
  },
}
