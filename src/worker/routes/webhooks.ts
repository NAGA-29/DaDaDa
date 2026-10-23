import { Hono } from 'hono'
import type { WebhookHandler } from '../adapters/webhook'
import type { ErrorResponse } from '../../shared/api'
import { toIncident } from '../domain/fingerprint'
import type { Bindings } from '../env'
import { IncidentRepository } from '../repositories/incident.repository'
import { ProviderRepository } from '../repositories/provider.repository'
import { registeredProviders } from '../sources'

/** Push 型 Source。MVP では未登録 */
const handlers: WebhookHandler[] = []

export const webhooksRoute = new Hono<{ Bindings: Bindings }>()

webhooksRoute.post('/:source', async c => {
  const handler = handlers.find(h => h.source === c.req.param('source'))
  if (!handler) return c.json<ErrorResponse>({ error: 'unknown webhook source' }, 404)
  if (!(await handler.verify(c.req.raw, c.env))) return c.json<ErrorResponse>({ error: 'unauthorized' }, 401)

  const now = new Date()
  const inputs = await handler.handle(await c.req.json(), now)
  await new ProviderRepository(c.env.DB).upsertMany(registeredProviders(), now)
  await new IncidentRepository(c.env.DB).upsertMany(await Promise.all(inputs.map(toIncident)), now)
  return c.json({ accepted: inputs.length })
})
