import { useI18n } from '../lib/i18n'
import { Link } from './Link'
import { formatDateTime } from '../lib/format'

export function Header({ live, updatedAt }: { live: boolean; updatedAt?: string }) {
  const { locale, setLocale, t } = useI18n()
  return (
    <header className="header">
      <Link to="/" className="brand">
        <img className="brand-logo" src="/header_logo.png" alt="DaDaDa" width={2172} height={724} />
      </Link>
      <div className="header-actions">
        {updatedAt && (
          <time className="header-updated" dateTime={updatedAt}>
            {t('summaryUpdated', { time: formatDateTime(updatedAt, locale) })}
          </time>
        )}
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
