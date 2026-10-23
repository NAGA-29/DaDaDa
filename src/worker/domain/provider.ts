export type ProviderCategory =
  | 'cloud'
  | 'developer'
  | 'database'
  | 'ai'
  | 'security'
  | 'communication'
  | 'payment'
  | 'runtime'
  | 'other'

export type Provider = {
  id: string
  name: string
  category: ProviderCategory
  homepageUrl: string
  statusUrl?: string
  iconUrl?: string
  supportsStatus: boolean
  supportsSecurity: boolean
}
