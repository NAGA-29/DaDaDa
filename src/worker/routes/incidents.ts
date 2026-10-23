import { Hono } from 'hono'
import type { ErrorResponse, IncidentDetailResponse, IncidentListResponse } from '../../shared/api'
import type { IncidentKind } from '../domain/incident'
import type { Bindings } from '../env'
import { toIsoUtc } from '../lib/time'
import { IncidentRepository } from '../repositories/incident.repository'
import { ProviderRepository } from '../repositories/provider.repository'
import { toView } from '../services/incident.service'

export const incidentsRoute = new Hono<{ Bindings: Bindings }>()

const KINDS: IncidentKind[] = ['service', 'security']

incidentsRoute.get('/', async c => {
  const q = c.req.query()
  if (q.kind && !KINDS.includes(q.kind as IncidentKind)) {
    return c.json<ErrorResponse>({ error: `kind must be one of ${KINDS.join(', ')}` }, 400)
  }
  const limit = q.limit ? Number.parseInt(q.limit, 10) : undefined
  const page = await new IncidentRepository(c.env.DB).list({
    kind: q.kind as IncidentKind | undefined,
    providerId: q.provider,
    ecosystem: q.ecosystem,
    status: q.status,
    active: q.active === undefined ? undefined : q.active === 'true',
    from: toIsoUtc(q.from),
    to: toIsoUtc(q.to),
    cursor: q.cursor,
    limit: Number.isFinite(limit) ? limit : undefined,
  })
  return c.json<IncidentListResponse>({ items: page.items.map(toView), nextCursor: page.nextCursor })
})

incidentsRoute.get('/:id', async c => {
  const incident = await new IncidentRepository(c.env.DB).get(c.req.param('id'))
  if (!incident) return c.json<ErrorResponse>({ error: 'incident not found' }, 404)
  const provider = incident.providerId ? await new ProviderRepository(c.env.DB).get(incident.providerId) : null
  return c.json<IncidentDetailResponse>({ incident, provider })
})
