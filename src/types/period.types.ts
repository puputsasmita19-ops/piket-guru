import { DayOfWeek } from './index';

export interface LessonPeriodItem {
  id: string; // ID unik JP (e.g. "jp-senin-1" atau uuid)
  periodNumber: number; // Nomor JP (1, 2, 3, ...)
  name?: string; // Nama opsional, e.g. "Jam Ke-1"
  startTime: string; // Jam mulai format "HH:mm" (e.g. "07:15")
  endTime: string; // Jam selesai format "HH:mm" (e.g. "08:00")
  days: DayOfWeek[]; // Hari berlaku (e.g. ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'])
  effectiveStartDate?: string; // Tanggal mulai berlaku (YYYY-MM-DD)
  isActive: boolean; // Status aktif (true = aktif, false = dinonaktifkan)
  notes?: string; // Catatan khusus (e.g. "Khusus Upacara", "Khusus Sholat Jumat")
}

export interface LessonPeriodConfig {
  effectiveDate: string; // Tanggal mulai berlaku konfigurasi (YYYY-MM-DD)
  periods: LessonPeriodItem[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface PeriodScheduleSnapshot {
  periodNumber: number;
  periodLabel: string; // e.g. "JP 1"
  startTime: string;
  endTime: string;
  timeRange: string; // e.g. "07:15 - 08:00"
  effectiveDate?: string;
}

export const ALL_DAYS_OF_WEEK: { code: DayOfWeek; label: string; shortLabel: string }[] = [
  { code: 'SENIN', label: 'Senin', shortLabel: 'Sen' },
  { code: 'SELASA', label: 'Selasa', shortLabel: 'Sel' },
  { code: 'RABU', label: 'Rabu', shortLabel: 'Rab' },
  { code: 'KAMIS', label: 'Kamis', shortLabel: 'Kam' },
  { code: 'JUMAT', label: 'Jumat', shortLabel: 'Jum' },
  { code: 'SABTU', label: 'Sabtu', shortLabel: 'Sab' },
  { code: 'MINGGU', label: 'Minggu', shortLabel: 'Min' },
];

/**
 * Mendapatkan hari dalam seminggu (DayOfWeek) dari format tanggal YYYY-MM-DD
 */
export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  if (!dateStr) return 'SENIN';
  const date = new Date(dateStr + 'T00:00:00');
  const dayIndex = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const map: DayOfWeek[] = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  return map[dayIndex] || 'SENIN';
}

/**
 * Mengonversi waktu "HH:mm" menjadi total menit dari jam 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.trim().split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Validasi ketat konfigurasi Jam Pelajaran:
 * 1. Jam selesai setelah jam mulai
 * 2. Nomor JP tidak ganda pada jadwal hari yang sama
 * 3. Interval waktu tidak bertabrakan pada hari yang sama
 */
export function validateLessonPeriodConfig(config: Partial<LessonPeriodConfig>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.effectiveDate || !config.effectiveDate.trim()) {
    errors.push('Tanggal mulai berlaku jadwal jam pelajaran wajib diisi.');
  }

  const periods = config.periods || [];
  if (periods.length === 0) {
    errors.push('Jadwal jam pelajaran harus memiliki minimal 1 (satu) nomor JP.');
    return { isValid: false, errors };
  }

  const activePeriods = periods.filter((p) => p.isActive);

  // Periksa per item
  for (const p of periods) {
    if (!Number.isInteger(p.periodNumber) || p.periodNumber <= 0) {
      errors.push(`Nomor JP harus berupa bilangan bulat positif (> 0). Ditemukan: ${p.periodNumber}`);
    }

    if (!p.startTime || !/^[0-2][0-9]:[0-5][0-9]$/.test(p.startTime)) {
      errors.push(`Jam mulai pada JP ${p.periodNumber} (${p.startTime || 'kosong'}) tidak valid (format HH:mm).`);
    }

    if (!p.endTime || !/^[0-2][0-9]:[0-5][0-9]$/.test(p.endTime)) {
      errors.push(`Jam selesai pada JP ${p.periodNumber} (${p.endTime || 'kosong'}) tidak valid (format HH:mm).`);
    }

    const startMin = timeToMinutes(p.startTime);
    const endMin = timeToMinutes(p.endTime);

    // Rule 1: Jam selesai harus setelah jam mulai
    if (endMin <= startMin) {
      errors.push(
        `Jam selesai (${p.endTime}) harus lebih lambat dari jam mulai (${p.startTime}) pada JP ${p.periodNumber}.`
      );
    }

    if (!p.days || p.days.length === 0) {
      errors.push(`Pilih minimal 1 hari berlaku untuk JP ${p.periodNumber}.`);
    }
  }

  // Periksa per hari untuk periode aktif
  ALL_DAYS_OF_WEEK.forEach(({ code: day, label: dayLabel }) => {
    const dayPeriods = activePeriods.filter((p) => p.days && p.days.includes(day));

    // Rule 2: Nomor JP tidak ganda pada hari yang sama
    const seenNumbers = new Set<number>();
    for (const p of dayPeriods) {
      if (seenNumbers.has(p.periodNumber)) {
        errors.push(
          `Nomor JP ${p.periodNumber} terdaftar lebih dari satu kali pada hari ${dayLabel}.`
        );
      } else {
        seenNumbers.add(p.periodNumber);
      }
    }

    // Rule 3: Interval waktu tidak bertabrakan pada hari yang sama
    for (let i = 0; i < dayPeriods.length; i++) {
      for (let j = i + 1; j < dayPeriods.length; j++) {
        const p1 = dayPeriods[i];
        const p2 = dayPeriods[j];

        const start1 = timeToMinutes(p1.startTime);
        const end1 = timeToMinutes(p1.endTime);
        const start2 = timeToMinutes(p2.startTime);
        const end2 = timeToMinutes(p2.endTime);

        // Dua interval tumpang tindih jika start1 < end2 && start2 < end1
        if (start1 < end2 && start2 < end1) {
          errors.push(
            `Interval waktu bertabrakan pada hari ${dayLabel}: JP ${p1.periodNumber} (${p1.startTime} - ${p1.endTime}) bertabrakan dengan JP ${p2.periodNumber} (${p2.startTime} - ${p2.endTime}).`
          );
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Mendapatkan daftar JP aktif yang berlaku untuk hari tertentu, diurutkan berdasarkan periodNumber
 */
export function getPeriodsForDay(
  config: LessonPeriodConfig | undefined | null,
  day: DayOfWeek
): LessonPeriodItem[] {
  if (!config || !config.periods) return [];
  return config.periods
    .filter((p) => p.isActive && p.days && p.days.includes(day))
    .sort((a, b) => a.periodNumber - b.periodNumber);
}

/**
 * Memformat string JP gabungan dari daftar JP terpilih
 * Contoh: "JP 1 - 2 (07:15 - 08:45)" atau "JP 3 (08:45 - 09:30)"
 */
export function formatSelectedPeriodsDisplay(periods: LessonPeriodItem[]): {
  label: string;
  timeRange: string;
  combinedDisplay: string;
  periodNumbers: number[];
  snapshots: PeriodScheduleSnapshot[];
} {
  if (!periods || periods.length === 0) {
    return {
      label: '-',
      timeRange: '-',
      combinedDisplay: '-',
      periodNumbers: [],
      snapshots: [],
    };
  }

  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  const periodNumbers = sorted.map((p) => p.periodNumber);

  // Label JP
  let label = '';
  if (sorted.length === 1) {
    label = `JP ${sorted[0].periodNumber}`;
  } else {
    // Periksa apakah berurutan
    const isConsecutive = sorted.every((p, idx) => idx === 0 || p.periodNumber === sorted[idx - 1].periodNumber + 1);
    if (isConsecutive) {
      label = `JP ${sorted[0].periodNumber} - ${sorted[sorted.length - 1].periodNumber}`;
    } else {
      label = `JP ${sorted.map((p) => p.periodNumber).join(', ')}`;
    }
  }

  // Time range (dari jam mulai paling awal ke jam selesai paling akhir)
  const earliestStart = sorted.reduce((earliest, p) => (p.startTime < earliest ? p.startTime : earliest), sorted[0].startTime);
  const latestEnd = sorted.reduce((latest, p) => (p.endTime > latest ? p.endTime : latest), sorted[0].endTime);
  const timeRange = `${earliestStart} - ${latestEnd}`;

  const snapshots: PeriodScheduleSnapshot[] = sorted.map((p) => ({
    periodNumber: p.periodNumber,
    periodLabel: `JP ${p.periodNumber}`,
    startTime: p.startTime,
    endTime: p.endTime,
    timeRange: `${p.startTime} - ${p.endTime}`,
  }));

  return {
    label,
    timeRange,
    combinedDisplay: `${label} (${timeRange})`,
    periodNumbers,
    snapshots,
  };
}
