import type { AttendanceRecord, AttendanceStatus } from '../types';

/** Explicit, human-supplied evidence for an administrative checkout correction. */
export type MissingCheckoutEvidenceChannel = 'KONFIRMASI_GURU' | 'CATATAN_PIKET' | 'DOKUMEN_PENDUKUNG';
export type MissingCheckoutEvidence = {
  channel: MissingCheckoutEvidenceChannel;
  note: string;
  acknowledged: boolean;
};

export const MISSING_CHECKOUT_EVIDENCE_LABELS: Record<MissingCheckoutEvidenceChannel, string> = {
  KONFIRMASI_GURU: 'Konfirmasi langsung dari guru',
  CATATAN_PIKET: 'Catatan kegiatan/buku piket',
  DOKUMEN_PENDUKUNG: 'Dokumen pendukung yang diperiksa Admin',
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Pure policy reused by UI, service and Node tests, without fetching private data. */
export function validateMissingCheckoutEvidence(
  record: Pick<AttendanceRecord, 'tanggal' | 'jamMasuk' | 'jamPulang' | 'status'>,
  input: { jamMasuk: string; jamPulang: string | null; status: AttendanceStatus },
  evidence: MissingCheckoutEvidence,
  todayWib: string,
): void {
  if (!isoDate.test(record.tanggal) || !isoDate.test(todayWib) || record.tanggal >= todayWib) {
    throw new Error('Koreksi checkout terlewat hanya untuk tanggal sebelum hari ini.');
  }
  if (record.jamPulang !== null && record.jamPulang !== undefined && record.jamPulang !== '') {
    throw new Error('Sudah ada jam pulang. Gunakan koreksi riwayat biasa bila diperlukan.');
  }
  if (!hhmm.test(input.jamMasuk) || !hhmm.test(input.jamPulang || '')) {
    throw new Error('Jam masuk dan pulang harus valid. Jam pulang harus diisi berdasarkan bukti.');
  }
  const rawCheckin = record.jamMasuk as unknown;
  const actualCheckinMs = typeof rawCheckin === 'string' ? Date.parse(rawCheckin) :
    rawCheckin instanceof Date ? rawCheckin.getTime() :
    rawCheckin && typeof rawCheckin === 'object' && 'toMillis' in rawCheckin && typeof rawCheckin.toMillis === 'function' ? rawCheckin.toMillis() :
    rawCheckin && typeof rawCheckin === 'object' && 'seconds' in rawCheckin && typeof rawCheckin.seconds === 'number' ? rawCheckin.seconds * 1000 : NaN;
  const checkin = new Date(actualCheckinMs);
  const timeWib = Number.isFinite(checkin.getTime()) ? new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(checkin) : '';
  if (!Number.isFinite(actualCheckinMs) || timeWib !== input.jamMasuk || record.status !== input.status) {
    throw new Error('Jam masuk dan status asli tidak boleh diubah dari panel checkout terlewat.');
  }
  const checkoutMs = Date.parse(`${record.tanggal}T${input.jamPulang}:00+07:00`);
  if (!Number.isFinite(checkoutMs) || checkoutMs <= actualCheckinMs || checkoutMs > Date.now()) {
    throw new Error('Jam pulang harus setelah jam masuk dan tidak boleh berada di masa depan.');
  }
  if (!evidence || !Object.hasOwn(MISSING_CHECKOUT_EVIDENCE_LABELS, evidence.channel)) {
    throw new Error('Sumber konfirmasi wajib dipilih.');
  }
  if (evidence.note.trim().length < 10 || evidence.note.trim().length > 300) {
    throw new Error('Catatan konfirmasi wajib 10–300 karakter.');
  }
  if (evidence.acknowledged !== true) {
    throw new Error('Admin harus mengonfirmasi bukti jam pulang dan status sinkronisasi guru.');
  }
}
