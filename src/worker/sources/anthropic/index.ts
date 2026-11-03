import { StatuspageAdapter } from '../../adapters/statuspage'

// status.anthropic.com は status.claude.com へ移転済み (Atlassian Statuspage)
export const ANTHROPIC_STATUS_URL = 'https://status.claude.com'

export const anthropicStatus = new StatuspageAdapter({
  provider: {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'ai',
    homepageUrl: 'https://www.anthropic.com',
    statusUrl: ANTHROPIC_STATUS_URL,
    supportsStatus: true,
    supportsSecurity: false,
  },
  baseUrl: ANTHROPIC_STATUS_URL,
})
