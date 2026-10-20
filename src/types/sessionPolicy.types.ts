export const BACKGROUND_LOGOUT_DELAYS = [0, 15, 30, 60, 300] as const;
export interface SessionPolicy {
  backgroundLogoutEnabled: boolean;
  backgroundDelaySeconds: number;
}
export function sanitizeSessionPolicy(value?: Partial<SessionPolicy> | null): SessionPolicy {
  return {
    backgroundLogoutEnabled: value?.backgroundLogoutEnabled === true,
    backgroundDelaySeconds: BACKGROUND_LOGOUT_DELAYS.includes(value?.backgroundDelaySeconds as typeof BACKGROUND_LOGOUT_DELAYS[number])
      ? value!.backgroundDelaySeconds! : 0,
  };
}
