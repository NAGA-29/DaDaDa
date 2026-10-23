/** 任意の日付文字列を UTC ISO8601 に揃える。解釈できなければ undefined */
export function toIsoUtc(value: string | number | Date | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
