import { Hono } from 'hono'
import type { ErrorResponse, ProviderDetailResponse, ProviderListResponse } from '../../shared/api'
import type { Bindings } from '../env'
import { ProviderRepository } from '../repositories/provider.repository'
import { getProviderDetail } from '../services/incident.service'

export const providersRoute = new Hono<{ Bindings: Bindings }>()

providersRoute.get('/', async c => {
  const items = await new ProviderRepository(c.env.DB).list({ category: c.req.query('category') })
  return c.json<ProviderListResponse>({ items })
})

providersRoute.get('/:id', async c => {
  const detail = await getProviderDetail(c.env.DB, c.req.param('id'))
  if (!detail) return c.json<ErrorResponse>({ error: 'provider not found' }, 404)
  return c.json<ProviderDetailResponse>(detail)
})
