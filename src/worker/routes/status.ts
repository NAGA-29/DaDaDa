import { Hono } from 'hono'
import type { StatusListResponse } from '../../shared/api'
import type { Bindings } from '../env'
import { listProviderStatuses } from '../services/status.service'

export const statusRoute = new Hono<{ Bindings: Bindings }>()

statusRoute.get('/', async c => {
  const items = await listProviderStatuses(c.env.DB, {
    category: c.req.query('category'),
    status: c.req.query('status'),
  })
  return c.json<StatusListResponse>({ items })
})
