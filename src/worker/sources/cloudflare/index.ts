import { StatuspageAdapter } from '../../adapters/statuspage'

export const cloudflareStatus = new StatuspageAdapter({
  provider: {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'cloud',
    homepageUrl: 'https://www.cloudflare.com',
    statusUrl: 'https://www.cloudflarestatus.com',
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: 'https://www.cloudflarestatus.com',
})
