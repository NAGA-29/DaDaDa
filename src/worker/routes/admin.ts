import { Hono } from 'hono'
import type { ErrorResponse } from '../../shared/api'
import { runCollectors } from '../collectors/collector-runner'
import type { Bindings } from '../env'
import type { SourceGroup } from '../sources/types'

/** 手動収集。ADMIN_TOKEN が設定されているときだけ有効 */
export const adminRoute = new Hono<{ Bindings: Bindings }>()

adminRoute.post('/collect', async c => {
  const token = c.env.ADMIN_TOKEN
  if (!token || c.req.header('Authorization') !== `Bearer ${token}`) {
    return c.json<ErrorResponse>({ error: 'not found' }, 404)
  }
  const group = c.req.query('group') as SourceGroup | undefined
  const groups: SourceGroup[] = group === 'status' || group === 'security' ? [group] : ['status', 'security']
  return c.json(await runCollectors(c.env, groups))
})
