import type { Provider } from '../../shared/api'

/** 名前から決まる色相のモノグラム。iconUrl があればそちらを使う */
function hue(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function ProviderIcon({ provider, size = 28 }: { provider: Pick<Provider, 'id' | 'name' | 'iconUrl'>; size?: number }) {
  if (provider.iconUrl) {
    return <img className="provider-icon" src={provider.iconUrl} alt="" width={size} height={size} />
  }
  return (
    <span
      className="provider-icon"
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.46, ['--h' as string]: hue(provider.id) }}
    >
      {provider.name.charAt(0)}
    </span>
  )
}
