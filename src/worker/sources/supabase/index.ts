import { IncidentIoStatuspageAdapter } from '../../adapters/statuspage'

export const SUPABASE_STATUS_URL = 'https://status.supabase.com'

export const supabaseStatus = new IncidentIoStatuspageAdapter({
  provider: {
    id: 'supabase',
    name: 'Supabase',
    category: 'cloud',
    homepageUrl: 'https://supabase.com',
    statusUrl: SUPABASE_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: SUPABASE_STATUS_URL,
})
