import { useCallback, useEffect, useState } from 'react'

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

export type Loadable<T> = {
  data: T | null
  error: Error | null
  loading: boolean
  reload: () => void
}

/** path を取得し、refreshMs ごとに再取得する */
export function useApi<T>(path: string, refreshMs?: number): Loadable<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    getJson<T>(path, controller.signal)
      .then(d => {
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, tick])

  useEffect(() => {
    if (!refreshMs) return
    const id = setInterval(reload, refreshMs)
    return () => clearInterval(id)
  }, [refreshMs, reload])

  return { data, error, loading, reload }
}
