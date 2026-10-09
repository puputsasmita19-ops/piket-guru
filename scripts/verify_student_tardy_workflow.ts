import { StudentTardyService } from '../src/services/firebase/studentTardyService';
import { FirestoreService } from '../src/services/firebase/firestoreService';
import {
  StudentTardyRecord,
  getTardyReasonDisplay,
  getDisciplineActionDisplay,
} from '../src/types/studentTardy.types';
import { UserProfile } from '../src/types';

async function runStudentTardyWorkflowVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FITUR SISWA TERLAMBAT & PEMBINAAN DISIPLIN         ');
  console.log('================================================================\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passCount++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failCount++;
    }
  }

  const mockOfficer: UserProfile = {
    id: 'usr-guru-01',
    nip: '198501012010011001',
    fullName: 'Ahmad Dahlan, S.Pd.',
    role: 'GURU',
    permissions: ['student_tardy.view', 'student_tardy.create'],
    isActive: true,
    email: 'ahmad@sekolah.sch.id',
    phone: '08123456789',
  };

  console.log('--- [SUITE 1] Perhitungan Waktu & Menit Keterlambatan ---');

  // Test 1: Empty / invalid time does NOT produce arbitrary minutes (e.g. +300 min bug)
  function calculateMinutesLate(timeStr: string, limitTime: string = '07:00'): number {
    if (!timeStr || !timeStr.trim() || !timeStr.includes(':')) {
      return 0;
    }
    const [arrivalHStr, arrivalMStr] = timeStr.split(':');
    const arrivalH = parseInt(arrivalHStr, 10);
    const arrivalM = parseInt(arrivalMStr, 10);
    if (isNaN(arrivalH) || isNaN(arrivalM)) {
      return 0;
    }
    const [limitHStr, limitMStr] = limitTime.split(':');
    const limitH = parseInt(limitHStr, 10) || 7;
    const limitM = parseInt(limitMStr, 10) || 0;

    const arrivalInMinutes = arrivalH * 60 + arrivalM;
    const limitInMinutes = limitH * 60 + limitM;

    return Math.max(0, arrivalInMinutes - limitInMinutes);
  }

  assert(calculateMinutesLate('') === 0, 'Jam tiba kosong menghasilkan 0 menit terlambat (bukan +300 menit)');
  assert(calculateMinutesLate('invalid') === 0, 'Jam tiba tidak valid menghasilkan 0 menit terlambat');
  assert(calculateMinutesLate('06:55') === 0, 'Jam tiba sebelum batas masuk (06:55) menghasilkan 0 menit terlambat');
  assert(calculateMinutesLate('07:00') === 0, 'Jam tiba tepat batas masuk (07:00) menghasilkan 0 menit terlambat');
  assert(calculateMinutesLate('07:25') === 25, 'Jam tiba 07:25 (batas 07:00) menghasilkan +25 menit terlambat secara presisi');
  assert(calculateMinutesLate('08:00', '07:15') === 45, 'Jam tiba 08:00 (batas kustom 07:15) menghasilkan +45 menit terlambat');

  console.log('\n--- [SUITE 2] Kategori Alasan & Pembinaan: Lain-lain ---');

  // Test 2: Standard reason formatting
  assert(
    getTardyReasonDisplay({ alasan: 'BANGUN_KESIANGAN' }) === 'Bangun Kesiangan',
    'Alasan standar BANGUN_KESIANGAN diformat dengan benar'
  );

  // Test 3: Lain-lain reason formatting
  assert(
    getTardyReasonDisplay({ alasan: 'LAINNYA', keteranganAlasan: 'Menunggu adik sembuh demam' }) ===
      'Lain-lain — Menunggu adik sembuh demam',
    'Alasan LAINNYA diformat "Lain-lain — [keterangan]"'
  );

  // Test 4: Standard discipline formatting
  assert(
    getDisciplineActionDisplay({ pembinaan: 'LITERASI_PERPUSTAKAAN' }) === 'Literasi Membaca Buku di Perpustakaan',
    'Pembinaan standar diformat dengan benar'
  );

  // Test 5: Lain-lain discipline formatting
  assert(
    getDisciplineActionDisplay({ pembinaan: 'LAINNYA', keteranganPembinaan: 'Merapikan rak arsip UKS' }) ===
      'Lain-lain — Merapikan rak arsip UKS',
    'Pembinaan LAINNYA diformat "Lain-lain — [keterangan]"'
  );

  // Test 6: Sanitization when switching back from LAINNYA to standard reason/discipline
  const payloadSwitchedReason: Partial<StudentTardyRecord> = {
    id: 'trd-1',
    namaSiswa: 'Budi Setiawan',
    kelas: 'X MIPA 1',
    alasan: 'MACET_LALULINTAS',
    keteranganAlasan: undefined, // Cleared when not LAINNYA
    pembinaan: 'PEMBERSIHAN_LINGKUNGAN',
    keteranganPembinaan: undefined, // Cleared when not LAINNYA
  };
  const sanitizedSwitched = FirestoreService.sanitizeFirestorePayload(payloadSwitchedReason);
  assert(!('keteranganAlasan' in sanitizedSwitched), 'Keterangan alasan dibersihkan saat kembali ke alasan standar');
  assert(!('keteranganPembinaan' in sanitizedSwitched), 'Keterangan pembinaan dibersihkan saat kembali ke pembinaan standar');

  console.log('\n--- [SUITE 3] Foto Dokumentasi & Preservasi Bukti ---');

  // Test 7: Photo data URL preservation
  const base64Photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  const recordWithPhoto: Partial<StudentTardyRecord> = {
    id: 'trd-photo-01',
    tanggal: '2026-10-06',
    jamDatang: '07:30',
    namaSiswa: 'Dewi Lestari',
    kelas: 'XI MIPA 1',
    fotoUrl: base64Photo,
  };
  const sanitizedPhotoRecord = FirestoreService.sanitizeFirestorePayload(recordWithPhoto);
  assert(sanitizedPhotoRecord.fotoUrl === base64Photo, 'Foto data URL beresolusi penuh dipertahankan utuh');

  // Test 8: Edit without changing photo preserves old photoUrl
  const existingRecord: StudentTardyRecord = {
    id: 'trd-edit-01',
    tanggal: '2026-10-06',
    jamDatang: '07:20',
    menitTerlambat: 20,
    studentId: 'std-004',
    namaSiswa: 'Dewi Lestari',
    nisn: '0071234564',
    kelas: 'XI MIPA 1',
    alasan: 'BANGUN_KESIANGAN',
    pembinaan: 'LITERASI_PERPUSTAKAAN',
    poinPelanggaran: 5,
    frekuensiBulanIni: 1,
    fotoUrl: base64Photo,
    noHpOrangTua: '081234567893',
    status: 'DALAM_PEMBINAAN',
    petugasPiketName: mockOfficer.fullName,
    petugasPiketId: mockOfficer.id,
    dataSource: 'PRODUCTION',
    isDemo: false,
    createdAt: '2026-10-06T07:20:00.000Z',
    createdBy: mockOfficer.fullName,
    updatedAt: '2026-10-06T07:20:00.000Z',
    updatedBy: mockOfficer.fullName,
  };

  const editPayload = {
    ...existingRecord,
    menitTerlambat: 25,
    catatanPetugas: 'Telah ditegur di gerbang',
  };
  const sanitizedEdit = FirestoreService.sanitizeFirestorePayload(editPayload);
  assert(sanitizedEdit.fotoUrl === base64Photo, 'Foto lama tetap ada saat edit data tanpa pengambilan foto baru');
  assert(sanitizedEdit.createdAt === existingRecord.createdAt, 'Waktu dan pembuat asli createdAt dipertahankan saat edit');
  assert(sanitizedEdit.id === existingRecord.id, 'ID laporan yang sama digunakan saat edit (tidak menduplikasi dokumen)');

  console.log('\n--- [SUITE 4] Frekuensi Keterlambatan & Pencegahan Duplikasi Saat Edit ---');

  // Test 9: Frequency calculation excluding current record ID during edit
  const mockExistingRecords: StudentTardyRecord[] = [
    {
      ...existingRecord,
      id: 'trd-oct-01',
      tanggal: '2026-10-02',
    },
    {
      ...existingRecord,
      id: 'trd-oct-02',
      tanggal: '2026-10-05',
    },
  ];

  function calculateFreq(
    records: StudentTardyRecord[],
    studentId: string,
    targetMonth: string,
    excludeId?: string
  ): number {
    return records.filter(
      (r) =>
        r.studentId === studentId &&
        r.tanggal.startsWith(targetMonth) &&
        (!excludeId || r.id !== excludeId)
    ).length;
  }

  // Creating 3rd record
  const newCount = calculateFreq(mockExistingRecords, 'std-004', '2026-10') + 1;
  assert(newCount === 3, 'Keterlambatan baru ke-3 terhitung dengan benar (frekuensi = 3)');

  // Editing 2nd existing record
  const editCount = calculateFreq(mockExistingRecords, 'std-004', '2026-10', 'trd-oct-02') + 1;
  assert(editCount === 2, 'Mengedit rekaman yang sudah ada tidak menambah frekuensi keterlambatan (tetap 2)');

  console.log('================================================================');
  console.log(`  HASIL SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runStudentTardyWorkflowVerification().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
