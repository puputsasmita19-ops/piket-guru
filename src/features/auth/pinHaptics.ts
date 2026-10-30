/**
 * R99: device-local tactile preferences for the PIN keypad.
 * No PIN, user identity or authentication data is ever persisted here.
 * Web Vibration API availability is not proof of a physical vibration.
 */
export const PIN_HAPTIC_STORAGE_KEY = 'piket_guru_pin_haptics_v1';
export const PIN_HAPTIC_STRENGTH_KEY = 'piket_guru_pin_haptic_strength_v1';

export type PinHapticKind = 'digit' | 'delete' | 'clear' | 'test';
export type PinHapticStrength = 'light' | 'normal' | 'strong';

type VibratingDevice = Pick<Navigator, 'vibrate'>;

export function supportsPinHaptics(device?: VibratingDevice | null): boolean {
  try {
    const target = device ?? (typeof navigator !== 'undefined' ? navigator : null);
    return typeof target?.vibrate === 'function';
  } catch {
    return false;
  }
}

export function readPinHapticsEnabled(device?: VibratingDevice | null): boolean {
  if (!supportsPinHaptics(device)) return false;
  try {
    // Retain the user's existing R98 opt-out preference.
    return localStorage.getItem(PIN_HAPTIC_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function savePinHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PIN_HAPTIC_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Private browsing or disabled storage: preference still works this session.
  }
}

export function readPinHapticStrength(): PinHapticStrength {
  try {
    const saved = localStorage.getItem(PIN_HAPTIC_STRENGTH_KEY);
    if (saved === 'light' || saved === 'strong') return saved;
  } catch {
    // Local storage unavailable.
  }
  return 'normal';
}

export function savePinHapticStrength(strength: PinHapticStrength): void {
  try {
    localStorage.setItem(PIN_HAPTIC_STRENGTH_KEY, strength);
  } catch {
    // Local storage unavailable.
  }
}

/**
 * Each pulse is short and intentionally bounded. R98's 7ms pulse was often
 * imperceptible on devices with slower vibration motors.
 *
 * `true` from navigator.vibrate means the request was accepted, NOT that a
 * person felt a physical vibration. OS silent/DND, hardware, policies, and
 * browser settings can still suppress tactile feedback.
 */
export function vibratePinKey(
  enabled: boolean,
  kind: PinHapticKind = 'digit',
  device?: VibratingDevice | null,
  strength: PinHapticStrength = 'normal'
): boolean {
  if (!enabled) return false;
  const target = device ?? (typeof navigator !== 'undefined' ? navigator : null);
  if (!supportsPinHaptics(target)) return false;
  const patterns: Record<PinHapticStrength, Record<PinHapticKind, number>> = {
    light: { digit: 16, delete: 22, clear: 28, test: 65 },
    normal: { digit: 28, delete: 36, clear: 45, test: 90 },
    strong: { digit: 45, delete: 55, clear: 65, test: 120 },
  };
  try {
    return target?.vibrate?.(patterns[strength][kind]) === true;
  } catch {
    return false;
  }
}
