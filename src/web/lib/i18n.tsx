import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  LOCALE_STORAGE_KEY,
  savedLocale,
  translate,
  type Locale,
  type MessageKey,
} from './messages'

type I18n = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, params?: Record<string, string | number>) => string
}
const Context = createContext<I18n | null>(null)

export function I18nProvider({
  children,
  initialLocale,
}: {
  children?: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (initialLocale) return initialLocale
    try {
      return savedLocale(window.localStorage)
    } catch {
      return 'ja'
    }
  })
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      /* Language switching still works when storage is unavailable. */
    }
  }, [locale])
  return (
    <Context.Provider
      value={{ locale, setLocale, t: (key, params) => translate(locale, key, params) }}
    >
      {children}
    </Context.Provider>
  )
}

export function useI18n(): I18n {
  const value = useContext(Context)
  if (!value) throw new Error('I18nProvider is required')
  return value
}
