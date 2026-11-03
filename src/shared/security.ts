import type { IncidentView } from './api'

export const SECURITY_LANGUAGES = [
  { ecosystem: 'go', label: 'Go', providerId: 'go', homepageUrl: 'https://go.dev' },
  { ecosystem: 'maven', label: 'Java', providerId: 'java', homepageUrl: 'https://dev.java' },
  { ecosystem: 'rust', label: 'Rust', providerId: 'rust', homepageUrl: 'https://rust-lang.org' },
  {
    ecosystem: 'nuget',
    label: 'C# / .NET',
    providerId: 'dotnet',
    homepageUrl: 'https://dotnet.microsoft.com',
  },
] as const

export const SECURITY_ECOSYSTEMS = [
  { ecosystem: 'npm', label: 'JavaScript / Node.js', group: 'language' },
  { ecosystem: 'composer', label: 'PHP', group: 'language' },
  ...SECURITY_LANGUAGES.map(language => ({ ...language, group: 'language' as const })),
  { ecosystem: 'pip', label: 'Python', group: 'language' },
  { ecosystem: 'laravel', label: 'Laravel', group: 'middleware' },
  { ecosystem: 'postgresql', label: 'PostgreSQL', group: 'middleware' },
  { ecosystem: 'redis', label: 'Redis', group: 'middleware' },
] as const

/** PHP runtime notices use php; package advisories use Composer; Laravel is a PHP framework. Keep stored IDs intact. */
export function ecosystemAliases(ecosystem: string): string[] {
  return ecosystem === 'composer' || ecosystem === 'php'
    ? ['composer', 'php', 'laravel']
    : [ecosystem]
}

export function matchesEcosystem(incident: IncidentView, ecosystem: string): boolean {
  const aliases = ecosystemAliases(ecosystem)
  return (
    !ecosystem ||
    (incident.ecosystems ?? [incident.ecosystem]).some(
      value => value !== undefined && aliases.includes(value),
    )
  )
}
