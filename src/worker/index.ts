import { Hono } from 'hono'
import type { ErrorResponse, HealthResponse, SummaryResponse } from '../shared/api'
import { runCollectors } from './collectors/collector-runner'
import { groupsForCron } from './collectors/schedule'
import type { Bindings } from './env'
import { adminRoute } from './routes/admin'
import { incidentsRoute } from './routes/incidents'
import { providersRoute } from './routes/providers'
import { statusRoute } from './routes/status'
import { webhooksRoute } from './routes/webhooks'
import { getSummary } from './services/incident.service'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', c =>
  c.json<HealthResponse>({ ok: true, name: 'DaDaDa', time: new Date().toISOString() }),
)
app.get('/api/summary', async c => {
  c.header('Cache-Control', 'public, max-age=30')
  return c.json<SummaryResponse>(await getSummary(c.env.DB))
})

app.route('/api/status', statusRoute)
app.route('/api/incidents', incidentsRoute)
app.route('/api/providers', providersRoute)
app.route('/api/webhooks', webhooksRoute)
app.route('/api/admin', adminRoute)

app.notFound(c => c.json<ErrorResponse>({ error: 'not found' }, 404))
app.onError((err, c) => {
  console.error('[api]', err)
  return c.json<ErrorResponse>({ error: 'internal error' }, 500)
})

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runCollectors(env, groupsForCron(event.cron)))
  },
} satisfies ExportedHandler<Bindings>
