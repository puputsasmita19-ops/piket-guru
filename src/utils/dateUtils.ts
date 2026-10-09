import type { DayOfWeek } from '../types';
import type { Timestamp } from 'firebase/firestore';

export type DateValue =
  | string
  | Date
  | Timestamp
  | { seconds: number; nanoseconds?: number; toDate?: () => Date }
  | null
  | undefined;

export function toEpochMs(val?: DateValue): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  }
  if (val instanceof Date) return val.getTime();
  if (typeof (val as any).toMillis === 'function') return (val as any).toMillis();
  if (typeof (val as any).toDate === 'function') return (val as any).toDate().getTime();
  if (typeof (val as any).seconds === 'number') return (val as any).seconds * 1000;
  const t = new Date(String(val)).getTime();
  return isNaN(t) ? 0 : t;
}

export function formatIndonesianDate(dateString?: string | Date): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) return String(dateString);

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export function formatTime(timeInput?: any, includeSeconds = false): string {
  if (!timeInput) return '-';
  if (typeof timeInput === 'string' && timeInput.length === 5 && timeInput.includes(':')) {
    return `${timeInput} WIB`;
  }
  let date: Date;
  if (typeof timeInput === 'object' && timeInput !== null) {
    if (typeof timeInput.toDate === 'function') {
      date = timeInput.toDate();
    } else if (typeof timeInput.seconds === 'number') {
      date = new Date(timeInput.seconds * 1000);
    } else if (timeInput instanceof Date) {
      date = timeInput;
    } else {
      date = new Date(String(timeInput));
    }
  } else {
    date = typeof timeInput === 'string' ? new Date(timeInput) : timeInput;
  }

  if (isNaN(date.getTime())) return String(timeInput);

  return `${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date)} WIB`;
}

export function formatTimeWithSeconds(dateString?: string | Date): string {
  return formatTime(dateString, true);
}

/**
 * Returns current DayOfWeek ('SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'MINGGU')
 * strictly evaluated in the Asia/Jakarta (WIB) timezone.
 */
export function getCurrentDayName(dateInput?: string | Date): DayOfWeek {
  const date = dateInput
    ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
    : new Date();

  if (isNaN(date.getTime())) return 'MINGGU';

  const rawWeekday = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(date).toUpperCase();

  if (rawWeekday.includes('MINGGU') || rawWeekday.includes('AHAD')) return 'MINGGU';
  if (rawWeekday.includes('SENIN')) return 'SENIN';
  if (rawWeekday.includes('SELASA')) return 'SELASA';
  if (rawWeekday.includes('RABU')) return 'RABU';
  if (rawWeekday.includes('KAMIS')) return 'KAMIS';
  if (rawWeekday.includes('JUMAT') || rawWeekday.includes('JUM')) return 'JUMAT';
  if (rawWeekday.includes('SABTU')) return 'SABTU';

  const shortEn = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date).toLowerCase();

  const dayMap: Record<string, DayOfWeek> = {
    sun: 'MINGGU',
    mon: 'SENIN',
    tue: 'SELASA',
    wed: 'RABU',
    thu: 'KAMIS',
    fri: 'JUMAT',
    sat: 'SABTU',
  };

  return dayMap[shortEn] || 'MINGGU';
}

/**
 * Returns current ISO date string (YYYY-MM-DD)
 * strictly evaluated in the Asia/Jakarta (WIB) timezone.
 */
export function getTodayISODate(dateInput?: string | Date): string {
  const date = dateInput
    ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
    : new Date();

  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

/**
 * Returns current time string (HH:mm)
 * strictly evaluated in the Asia/Jakarta (WIB) timezone.
 */
export function getCurrentTimeHHMM(dateInput?: string | Date): string {
  const date = dateInput
    ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
    : new Date();

  if (isNaN(date.getTime())) {
    return '00:00';
  }

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date).replace('.', ':');
}

