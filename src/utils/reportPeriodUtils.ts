import { SchoolSettings, AcademicSemesterConfig } from '../types';
import { formatIndonesianDate } from './dateUtils';

export type ReportPeriodMode = 'weekly' | 'monthly' | 'semester' | 'yearly' | 'custom';

export const INDONESIAN_MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

/**
 * Format a Date to YYYY-MM-DD
 */
export function formatISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate weekly period (Monday to Sunday) given any reference date string (YYYY-MM-DD).
 */
export function getWeeklyPeriod(referenceDateStr: string): { startDate: string; endDate: string; label: string } {
  const ref = new Date(referenceDateStr || new Date().toISOString().split('T')[0]);
  if (isNaN(ref.getTime())) {
    const today = new Date();
    return getWeeklyPeriod(formatISODate(today));
  }

  // In JS: 0 is Sunday, 1 is Monday, ..., 6 is Saturday.
  const day = ref.getDay();
  // Calculate distance from Monday (if day is 0/Sunday, distance back to Monday is 6 days)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = formatISODate(monday);
  const endIso = formatISODate(sunday);

  return {
    startDate: startIso,
    endDate: endIso,
    label: `Minggu (${formatIndonesianDate(startIso)} s.d ${formatIndonesianDate(endIso)})`,
  };
}

/**
 * Calculate monthly period given year and month (1-12).
 */
export function getMonthlyPeriod(year: number, month: number): { startDate: string; endDate: string; label: string } {
  const safeYear = year || new Date().getFullYear();
  const safeMonth = Math.min(Math.max(month || 1, 1), 12);

  const startIso = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const endIso = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthObj = INDONESIAN_MONTHS.find((m) => m.value === safeMonth);

  return {
    startDate: startIso,
    endDate: endIso,
    label: `Bulan ${monthObj?.label || safeMonth} ${safeYear}`,
  };
}

/**
 * Calculate semester period given academic year (e.g. "2026/2027") and semester ("GANJIL" | "GENAP").
 * Uses schoolSettings.academicSemester if configured, or dynamically falls back to standard calendar.
 */
export function getSemesterPeriod(
  academicYear: string,
  semester: 'GANJIL' | 'GENAP',
  settings?: SchoolSettings
): { startDate: string; endDate: string; label: string } {
  const semConfig: AcademicSemesterConfig | undefined = settings?.academicSemester;

  // If school settings define the exact academic year and bounds, use them
  if (semConfig && semConfig.academicYear === academicYear) {
    if (semester === 'GANJIL') {
      return {
        startDate: semConfig.oddSemesterStart || `${academicYear.split('/')[0]}-07-01`,
        endDate: semConfig.oddSemesterEnd || `${academicYear.split('/')[0]}-12-31`,
        label: `Semester Ganjil TA ${academicYear}`,
      };
    } else {
      const secondYear = academicYear.split('/')[1] || String(Number(academicYear.split('/')[0]) + 1);
      return {
        startDate: semConfig.evenSemesterStart || `${secondYear}-01-01`,
        endDate: semConfig.evenSemesterEnd || `${secondYear}-06-30`,
        label: `Semester Genap TA ${academicYear}`,
      };
    }
  }

  // Standard Indonesian Academic Calendar Fallback:
  // e.g. "2026/2027" -> Ganjil: 1 Juli 2026 - 31 Des 2026; Genap: 1 Jan 2027 - 30 Juni 2027
  const parts = academicYear.split('/');
  const startYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const endYear = parseInt(parts[1], 10) || startYear + 1;

  if (semester === 'GANJIL') {
    return {
      startDate: `${startYear}-07-01`,
      endDate: `${startYear}-12-31`,
      label: `Semester Ganjil TA ${startYear}/${endYear}`,
    };
  } else {
    return {
      startDate: `${endYear}-01-01`,
      endDate: `${endYear}-06-30`,
      label: `Semester Genap TA ${startYear}/${endYear}`,
    };
  }
}

/**
 * Calculate full calendar year period.
 */
export function getYearlyPeriod(year: number): { startDate: string; endDate: string; label: string } {
  const safeYear = year || new Date().getFullYear();
  return {
    startDate: `${safeYear}-01-01`,
    endDate: `${safeYear}-12-31`,
    label: `Tahun ${safeYear}`,
  };
}

/**
 * Validates date range logic.
 */
export function validateDateRange(startDate: string, endDate: string): { isValid: boolean; errorMessage?: string } {
  if (!startDate || !endDate) {
    return { isValid: false, errorMessage: 'Tanggal mulai dan selesai harus diisi.' };
  }
  if (startDate > endDate) {
    return {
      isValid: false,
      errorMessage: 'Tanggal mulai tidak boleh melebihi tanggal selesai.',
    };
  }
  return { isValid: true };
}
