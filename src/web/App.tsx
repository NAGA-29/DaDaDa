import type { SummaryResponse } from '../shared/api'
import { Header } from './components/Header'
import { Link } from './components/Link'
import { Home } from './features/Home'
import { ProviderDetail } from './features/provider-detail/ProviderDetail'
import { useApi } from './lib/api'
import { usePathname } from './lib/router'

const REFRESH_MS = 60_000

function safeDecode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

function NotFound() {
  return (
    <main className="page">
      <Link to="/" className="back">
        ← Everything
      </Link>
      <p className="empty">Page not found.</p>
    </main>
  )
}

export function App() {
  const pathname = usePathname()
  const summary = useApi<SummaryResponse>('/api/summary', REFRESH_MS)
  const detailMatch = /^\/d\/([^/]+)\/?$/.exec(pathname)?.[1]
  const detailId = detailMatch === undefined ? undefined : safeDecode(detailMatch)

  return (
    <div className={detailMatch === undefined ? 'app app-dashboard' : 'app'}>
      <Header live={!summary.error && !!summary.data} updatedAt={summary.data?.generatedAt} />
      {detailMatch === undefined ? (
        <Home summary={summary} />
      ) : detailId ? (
        <ProviderDetail id={detailId} />
      ) : (
        <NotFound />
      )}
      <footer className="footer">
        DaDaDa collects public status pages & security feeds. Always check the official source.
      </footer>
    </div>
  )
}
