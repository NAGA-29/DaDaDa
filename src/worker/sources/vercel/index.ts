import { StatuspageAdapter } from '../../adapters/statuspage'

export const vercelStatus = new StatuspageAdapter({
  provider: {
    id: 'vercel',
    name: 'Vercel',
    category: 'cloud',
    homepageUrl: 'https://vercel.com',
    statusUrl: 'https://www.vercel-status.com',
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: 'https://www.vercel-status.com',
})
