import type { AcademicSemesterConfig } from '../types';

export type HistoryPeriodMode = 'today' | 'week' | 'month' | 'semester' | 'year' | 'custom';
export interface HistoryPeriodValue { mode: HistoryPeriodMode; anchor: string; semester: 'current' | 'odd' | 'even'; from: string; to: string }
export interface HistoryRange { start: string; end: string; label: string; error: string }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const wibDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
export const todayWib = (now = new Date()) => wibDayFormatter.format(now);
export function validHistoryDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && iso(new Date(value + 'T00:00:00Z')) === value;
}
export function getHistoryRange(value: HistoryPeriodValue, today: string, academic?: AcademicSemesterConfig): HistoryRange {
  let start = '', end = '', error = '';
  const anchor = value.anchor || today;
  if (!validHistoryDate(anchor)) return { start, end, label: '', error: 'Tanggal acuan tidak valid.' };
  const [year, month] = anchor.split('-').map(Number);
  switch (value.mode) {
    case 'today': start = end = today; break;
    case 'week': {
      const d = new Date(anchor + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
      start = iso(d); d.setUTCDate(d.getUTCDate() + 6); end = iso(d); break;
    }
    case 'month': start = `${year}-${String(month).padStart(2, '0')}-01`; end = iso(new Date(Date.UTC(year, month, 0))); break;
    case 'year': start = `${year}-01-01`; end = `${year}-12-31`; break;
    case 'semester': {
      const odd = [academic?.oddSemesterStart, academic?.oddSemesterEnd];
      const even = [academic?.evenSemesterStart, academic?.evenSemesterEnd];
      const configured = value.semester === 'odd' ? odd : value.semester === 'even' ? even
        : [odd, even].find(([a, b]) => a && b && a <= today && today <= b);
      if (configured?.[0] && configured[1] && validHistoryDate(configured[0]) && validHistoryDate(configured[1]) && configured[0] <= configured[1]) {
        [start, end] = configured as [string, string];
      } else if (value.semester !== 'current') error = 'Tanggal semester belum diatur admin. Gunakan rentang waktu atau lengkapi pengaturan semester.';
      else { start = `${year}-${month < 7 ? '01' : '07'}-01`; end = `${year}-${month < 7 ? '06-30' : '12-31'}`; }
      break;
    }
    case 'custom': start = value.from; end = value.to; break;
  }
  if (!error && (!validHistoryDate(start) || !validHistoryDate(end))) error = 'Isi tanggal awal dan akhir yang valid.';
  if (!error && start > end) error = 'Tanggal awal tidak boleh melewati tanggal akhir.';
  return { start, end, error, label: error ? '' : `${start} s.d. ${end}` };
}

function epoch(value: unknown): number {
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
    if ('seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
}
export function attendanceDuration(start: unknown, end: unknown): string {
  if (!end) return 'Belum pulang';
  const a = epoch(start), b = epoch(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 'Waktu tidak valid';
  const minutes = Math.floor((b - a) / 60000);
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}
