import { StatuspageAdapter } from '../../adapters/statuspage'

export const githubStatus = new StatuspageAdapter({
  provider: {
    id: 'github',
    name: 'GitHub',
    category: 'developer',
    homepageUrl: 'https://github.com',
    statusUrl: 'https://www.githubstatus.com',
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: 'https://www.githubstatus.com',
})
