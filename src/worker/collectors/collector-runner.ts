import { toIncident } from '../domain/fingerprint'
import type { Incident } from '../domain/incident'
import type { ProviderStatus } from '../domain/provider-status'
import type { Bindings } from '../env'
import { IncidentRepository } from '../repositories/incident.repository'
import { ProviderRepository } from '../repositories/provider.repository'
import { ProviderStatusRepository } from '../repositories/provider-status.repository'
import { registeredProviders, sources as allSources } from '../sources'
import {
  isIncidentSource,
  isStatusSource,
  type Source,
  type SourceContext,
  type SourceGroup,
} from '../sources/types'

export type SourceRunResult = {
  sourceId: string
  ok: boolean
  incidents: number
  status?: ProviderStatus['status']
  error?: string
}

export type CollectorRunResult = {
  startedAt: string
  finishedAt: string
  groups: SourceGroup[]
  results: SourceRunResult[]
}

type Collected = {
  sourceId: string
  statuses: ProviderStatus[]
  incidents: Incident[]
}

async function collectOne(source: Source, context: SourceContext): Promise<Collected> {
  const [status, inputs] = await Promise.all([
    isStatusSource(source) ? source.collectStatus(context) : undefined,
    isIncidentSource(source) ? source.collect(context) : [],
  ])
  const incidents = await Promise.all(inputs.map(toIncident))
  // 同一 Source 内で ID が重複した場合は後勝ち
  const unique = [...new Map(incidents.map(i => [i.id, i])).values()]
  return { sourceId: source.id, statuses: status ? [status] : [], incidents: unique }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * 指定グループの Source を独立に収集して D1 へ保存する。
 * 1 Source の失敗 (取得・保存とも) は他へ波及させない。
 */
export async function runCollectors(
  env: Bindings,
  groups: SourceGroup[] = ['status', 'security'],
  options: { now?: Date; fetch?: typeof fetch; sources?: Source[] } = {},
): Promise<CollectorRunResult> {
  const now = options.now ?? new Date()
  const targets = (options.sources ?? allSources).filter(s => groups.includes(s.group))
  const context: SourceContext = {
    now,
    db: env.DB,
    fetch: options.fetch ?? fetch.bind(globalThis),
    env: { GITHUB_TOKEN: env.GITHUB_TOKEN },
  }

  // incidents.provider_id の FK を満たすため Provider を先に登録する
  await new ProviderRepository(env.DB).upsertMany(registeredProviders(), now)

  const statusRepo = new ProviderStatusRepository(env.DB)
  const incidentRepo = new IncidentRepository(env.DB)

  const settled = await Promise.allSettled(
    targets.map(async source => {
      const collected = await collectOne(source, context)
      await statusRepo.upsertMany(collected.statuses)
      await incidentRepo.upsertMany(collected.incidents, now)
      return collected
    }),
  )

  const results: SourceRunResult[] = settled.map((r, i) => {
    const sourceId = targets[i]!.id
    if (r.status === 'fulfilled') {
      return { sourceId, ok: true, incidents: r.value.incidents.length, status: r.value.statuses[0]?.status }
    }
    console.error(`[collector] ${sourceId} failed:`, r.reason)
    return { sourceId, ok: false, incidents: 0, error: errorMessage(r.reason) }
  })

  const result = { startedAt: now.toISOString(), finishedAt: new Date().toISOString(), groups, results }
  console.log('[collector] done', JSON.stringify(results))
  return result
}
