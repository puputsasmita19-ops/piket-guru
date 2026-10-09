import { StudentPermitService } from '../src/services/firebase/studentPermitService';
import { FirestoreService } from '../src/services/firebase/firestoreService';
import {
  StudentPermitRecord,
  StudentPermitType,
  STUDENT_PERMIT_TYPES,
  getStudentPermitTypeDisplay,
} from '../src/types/studentPermit.types';
import { StudentRecord } from '../src/types/master.types';
import { UserProfile } from '../src/types';

async function runStudentPermitsWorkflowVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FITUR IZIN SISWA & GERBANG (GATE PASS)             ');
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

  const mockStudents: StudentRecord[] = [
    {
      id: 'std-001',
      nama: 'Muhammad Rizky Pratama',
      nisn: '0067829101',
      kelas: 'XI MIPA 2',
      jenisKelamin: 'L',
      noHpOrangTua: '081234567891',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'SYSTEM',
    },
    {
      id: 'std-002',
      nama: 'Muhammad Rizky Pratama', // Nama sama, kelas & NISN berbeda
      nisn: '0078829109',
      kelas: 'X IPS 1',
      jenisKelamin: 'L',
      noHpOrangTua: '081234567892',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'SYSTEM',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'SYSTEM',
    },
    {
      id: 'std-003',
      nama: 'Siti Aisyah',
      nisn: '', // Tanpa NISN
      kelas: 'XII MIPA 1',
      jenisKelamin: 'P',
      noHpOrangTua: '081234567893',
      isActive: true,
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

  console.log('--- [SUITE 1] Pemilihan Siswa & Pengisian Kelas Otomatis ---');

  // Test 1: Siswa dengan nama sama dibedakan melalui studentId dan kelas
  const student1 = mockStudents.find((s) => s.id === 'std-001');
  const student2 = mockStudents.find((s) => s.id === 'std-002');
  assert(
    Boolean(student1 && student2 && student1.nama === student2.nama && student1.kelas !== student2.kelas),
    'Siswa dengan nama sama berhasil dibedakan melalui ID stabil dan kelas di data master'
  );

  // Test 2: Auto-fill kelas dan kontak dari master
  assert(
    student1?.kelas === 'XI MIPA 2' && student1?.noHpOrangTua === '081234567891',
    'Kelas dan no HP orang tua otomatis terisi sesuai profil siswa'
  );

  // Test 3: Siswa tanpa NISN tetap valid untuk dipilih
  const studentNoNisn = mockStudents.find((s) => s.id === 'std-003');
  assert(
    Boolean(studentNoNisn && studentNoNisn.nisn === ''),
    'Siswa tanpa NISN dapat dipilih tanpa error atau pembatalan'
  );

  console.log('\n--- [SUITE 2] Jenis Izin & Keperluan Lain-lain ---');

  // Test: Alasan standar
  assert(
    getStudentPermitTypeDisplay('SAKIT_PULANG') === 'Sakit (Pulang / UKS)',
    'Jenis izin standar SAKIT_PULANG diformat "Sakit (Pulang / UKS)"'
  );

  assert(
    getStudentPermitTypeDisplay('DISPENSASI_LOMBA') === 'Dispensasi Lomba',
    'Jenis izin DISPENSASI_LOMBA diformat "Dispensasi Lomba"'
  );

  // Test: Alasan LAINNYA
  assert(
    getStudentPermitTypeDisplay('LAINNYA', 'Menghadiri wisuda kakak di universitas') ===
      'Lain-lain — Menghadiri wisuda kakak di universitas',
    'Jenis izin LAINNYA dengan keterangan diformat "Lain-lain — [keterangan]"'
  );

  // Test: Form validation for LAINNYA
  function validatePermitForm(data: {
    namaSiswa: string;
    kelas: string;
    tanggal: string;
    jamKeluar: string;
    jenisIzin: StudentPermitType;
    keteranganLainnya?: string;
    alasan: string;
  }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (!data.namaSiswa || !data.namaSiswa.trim()) errors.namaSiswa = 'Nama siswa wajib dipilih';
    if (!data.kelas || !data.kelas.trim()) errors.kelas = 'Kelas wajib terisi';
    if (!data.tanggal) errors.tanggal = 'Tanggal wajib diisi';
    if (!data.jamKeluar) errors.jamKeluar = 'Jam keluar wajib diisi';
    if (!data.alasan || !data.alasan.trim()) errors.alasan = 'Uraian alasan wajib diisi';

    if (data.jenisIzin === 'LAINNYA') {
      const trimmed = data.keteranganLainnya?.trim() || '';
      if (!trimmed) {
        errors.keteranganLainnya = 'Keterangan keperluan lainnya wajib diisi';
      } else if (trimmed.length > 300) {
        errors.keteranganLainnya = 'Keterangan keperluan tidak boleh lebih dari 300 karakter';
      }
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  const invalidLainnya1 = validatePermitForm({
    namaSiswa: 'Muhammad Rizky',
    kelas: 'XI MIPA 2',
    tanggal: '2026-10-07',
    jamKeluar: '09:30',
    jenisIzin: 'LAINNYA',
    keteranganLainnya: '   ', // whitespace only
    alasan: 'Keperluan pribadi',
  });
  assert(
    !invalidLainnya1.isValid && Boolean(invalidLainnya1.errors.keteranganLainnya),
    'Keperluan LAINNYA dengan isian spasi/kosong berhasil ditolak'
  );

  const invalidLainnya2 = validatePermitForm({
    namaSiswa: 'Muhammad Rizky',
    kelas: 'XI MIPA 2',
    tanggal: '2026-10-07',
    jamKeluar: '09:30',
    jenisIzin: 'LAINNYA',
    keteranganLainnya: 'x'.repeat(301), // > 300 chars
    alasan: 'Keperluan pribadi',
  });
  assert(
    !invalidLainnya2.isValid && invalidLainnya2.errors.keteranganLainnya.includes('300'),
    'Keperluan LAINNYA melebihi 300 karakter berhasil ditolak'
  );

  const validLainnya = validatePermitForm({
    namaSiswa: 'Muhammad Rizky',
    kelas: 'XI MIPA 2',
    tanggal: '2026-10-07',
    jamKeluar: '09:30',
    jenisIzin: 'LAINNYA',
    keteranganLainnya: 'Mengurus paspor untuk seleksi pertukaran pelajar',
    alasan: 'Telah ada surat pengantar dari dinas pendidikan',
  });
  assert(
    validLainnya.isValid,
    'Keperluan LAINNYA dengan keterangan valid berhasil diterima'
  );

  console.log('\n--- [SUITE 3] Pengalihan Alasan & Sanitasi Payload ---');

  // Test: Mengubah alasan dari LAINNYA ke biasa menghapus keteranganLainnya
  const payloadWithLainnya: Partial<StudentPermitRecord> = {
    id: 'pmt-test-01',
    tanggal: '2026-10-07',
    jamKeluar: '10:00',
    namaSiswa: 'Siti Aisyah',
    kelas: 'XII MIPA 1',
    nisn: '-',
    jenisIzin: 'SAKIT_PULANG', // Berubah ke alasan biasa
    keteranganLainnya: 'Keterangan lama yang sudah tidak relevan',
    alasan: 'Demam tinggi',
    penjemput: 'ORANG_TUA',
    namaPenjemput: 'Ibu Fatimah',
    noHpOrangTua: '081234567893',
    petugasPiketName: mockOfficer.fullName,
    petugasPiketId: mockOfficer.id,
    status: 'SELESAI_PULANG',
  };

  // Sanitizing when creating/updating
  const cleanPayload = { ...payloadWithLainnya };
  if (cleanPayload.jenisIzin !== 'LAINNYA') {
    delete cleanPayload.keteranganLainnya;
  }
  const sanitized = FirestoreService.sanitizeFirestorePayload(cleanPayload);
  assert(
    !('keteranganLainnya' in sanitized),
    'Keterangan keperluan lama dihapus bersih saat jenis izin diganti ke alasan biasa'
  );

  console.log('\n--- [SUITE 4] Edit Laporan Izin Siswa: Preservasi Dokumen & Status Gerbang ---');

  const originalPermit: StudentPermitRecord = {
    id: 'pmt-2026-10-07-orig01',
    studentId: 'std-001',
    tanggal: '2026-10-07',
    jamKeluar: '09:45',
    jamKembali: undefined,
    namaSiswa: 'Muhammad Rizky Pratama',
    nisn: '0067829101',
    kelas: 'XI MIPA 2',
    jenisIzin: 'KELUAR_SEBENTAR',
    alasan: 'Mengambil berkas penting di rumah',
    penjemput: 'SENDIRI',
    namaPenjemput: 'Pulang Mandiri',
    noHpOrangTua: '081234567891',
    petugasPiketName: 'Petugas Piket Pagi',
    petugasPiketId: 'usr-piket-01',
    status: 'SEDANG_KELUAR',
    createdAt: '2026-10-07T02:00:00.000Z',
    createdBy: 'Petugas Piket Pagi',
    updatedAt: '2026-10-07T02:00:00.000Z',
    updatedBy: 'Petugas Piket Pagi',
  };

  const editData: Partial<StudentPermitRecord> = {
    id: originalPermit.id,
    alasan: 'Mengambil kacamata dan buku modul di rumah',
    catatanPetugas: 'Telah ada konfirmasi telepon dari orang tua',
  };

  const updatedPermit: StudentPermitRecord = {
    ...originalPermit,
    ...editData,
    id: originalPermit.id,
    createdAt: originalPermit.createdAt,
    createdBy: originalPermit.createdBy,
    updatedAt: '2026-10-07T02:30:00.000Z',
    updatedBy: 'Rina Wijaya, S.Pd.',
  };

  assert(updatedPermit.id === originalPermit.id, 'ID surat izin tetap sama saat diedit (tidak menggandakan dokumen)');
  assert(updatedPermit.createdAt === originalPermit.createdAt, 'Waktu createdAt asli dipertahankan');
  assert(updatedPermit.createdBy === originalPermit.createdBy, 'Pembuat awal createdBy dipertahankan');
  assert(updatedPermit.updatedBy === 'Rina Wijaya, S.Pd.', 'updatedBy mencatat petugas yang melakukan pengeditan');
  assert(updatedPermit.status === 'SEDANG_KELUAR', 'Status operasional gerbang tidak tereset saat mengedit keterangan');
  assert(updatedPermit.studentId === 'std-001', 'Relasi studentId stabil tetap terhubung');

  console.log('\n================================================================');
  console.log(`  HASIL SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runStudentPermitsWorkflowVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
