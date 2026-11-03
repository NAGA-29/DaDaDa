import { LanguageAdvisorySource } from '../language-advisories'

// A scoped collector adds High coverage and independent polling quotas. Reuse
// GitHub's reviewed Composer database instead of maintaining a duplicate feed.
export const composerSecurity = new LanguageAdvisorySource({
  ecosystem: 'composer',
  label: 'PHP',
  providerId: 'php',
  homepageUrl: 'https://www.php.net',
})
