import { LanguageAdvisorySource } from '../language-advisories'

// Poll npm separately so the global Critical-only page cannot crowd it out.
export const npmSecurity = new LanguageAdvisorySource({
  ecosystem: 'npm',
  label: 'Node.js',
  providerId: 'nodejs',
  homepageUrl: 'https://nodejs.org',
})
