import { IncidentIoStatuspageAdapter } from '../../adapters/statuspage'

// status.openai.com は incident.io。Statuspage 互換 API を使う
export const OPENAI_STATUS_URL = 'https://status.openai.com'

export const openaiStatus = new IncidentIoStatuspageAdapter({
  provider: {
    id: 'openai',
    name: 'OpenAI',
    category: 'ai',
    homepageUrl: 'https://openai.com',
    statusUrl: OPENAI_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: OPENAI_STATUS_URL,
})
