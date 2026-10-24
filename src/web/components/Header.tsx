import { useI18n } from '../lib/i18n'
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
  const { locale, setLocale, t } = useI18n()
  return (
    <header className="header">
      <Link to="/" className="brand">
        <Radar />
        <span className="brand-name">DaDaDa</span>
      </Link>
      <div className="header-actions">
        <select
          className="locale-select"
          aria-label={t('language')}
          value={locale}
          onChange={event => setLocale(event.target.value === 'en' ? 'en' : 'ja')}
        >
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
        <span
          className={`live${live ? '' : ' offline'}`}
          title={
            updatedAt
              ? t('updated', { time: new Date(updatedAt).toLocaleTimeString(locale) })
              : undefined
          }
        >
          <span className="live-dot" />
          {t(live ? 'live' : 'offline')}
        </span>
      </div>
    </header>
  )
}
