import { Link } from './Link'

export function Radar() {
  return (
    <span className="radar" aria-hidden>
      <span className="radar-sweep" />
      <span className="radar-blip" />
    </span>
  )
}

export function Header({ live, updatedAt }: { live: boolean; updatedAt?: string }) {
  return (
    <header className="header">
      <Link to="/" className="brand">
        <Radar />
        <span className="brand-name">DaDaDa</span>
      </Link>
      <span className={`live${live ? '' : ' offline'}`} title={updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : undefined}>
        <span className="live-dot" />
        {live ? 'LIVE' : 'OFFLINE'}
      </span>
    </header>
  )
}
