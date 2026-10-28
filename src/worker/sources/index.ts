import type { Provider } from '../domain/provider'
import { anthropicStatus } from './anthropic'
import { awsNotices } from './aws'
import { azureNotices } from './azure'
import { cisaKev } from './cisa-kev'
import { cloudflareStatus } from './cloudflare'
import { geminiStatus } from './gemini'
import { githubAdvisory } from './github-advisory'
import { githubStatus } from './github-status'
import { jpcertSecurity } from './jpcert'
import { googleCloudStatus } from './google-cloud'
import { languageAdvisories } from './language-advisories'
import { railwayStatus } from './railway'
import { runtimeSecuritySources } from './runtime-security'
import { sakuraNotices } from './sakura'
import { netlifyStatus } from './netlify'
import { nodejsSecurity } from './nodejs'
import { openaiStatus } from './openai'
import { phpSecurity } from './php'
import type { Source, SourceGroup } from './types'
import { supabaseStatus } from './supabase'
import { vercelStatus } from './vercel'

/** 登録済み Source。追加はここに 1 行足すだけ */
export const sources: Source[] = [
  // Status
  awsNotices,
  azureNotices,
  cloudflareStatus,
  githubStatus,
  vercelStatus,
  netlifyStatus,
  railwayStatus,
  supabaseStatus,
  sakuraNotices,
  googleCloudStatus,
  // Status (AI)
  openaiStatus,
  anthropicStatus,
  geminiStatus,
  // Security
  phpSecurity,
  nodejsSecurity,
  githubAdvisory,
  ...languageAdvisories,
  ...runtimeSecuritySources,
  cisaKev,
  jpcertSecurity,
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
