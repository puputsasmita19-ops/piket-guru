export type VisitorPhotoMode = 'WATERMARK' | 'ORIGINAL';
export interface VisitorConfig {
  allowCustomDestination: boolean;
  customDestinations: string[];
  /** Default mode for photos captured by signed-in school staff. */
  defaultPhotoMode: VisitorPhotoMode;
  /** If false, staff cannot override the school's chosen photo mode. */
  allowPhotoModeChoice: boolean;
}
export function normalizeVisitorConfig(value?: Partial<VisitorConfig>): VisitorConfig {
  return {
    allowCustomDestination: value?.allowCustomDestination !== false,
    customDestinations: [...new Set((Array.isArray(value?.customDestinations) ? value.customDestinations : [])
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim().slice(0, 100)).filter(Boolean))].slice(0, 30),
    defaultPhotoMode: value?.defaultPhotoMode === 'ORIGINAL' ? 'ORIGINAL' : 'WATERMARK',
    allowPhotoModeChoice: value?.allowPhotoModeChoice !== false,
  };
}
