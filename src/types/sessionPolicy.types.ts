export const BACKGROUND_LOGOUT_DELAYS = [0, 15, 30, 60, 300] as const;
export interface DeviceSessionPolicy {
  backgroundLogoutEnabled: boolean;
  backgroundDelaySeconds: number;
}
export type SessionDevice = 'mobile' | 'desktop';
export interface SessionPolicy extends DeviceSessionPolicy {
  mobile?: DeviceSessionPolicy;
  desktop?: DeviceSessionPolicy;
}
function devicePolicy(value?: Partial<DeviceSessionPolicy> | null): DeviceSessionPolicy {
  return {
    backgroundLogoutEnabled: value?.backgroundLogoutEnabled === true,
    backgroundDelaySeconds: BACKGROUND_LOGOUT_DELAYS.includes(value?.backgroundDelaySeconds as typeof BACKGROUND_LOGOUT_DELAYS[number])
      ? value!.backgroundDelaySeconds! : 0,
  };
}
/** Existing flat settings remain the fallback for both devices; no forced policy reset. */
export function sanitizeSessionPolicy(value?: Partial<SessionPolicy> | null): SessionPolicy & { mobile: DeviceSessionPolicy; desktop: DeviceSessionPolicy } {
  const legacy = devicePolicy(value);
  return { ...legacy,
    mobile: devicePolicy({ ...legacy, ...value?.mobile }),
    desktop: devicePolicy({ ...legacy, ...value?.desktop }),
  };
}
/** Classify the device, not viewport width: resizing a desktop must not alter its session. */
export function getSessionDevice(): SessionDevice {
  if (typeof navigator === 'undefined') return 'desktop';
  const browser = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return browser.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(browser.userAgent || '') ||
    (browser.platform === 'MacIntel' && browser.maxTouchPoints > 1) ? 'mobile' : 'desktop';
}
export function sessionPolicyForDevice(policy?: Partial<SessionPolicy> | null, device: SessionDevice = getSessionDevice()): DeviceSessionPolicy {
  return sanitizeSessionPolicy(policy)[device];
}
