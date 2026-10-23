import type { SourceGroup } from '../sources/types'

/** wrangler.jsonc の triggers.crons と対応させる */
export const CRON_GROUPS: Record<string, SourceGroup[]> = {
  '*/5 * * * *': ['status'],
  '*/30 * * * *': ['security'],
}

export function groupsForCron(cron: string): SourceGroup[] {
  return CRON_GROUPS[cron] ?? ['status', 'security']
}
