import { useEffect, useState, type MouseEvent } from 'react'

const EVENT = 'dadada:navigate'

export function navigate(path: string): void {
  if (path === location.pathname) return
  history.pushState(null, '', path)
  window.dispatchEvent(new Event(EVENT))
  window.scrollTo(0, 0)
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(location.pathname)
  useEffect(() => {
    const update = () => setPathname(location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener(EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(EVENT, update)
    }
  }, [])
  return pathname
}

/** <a> の onClick 用。修飾キー付きクリックはブラウザに任せる */
export function onLinkClick(path: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    navigate(path)
  }
}
