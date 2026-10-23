import type { ReactNode } from 'react'
import { onLinkClick } from '../lib/router'

export function Link({
  to,
  className,
  children,
}: {
  to: string
  className?: string
  children: ReactNode
}) {
  return (
    <a href={to} className={className} onClick={onLinkClick(to)}>
      {children}
    </a>
  )
}

export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}
