import type { ProviderWithStatus } from '../../shared/api'
import { ProviderRepository } from '../repositories/provider.repository'
import { ProviderStatusRepository } from '../repositories/provider-status.repository'

export async function listProviderStatuses(
  db: D1Database,
  filter: { category?: string; status?: string } = {},
): Promise<ProviderWithStatus[]> {
  const [providers, statuses] = await Promise.all([
    new ProviderRepository(db).list({ category: filter.category }),
    new ProviderStatusRepository(db).list(),
  ])
  const byProvider = new Map(statuses.map(s => [s.providerId, s]))
  return providers
    .filter(p => p.supportsStatus)
    .map(p => ({ ...p, currentStatus: byProvider.get(p.id) ?? null }))
    .filter(p => !filter.status || (p.currentStatus?.status ?? 'unknown') === filter.status)
}
