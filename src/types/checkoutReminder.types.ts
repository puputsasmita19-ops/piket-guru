/** R89-D — independent settings; no automatic checkout or background/push notifications. */
export interface CheckoutReminderConfig {
  enabled: boolean;
  /** Minutes after the scheduled checkout window begins (not before). */
  delayMinutes: number;
  /** How long the local dashboard dismissal lasts. */
  snoozeMinutes: number;
  /** Quiet reminder shortcut when the school uses unrestricted checkout hours. */
  freeModeHintEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const CHECKOUT_REMINDER_DELAYS = [0, 5, 10, 15, 30] as const;
export const CHECKOUT_REMINDER_SNOOZES = [10, 20, 30, 60] as const;

export const DEFAULT_CHECKOUT_REMINDER_CONFIG: CheckoutReminderConfig = {
  enabled: true,
  delayMinutes: 0,
  snoozeMinutes: 20,
  freeModeHintEnabled: true,
};

/** Safe legacy fallback: an absent or damaged field retains R89-B behavior. */
export function normalizeCheckoutReminderConfig(raw?: Partial<CheckoutReminderConfig> | null): CheckoutReminderConfig {
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
    delayMinutes: CHECKOUT_REMINDER_DELAYS.includes(raw?.delayMinutes as typeof CHECKOUT_REMINDER_DELAYS[number]) ? raw!.delayMinutes! : 0,
    snoozeMinutes: CHECKOUT_REMINDER_SNOOZES.includes(raw?.snoozeMinutes as typeof CHECKOUT_REMINDER_SNOOZES[number]) ? raw!.snoozeMinutes! : 20,
    freeModeHintEnabled: typeof raw?.freeModeHintEnabled === 'boolean' ? raw.freeModeHintEnabled : true,
  };
}

/** Validate admin's actual submission instead of silently coercing invalid values. */
export function validateCheckoutReminderConfig(config: CheckoutReminderConfig): void {
  if (typeof config?.enabled !== 'boolean' || typeof config.freeModeHintEnabled !== 'boolean' ||
    !CHECKOUT_REMINDER_DELAYS.includes(config.delayMinutes as typeof CHECKOUT_REMINDER_DELAYS[number]) ||
    !CHECKOUT_REMINDER_SNOOZES.includes(config.snoozeMinutes as typeof CHECKOUT_REMINDER_SNOOZES[number])) {
    throw new Error('Pengaturan pengingat tidak valid. Pilih jeda dan durasi dari pilihan yang tersedia.');
  }
}
