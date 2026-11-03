import { collectRepoAdvisories } from '../repo-advisories'
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
  collect(context) {
    return collectRepoAdvisories(context, LARAVEL_ADVISORIES_URL, this.id, this.provider.id, {
      ecosystem: 'laravel',
    })
  },
}
