export interface VisitorConfig { allowCustomDestination: boolean; customDestinations: string[] }
export function normalizeVisitorConfig(value?: Partial<VisitorConfig>): VisitorConfig {
  return { allowCustomDestination: value?.allowCustomDestination !== false, customDestinations: [...new Set((Array.isArray(value?.customDestinations) ? value.customDestinations : []).filter((v): v is string => typeof v === 'string').map(v => v.trim().slice(0, 100)).filter(Boolean))].slice(0, 30) };
}
