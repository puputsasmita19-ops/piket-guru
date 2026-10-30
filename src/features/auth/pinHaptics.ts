/** R98: local device preference only. No PIN digits, identity or auth information is stored. */
export const PIN_HAPTIC_STORAGE_KEY = 'piket_guru_pin_haptics_v1';

export type PinHapticKind = 'digit' | 'delete' | 'clear';

export function supportsPinHaptics(device?: Pick<Navigator, 'vibrate'> | null): boolean {
  try {
    const target = device ?? (typeof navigator !== 'undefined' ? navigator : null);
    return typeof target?.vibrate === 'function';
  } catch {
    return false;
  }
}

export function readPinHapticsEnabled(device?: Pick<Navigator, 'vibrate'> | null): boolean {
  if (!supportsPinHaptics(device)) return false;
  try {
    // Enabled by default on supporting devices, with an accessible one-tap opt-out.
    return localStorage.getItem(PIN_HAPTIC_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function savePinHapticsEnabled(enabled: boolean): void {
  try { localStorage.setItem(PIN_HAPTIC_STORAGE_KEY, enabled ? 'on' : 'off'); }
  catch { /* Private browsing / disabled storage: preference remains in memory. */ }
}

/** Small, best-effort feedback; never delays input and never affects authentication. */
export function vibratePinKey(enabled: boolean, kind: PinHapticKind = 'digit', device?: Pick<Navigator, 'vibrate'> | null): boolean {
  if (!enabled) return false;
  const target = device ?? (typeof navigator !== 'undefined' ? navigator : null);
  if (!supportsPinHaptics(target)) return false;
  try {
    return Boolean(target?.vibrate?.(kind === 'digit' ? 7 : kind === 'delete' ? 10 : 13));
  } catch {
    return false;
  }
}
