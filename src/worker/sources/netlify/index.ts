import { StatuspageAdapter } from '../../adapters/statuspage'

export const netlifyStatus = new StatuspageAdapter({
  provider: {
    id: 'netlify',
    name: 'Netlify',
    category: 'cloud',
    homepageUrl: 'https://www.netlify.com',
    statusUrl: 'https://www.netlifystatus.com',
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: 'https://www.netlifystatus.com',
})
