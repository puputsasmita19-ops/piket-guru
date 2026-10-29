/** R89-B: read-only classification; never writes an attendance record. */
export type CheckoutReminderStatus =
  | 'BELUM_HADIR'
  | 'BERTUGAS'
  | 'PERLU_PENGINGAT'
  | 'TERLEWAT'
  | 'SELESAI'
  | 'BELUM_TERVERIFIKASI';

export interface CheckoutReminderInput {
  todayWib: string;
  recordDate?: string;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  serverVerified: boolean;
  online: boolean;
  mode: 'TERJADWAL' | 'BEBAS';
  activeDay: boolean;
  checkOutStart: string;
  nowHHMM: string;
}

export function classifyCheckoutReminder(input: CheckoutReminderInput): CheckoutReminderStatus {
  // A cached document or an unacknowledged write cannot prove that checkout was missed.
  if (!input.online || !input.serverVerified) return 'BELUM_TERVERIFIKASI';
  if (!input.hasCheckIn) return 'BELUM_HADIR';
  if (!input.recordDate || input.recordDate > input.todayWib) return 'BELUM_TERVERIFIKASI';
  if (input.hasCheckOut) return 'SELESAI';
  // R89-B does not issue historical checkout actions. R89-C may show this as a correction request.
  if (input.recordDate < input.todayWib) return 'TERLEWAT';
  // BEBAS has no mandatory reminder hour. The dashboard may offer a quiet shortcut instead.
  if (input.mode === 'BEBAS' || !input.activeDay) return 'BERTUGAS';
  if (!/^\d{2}:\d{2}$/.test(input.checkOutStart) || !/^\d{2}:\d{2}$/.test(input.nowHHMM)) {
    return 'BELUM_TERVERIFIKASI';
  }
  return input.nowHHMM >= input.checkOutStart ? 'PERLU_PENGINGAT' : 'BERTUGAS';
}

export const CHECKOUT_SNOOZE_MINUTES = 20;
export function snoozeExpiry(nowMs: number, minutes: number = CHECKOUT_SNOOZE_MINUTES): number {
  return nowMs + minutes * 60_000;
}

/** Delay is relative to when checkout opens; never creates a backdated or automatic record. */
export function reminderWindowOpen(checkOutStart: string, nowHHMM: string, delayMinutes: number): boolean {
  const toMinutes = (value: string): number | null => {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  };
  const starts = toMinutes(checkOutStart);
  const now = toMinutes(nowHHMM);
  if (starts === null || now === null || !Number.isInteger(delayMinutes) || delayMinutes < 0) return false;
  return now >= starts + delayMinutes;
}
