import type { Provider } from '../../shared/api'

/** 名前から決まる色相のモノグラム。iconUrl があればそちらを使う */
function hue(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

export function ProviderIcon({
  provider,
  size = 28,
}: {
  provider: Pick<Provider, 'id' | 'name' | 'iconUrl'>
  size?: number
}) {
  const localIcons: Record<string, string> = {
    supabase: 'supabase.svg',
    github: 'github.svg',
    cloudflare: 'cloudflare.svg',
    vercel: 'vercel.svg',
    'google-cloud': 'google-cloud.svg',
    netlify: 'netlify.svg',
    railway: 'railway.svg',
    aws: 'aws.svg',
    azure: 'azure.svg',
    sakura: 'sakura.ico',
  }
  const icon =
    provider.iconUrl ?? (localIcons[provider.id] ? `/icons/${localIcons[provider.id]}` : undefined)
  if (icon) {
    return <img className="provider-icon" src={icon} alt="" width={size} height={size} />
  }
  return (
    <span
      className="provider-icon"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        ['--h' as string]: hue(provider.id),
      }}
    >
      {provider.name.charAt(0)}
    </span>
  )
}
