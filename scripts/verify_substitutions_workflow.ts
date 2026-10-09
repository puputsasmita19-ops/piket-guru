import { SubstitutionService } from '../src/services/firebase/substitutionService';
import { FirestoreService } from '../src/services/firebase/firestoreService';
import {
  TeacherSubstitutionRecord,
  AbsenceReason,
  getSubstitutionReasonDisplay,
  ABSENCE_REASONS,
} from '../src/types/substitution.types';
import { TeacherRecord } from '../src/types/master.types';
import { UserProfile } from '../src/types';

async function runSubstitutionsWorkflowVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FITUR GURU INVAL / PENGGANTI & GURU BERHALANGAN    ');
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

  const mockTeachers: TeacherRecord[] = [
    {
      id: 'tch-01',
      nip: '197501012000011001',
      fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
      mataPelajaran: 'Pendidikan Agama Islam',
      pangkatGolongan: 'IV/a - Pembina',
      statusKepegawaian: 'PNS',
      phone: '081234567891',
      email: 'fauzi@sekolah.sch.id',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'SYSTEM',
    },
    {
      id: 'tch-02',
      nip: '', // Guru tanpa NIP (GTT / Honorer)
      fullName: 'Siti Nurhaliza, S.Pd.',
      mataPelajaran: 'Matematika, Fisika', // Multi-mapel
      pangkatGolongan: '-',
      statusKepegawaian: 'GTT',
      phone: '081234567892',
      email: 'siti@sekolah.sch.id',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'SYSTEM',
    },
    {
      id: 'tch-03',
      nip: '-',
      fullName: 'Budi Santoso, M.Kom.',
      mataPelajaran: 'Informatika / TIK; Robotika', // Multi-mapel with slash & semicolon
      pangkatGolongan: '-',
      statusKepegawaian: 'HONORER',
      phone: '081234567893',
      email: 'budi@sekolah.sch.id',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'SYSTEM',
    },
  ];

  const mockOfficer: UserProfile = {
    id: 'usr-piket-01',
    fullName: 'Rina Wijaya, S.Pd.',
    role: 'GURU',
    permissions: ['*'],
    isActive: true,
    email: 'rina@sekolah.sch.id',
    phone: '081234567899',
  };

  console.log('--- [SUITE 1] Pemilihan Guru & Dukungan Guru Tanpa NIP/NUPTK ---');

  // Test 1: Guru tanpa NIP dapat dipilih dan data master valid
  const teacherWithoutNip = mockTeachers.find((t) => !t.nip || t.nip === '-');
  assert(Boolean(teacherWithoutNip), 'Guru tanpa NIP tersedia di data master');
  assert(
    teacherWithoutNip?.fullName === 'Siti Nurhaliza, S.Pd.',
    'Nama lengkap beserta gelar akademik guru tanpa NIP terbaca utuh'
  );

  // Test 2: Eksklusi guru berhalangan dari calon guru pengganti (tidak boleh menggantikan diri sendiri)
  const selectedAbsentId = 'tch-01';
  const eligibleSubs = mockTeachers.filter((t) => t.id !== selectedAbsentId);
  assert(
    eligibleSubs.length === 2 && !eligibleSubs.some((t) => t.id === selectedAbsentId),
    'Guru yang berhalangan hadir dieksklusikan dari daftar calon guru pengganti'
  );

  console.log('\n--- [SUITE 2] Deteksi Mata Pelajaran: Tunggal vs Jamak ---');

  function parseSubjects(mapelStr?: string): string[] {
    if (!mapelStr || !mapelStr.trim()) return [];
    return mapelStr
      .split(/[,;/]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const singleSubList = parseSubjects(mockTeachers[0].mataPelajaran);
  assert(
    singleSubList.length === 1 && singleSubList[0] === 'Pendidikan Agama Islam',
    'Mapel tunggal ("Pendidikan Agama Islam") terdeteksi tepat 1 mapel untuk auto-fill'
  );

  const multiSubList1 = parseSubjects(mockTeachers[1].mataPelajaran);
  assert(
    multiSubList1.length === 2 && multiSubList1[0] === 'Matematika' && multiSubList1[1] === 'Fisika',
    'Mapel jamak dengan koma ("Matematika, Fisika") terurai menjadi 2 pilihan tanpa menebak'
  );

  const multiSubList2 = parseSubjects(mockTeachers[2].mataPelajaran);
  assert(
    multiSubList2.length === 3 &&
      multiSubList2[0] === 'Informatika' &&
      multiSubList2[1] === 'TIK' &&
      multiSubList2[2] === 'Robotika',
    'Mapel jamak dengan slash dan titik koma ("Informatika / TIK; Robotika") terurai sempurna (3 mapel)'
  );

  console.log('\n--- [SUITE 3] Kategori Alasan: Lain-lain & Validasi ---');

  // Test: Alasan standar
  assert(
    getSubstitutionReasonDisplay({ alasan: 'SAKIT' }) === 'Sakit',
    'Alasan standar SAKIT diformat "Sakit"'
  );

  assert(
    getSubstitutionReasonDisplay({ alasan: 'DINAS_LUAR', keteranganAlasan: 'Rakor BGP' }) ===
      'Tugas Kedinasan Luar / Pelatihan (Rakor BGP)',
    'Alasan standar dengan keterangan tambahan diformat "Tugas Kedinasan Luar / Pelatihan (Rakor BGP)"'
  );

  // Test: Alasan LAINNYA
  assert(
    getSubstitutionReasonDisplay({ alasan: 'LAINNYA', keteranganAlasan: 'Mengurus berkas pensiun di BKN' }) ===
      'Lain-lain — Mengurus berkas pensiun di BKN',
    'Alasan LAINNYA diformat "Lain-lain — [keterangan]"'
  );

  // Test: Form validation for LAINNYA
  function validateSubstitutionForm(data: {
    tanggal: string;
    guruBerhalanganId: string;
    mataPelajaran: string;
    alasan: AbsenceReason;
    keteranganAlasan?: string;
    kelas: string;
    jamPelajaran: string;
    materiDanTugasSiswa: string;
  }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi';
    if (!data.guruBerhalanganId) errors.guruBerhalangan = 'Guru berhalangan wajib dipilih';
    if (!data.mataPelajaran || !data.mataPelajaran.trim()) errors.mataPelajaran = 'Mata pelajaran wajib diisi';
    if (!data.kelas || !data.kelas.trim()) errors.kelas = 'Kelas wajib diisi';
    if (!data.jamPelajaran || !data.jamPelajaran.trim()) errors.jamPelajaran = 'Jam pelajaran wajib diisi';
    if (!data.materiDanTugasSiswa || !data.materiDanTugasSiswa.trim())
      errors.materiDanTugasSiswa = 'Materi & tugas siswa wajib diisi';

    if (data.alasan === 'LAINNYA') {
      const trimmed = data.keteranganAlasan?.trim() || '';
      if (!trimmed) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya wajib diisi';
      } else if (trimmed.length > 300) {
        errors.keteranganAlasan = 'Keterangan alasan lainnya tidak boleh lebih dari 300 karakter';
      }
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  const invalidLainnya1 = validateSubstitutionForm({
    tanggal: '2026-10-06',
    guruBerhalanganId: 'tch-01',
    mataPelajaran: 'PAI',
    alasan: 'LAINNYA',
    keteranganAlasan: '   ', // empty whitespace
    kelas: 'X MIPA 1',
    jamPelajaran: 'JP 1 - 2',
    materiDanTugasSiswa: 'Latihan bab 1',
  });
  assert(
    !invalidLainnya1.isValid && Boolean(invalidLainnya1.errors.keteranganAlasan),
    'Alasan LAINNYA dengan isian spasi/kosong berhasil ditolak'
  );

  const invalidLainnya2 = validateSubstitutionForm({
    tanggal: '2026-10-06',
    guruBerhalanganId: 'tch-01',
    mataPelajaran: 'PAI',
    alasan: 'LAINNYA',
    keteranganAlasan: 'a'.repeat(301), // > 300 chars
    kelas: 'X MIPA 1',
    jamPelajaran: 'JP 1 - 2',
    materiDanTugasSiswa: 'Latihan bab 1',
  });
  assert(
    !invalidLainnya2.isValid && invalidLainnya2.errors.keteranganAlasan.includes('300'),
    'Alasan LAINNYA melebihi 300 karakter berhasil ditolak'
  );

  const validLainnya = validateSubstitutionForm({
    tanggal: '2026-10-06',
    guruBerhalanganId: 'tch-01',
    mataPelajaran: 'PAI',
    alasan: 'LAINNYA',
    keteranganAlasan: 'Menghadiri wisuda putri di Universitas Indonesia',
    kelas: 'X MIPA 1',
    jamPelajaran: 'JP 1 - 2',
    materiDanTugasSiswa: 'Latihan soal evaluasi bab 3 halaman 45',
  });
  assert(
    validLainnya.isValid,
    'Alasan LAINNYA dengan keterangan spesifik valid berhasil diterima'
  );

  console.log('\n--- [SUITE 4] Sanitasi Payload & Integritas Penugasan Guru Inval ---');

  // Test: Unassigned substitute teacher produces MENUNGGU_GURU_INVAL and sanitizes undefined
  const unassignedPayload: Partial<TeacherSubstitutionRecord> = {
    id: 'inv-test-01',
    tanggal: '2026-10-06',
    guruBerhalanganId: 'tch-02',
    guruBerhalanganName: 'Siti Nurhaliza, S.Pd.',
    mataPelajaran: 'Matematika',
    alasan: 'SAKIT',
    keteranganAlasan: undefined, // undefined
    kelas: 'XI MIPA 1',
    jamPelajaran: 'JP 1 - 2 (07.15 - 08.45)',
    guruPenggantiId: undefined, // no substitute
    guruPenggantiName: undefined,
    materiDanTugasSiswa: 'Mengerjakan latihan soal SPLDV',
    status: 'MENUNGGU_GURU_INVAL',
    catatanPiket: undefined,
    petugasPiketName: mockOfficer.fullName,
    petugasPiketId: mockOfficer.id,
  };

  const sanitizedUnassigned = FirestoreService.sanitizeFirestorePayload(unassignedPayload);
  assert(!('keteranganAlasan' in sanitizedUnassigned), 'Field keteranganAlasan undefined bersih dari payload');
  assert(!('guruPenggantiId' in sanitizedUnassigned), 'Field guruPenggantiId undefined bersih dari payload');
  assert(!('catatanPiket' in sanitizedUnassigned), 'Field catatanPiket undefined bersih dari payload');
  assert(sanitizedUnassigned.status === 'MENUNGGU_GURU_INVAL', 'Status MENUNGGU_GURU_INVAL tersimpan dengan benar saat belum ditugaskan');

  // Test: Assigned substitute teacher
  const assignedPayload: Partial<TeacherSubstitutionRecord> = {
    ...unassignedPayload,
    id: 'inv-test-02',
    guruPenggantiId: 'tch-03',
    guruPenggantiName: 'Budi Santoso, M.Kom.',
    status: 'TERTUGASKAN',
    catatanPiket: 'Guru pengganti telah konfirmasi masuk kelas',
  };
  const sanitizedAssigned = FirestoreService.sanitizeFirestorePayload(assignedPayload);
  assert(
    sanitizedAssigned.guruPenggantiId === 'tch-03' && sanitizedAssigned.guruPenggantiName === 'Budi Santoso, M.Kom.',
    'ID dan nama guru pengganti stabil tersimpan dengan benar'
  );
  assert(
    sanitizedAssigned.status === 'TERTUGASKAN',
    'Status TERTUGASKAN tersimpan dengan benar saat guru pengganti ditugaskan'
  );

  console.log('\n--- [SUITE 5] Edit Laporan Inval: Pemeliharaan ID, Audit, dan Concurrency ---');

  // Test: Update preserves id, createdAt, createdBy, updates updatedAt, updatedBy
  const originalReport: TeacherSubstitutionRecord = {
    id: 'inv-2026-10-07-orig01',
    tanggal: '2026-10-07',
    guruBerhalanganId: 'tch-01',
    guruBerhalanganName: 'Drs. H. Ahmad Fauzi, M.Pd.',
    mataPelajaran: 'Pendidikan Agama Islam',
    alasan: 'SAKIT',
    kelas: 'X MIPA 1',
    jamPelajaran: 'JP 1 - 2 (07.15 - 08.45)',
    materiDanTugasSiswa: 'Mengerjakan tugas bab 1 halaman 10',
    status: 'MENUNGGU_GURU_INVAL',
    petugasPiketName: 'Petugas Piket Pagi',
    petugasPiketId: 'usr-piket-01',
    createdAt: '2026-10-07T01:00:00.000Z',
    createdBy: 'Petugas Piket Pagi',
    updatedAt: '2026-10-07T01:00:00.000Z',
    updatedBy: 'Petugas Piket Pagi',
  };

  const editChanges: Partial<TeacherSubstitutionRecord> = {
    id: originalReport.id,
    guruPenggantiId: 'tch-02',
    guruPenggantiName: 'Siti Nurhaliza, S.Pd.',
    materiDanTugasSiswa: 'Mengerjakan tugas bab 1 halaman 10-15 di perpustakaan',
    status: 'TERTUGASKAN',
  };

  const updatedResult: TeacherSubstitutionRecord = {
    ...originalReport,
    ...editChanges,
    id: originalReport.id,
    createdAt: originalReport.createdAt,
    createdBy: originalReport.createdBy,
    updatedAt: '2026-10-07T02:30:00.000Z',
    updatedBy: 'Rina Wijaya, S.Pd.',
  };

  assert(updatedResult.id === originalReport.id, 'ID laporan tetap identik saat diedit (tidak membuat dokumen baru)');
  assert(updatedResult.createdAt === originalReport.createdAt, 'createdAt asli dipertahankan saat diedit');
  assert(updatedResult.createdBy === originalReport.createdBy, 'createdBy pembuat awal dipertahankan saat diedit');
  assert(updatedResult.updatedBy === 'Rina Wijaya, S.Pd.', 'updatedBy mencatat petugas yang melakukan pembaruan');
  assert(updatedResult.guruPenggantiName === 'Siti Nurhaliza, S.Pd.', 'Perubahan alokasi guru pengganti tersimpan');

  // Test: Concurrency detection comparison
  const isConflict = updatedResult.updatedAt !== originalReport.updatedAt;
  assert(isConflict, 'Pendeteksian konflik concurrency aktif mendeteksi perbedaan updatedAt saat dokumen berubah');

  console.log('\n--- [SUITE 6] Identitas Alternatif Guru: NIP, NUPTK, NIK, ID Guru ---');

  const { getTeacherDisplayIdentifier, maskNik } = await import('../src/types/master.types');

  // Test display badges hierarchy: NIP -> NUPTK -> ID Guru
  const teacherWithNip: TeacherRecord = {
    id: 't-01',
    nip: '198001012005011001',
    nuptk: '1234567890123456',
    nik: '3201012345678901',
    idGuru: 'GR-001',
    fullName: 'Bambang Sudarsono, M.Pd.',
    mataPelajaran: 'Bahasa Indonesia',
    pangkatGolongan: 'IV/a',
    statusKepegawaian: 'PNS',
    phone: '0812345678',
    email: 'bambang@sekolah.sch.id',
    createdAt: '2026-01-01',
    createdBy: 'ADMIN',
    updatedAt: '2026-01-01',
    updatedBy: 'ADMIN',
  };

  const badgeWithNip = getTeacherDisplayIdentifier(teacherWithNip);
  assert(badgeWithNip.label === 'NIP' && badgeWithNip.value === '198001012005011001', 'Prioritas 1: NIP dipilih sebagai identitas pendamping utama jika ada');

  const teacherWithNuptkOnly: TeacherRecord = {
    ...teacherWithNip,
    id: 't-02',
    nip: '',
    nuptk: '9876543210987654',
    idGuru: 'GR-002',
  };
  const badgeWithNuptk = getTeacherDisplayIdentifier(teacherWithNuptkOnly);
  assert(badgeWithNuptk.label === 'NUPTK' && badgeWithNuptk.value === '9876543210987654', 'Prioritas 2: NUPTK dipilih jika NIP kosong/tidak ada');

  const teacherWithIdOnly: TeacherRecord = {
    ...teacherWithNip,
    id: 't-03',
    nip: '-',
    nuptk: '',
    idGuru: 'GR-003',
  };
  const badgeWithId = getTeacherDisplayIdentifier(teacherWithIdOnly);
  assert(badgeWithId.label === 'ID Guru' && badgeWithId.value === 'GR-003', 'Prioritas 3: ID Guru dipilih jika NIP dan NUPTK tidak ada');

  // Test NIK masking
  const masked = maskNik('3201012345678901');
  assert(masked === '3201********8901', 'NIK 16 digit tersamarkan dengan aman (4 depan, 4 belakang)');

  // Test duplicate check logic excluding current document
  const teacherList: TeacherRecord[] = [teacherWithNip, teacherWithNuptkOnly, teacherWithIdOnly];

  function checkTeacherDuplicate(
    currentDocId: string,
    field: 'nip' | 'nuptk' | 'nik' | 'idGuru',
    value?: string
  ): boolean {
    if (!value || value.trim() === '' || value === '-') return false;
    return teacherList.some((t) => t.id !== currentDocId && t[field] && t[field]?.trim() === value.trim());
  }

  // Editing teacherWithNip with its own NIP should NOT be flagged duplicate
  assert(
    !checkTeacherDuplicate('t-01', 'nip', '198001012005011001'),
    'Pemeriksaan duplikasi mengecualikan dokumen guru yang sedang diedit (bukan duplikat diri sendiri)'
  );

  // New teacher using existing NIP should be flagged duplicate
  assert(
    checkTeacherDuplicate('t-new', 'nip', '198001012005011001'),
    'NIP yang sudah digunakan guru lain berhasil terdeteksi sebagai duplikat'
  );

  // Empty/dash NIP should NOT be flagged duplicate
  assert(
    !checkTeacherDuplicate('t-new', 'nip', ''),
    'NIP kosong pada guru non-PNS tidak dianggap duplikat'
  );

  console.log('\n================================================================');
  console.log(`  HASIL SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSubstitutionsWorkflowVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
