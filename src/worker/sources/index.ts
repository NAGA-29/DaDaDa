import type { Provider } from '../domain/provider'
import { cisaKev } from './cisa-kev'
import { cloudflareStatus } from './cloudflare'
import { githubAdvisory } from './github-advisory'
import { githubStatus } from './github-status'
import { googleCloudStatus } from './google-cloud'
import { languageAdvisories } from './language-advisories'
import { runtimeSecuritySources } from './runtime-security'
import { sakuraNotices } from './sakura'
import { netlifyStatus } from './netlify'
import { nodejsSecurity } from './nodejs'
import { phpSecurity } from './php'
import type { Source, SourceGroup } from './types'
import { vercelStatus } from './vercel'

/** 登録済み Source。追加はここに 1 行足すだけ */
export const sources: Source[] = [
  // Status
  cloudflareStatus,
  githubStatus,
  vercelStatus,
  netlifyStatus,
  sakuraNotices,
  googleCloudStatus,
  // Security
  phpSecurity,
  nodejsSecurity,
  githubAdvisory,
  ...languageAdvisories,
  ...runtimeSecuritySources,
  cisaKev,
]

export function sourcesFor(group: SourceGroup): Source[] {
  return sources.filter(s => s.group === group)
}

/** Source から Provider 一覧を作る (同じ Provider を持つ Source が複数あれば supports* を合成) */
export function registeredProviders(): Provider[] {
  const byId = new Map<string, Provider>()
  for (const { provider } of sources) {
    const existing = byId.get(provider.id)
    byId.set(
      provider.id,
      existing
        ? {
            ...existing,
            supportsStatus: existing.supportsStatus || provider.supportsStatus,
            supportsSecurity: existing.supportsSecurity || provider.supportsSecurity,
          }
        : provider,
    )
  }
  return [...byId.values()]
}
