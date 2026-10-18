export interface LoginAppearanceConfig {
  motionEnabled: boolean;
  background: 'ocean' | 'gradient';
  speed: 'slow' | 'normal' | 'fast';
  intensity: 'soft' | 'clear';
  runningCredit: boolean;
  creditDuration: number;
  mediaPolicy: 'economy' | 'adaptive' | 'always';
}
export function sanitizeLoginAppearance(value?: Partial<LoginAppearanceConfig> | null): LoginAppearanceConfig {
  const v = value && typeof value === 'object' ? value : {};
  return {
    motionEnabled: v.motionEnabled !== false,
    background: v.background === 'ocean' ? 'ocean' : 'gradient',
    speed: ['slow', 'normal', 'fast'].includes(v.speed!) ? v.speed! : 'slow',
    intensity: v.intensity === 'clear' ? 'clear' : 'soft',
    runningCredit: v.runningCredit !== false,
    creditDuration: [20, 30, 45, 60].includes(v.creditDuration!) ? v.creditDuration! : 30,
    mediaPolicy: ['economy', 'adaptive', 'always'].includes(v.mediaPolicy!) ? v.mediaPolicy! : 'economy',
  };
}

/** Economy and unknown/slow connections never request background media. */
export function resolveLoginBackground(config?: Partial<LoginAppearanceConfig> | null, fastConnection = false): 'gradient' | 'ocean' {
  const v = sanitizeLoginAppearance(config);
  return v.background === 'ocean' && (v.mediaPolicy === 'always' || v.mediaPolicy === 'adaptive' && fastConnection) ? 'ocean' : 'gradient';
}
