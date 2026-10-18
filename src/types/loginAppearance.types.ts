export interface LoginAppearanceConfig {
  motionEnabled: boolean;
  background: 'ocean' | 'gradient';
  speed: 'slow' | 'normal' | 'fast';
  intensity: 'soft' | 'clear';
  runningCredit: boolean;
  creditDuration: number;
}
export function sanitizeLoginAppearance(value?: Partial<LoginAppearanceConfig> | null): LoginAppearanceConfig {
  const v = value && typeof value === 'object' ? value : {};
  return {
    motionEnabled: v.motionEnabled !== false,
    background: v.background === 'gradient' ? 'gradient' : 'ocean',
    speed: ['slow', 'normal', 'fast'].includes(v.speed!) ? v.speed! : 'slow',
    intensity: v.intensity === 'clear' ? 'clear' : 'soft',
    runningCredit: v.runningCredit !== false,
    creditDuration: [20, 30, 45, 60].includes(v.creditDuration!) ? v.creditDuration! : 30,
  };
}
