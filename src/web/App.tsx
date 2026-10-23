import type { SummaryResponse } from '../shared/api'
import { Header } from './components/Header'
import { Home } from './features/Home'
import { ProviderDetail } from './features/provider-detail/ProviderDetail'
import { useApi } from './lib/api'
import { usePathname } from './lib/router'

const REFRESH_MS = 60_000

export function App() {
  const pathname = usePathname()
  const summary = useApi<SummaryResponse>('/api/summary', REFRESH_MS)
  const detailId = /^\/d\/([^/]+)\/?$/.exec(pathname)?.[1]

  return (
    <div className="app">
      <Header live={!summary.error && !!summary.data} updatedAt={summary.data?.generatedAt} />
      {detailId ? <ProviderDetail id={decodeURIComponent(detailId)} /> : <Home summary={summary} />}
      <footer className="footer">
        DaDaDa collects public status pages & security feeds. Always check the official source.
      </footer>
    </div>
  )
}
