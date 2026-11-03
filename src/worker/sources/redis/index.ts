import { collectRepoAdvisories } from '../repo-advisories'
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
  collect(context) {
    return collectRepoAdvisories(context, REDIS_ADVISORIES_URL, this.id, this.provider.id)
  },
}
