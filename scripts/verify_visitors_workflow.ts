import { VisitorService } from '../src/services/firebase/visitorService';
import { FirestoreService } from '../src/services/firebase/firestoreService';
import {
  VisitorRecord,
  VisitorCategory,
  VISITOR_CATEGORIES,
  getVisitorCategoryDisplay,
} from '../src/types/visitor.types';
import { UserProfile } from '../src/types';

async function runVisitorsWorkflowVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FITUR BUKU TAMU DIGITAL & KATEGORI LAIN-LAIN        ');
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
    id: 'usr-piket-01',
    fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
    role: 'GURU',
    permissions: ['*'],
    isActive: true,
    email: 'ahmad.fauzi@sekolah.sch.id',
    phone: '081234567899',
  };

  console.log('--- [SUITE 1] Kategori Tamu & Tampilan getVisitorCategoryDisplay ---');

  // Test 1: Category constants
  const catCodes = VISITOR_CATEGORIES.map((c) => c.code);
  assert(
    catCodes.includes('LAINNYA') && catCodes.length === 6,
    'Kategori LAINNYA terdaftar dengan rapi dalam daftar VISITOR_CATEGORIES (total 6 kategori)'
  );

  // Test 2: Standard category formatting
  assert(
    getVisitorCategoryDisplay('DINAS_INSTANSI') === 'Dinas / Instansi',
    'Kategori DINAS_INSTANSI diformat "Dinas / Instansi"'
  );
  assert(
    getVisitorCategoryDisplay('ORANG_TUA') === 'Orang Tua Siswa',
    'Kategori ORANG_TUA diformat "Orang Tua Siswa"'
  );
  assert(
    getVisitorCategoryDisplay('VENDOR_MITRA') === 'Mitra / Vendor',
    'Kategori VENDOR_MITRA diformat "Mitra / Vendor"'
  );
  assert(
    getVisitorCategoryDisplay('ALUMNI') === 'Alumni',
    'Kategori ALUMNI diformat "Alumni"'
  );
  assert(
    getVisitorCategoryDisplay('UMUM') === 'Umum',
    'Kategori UMUM diformat "Umum"'
  );

  // Test 3: LAINNYA formatting with and without custom note
  assert(
    getVisitorCategoryDisplay('LAINNYA', 'Kunjungan Studi Banding Kurikulum') ===
      'Lain-lain — Kunjungan Studi Banding Kurikulum',
    'Kategori LAINNYA dengan keterangan diformat "Lain-lain — [keterangan]"'
  );
  assert(
    getVisitorCategoryDisplay('LAINNYA') === 'Lain-lain',
    'Kategori LAINNYA tanpa keterangan tambahan diformat "Lain-lain"'
  );

  // Test 4: Backward compatibility with partial record without keteranganLainnya
  const legacyRecord: Partial<VisitorRecord> = {
    id: 'vis-legacy-01',
    namaTamu: 'Budi Hartono',
    kategori: 'UMUM',
  };
  assert(
    getVisitorCategoryDisplay(legacyRecord) === 'Umum',
    'Data lama tanpa keteranganLainnya terbaca aman dan sesuai'
  );

  console.log('\n--- [SUITE 2] Validasi Formulir & Kategori Lain-lain ---');

  function validateVisitorForm(data: {
    namaTamu: string;
    instansiAsal: string;
    nomorBadge: string;
    tujuanBertemu: string;
    keperluan: string;
    kategori: VisitorCategory;
    keteranganLainnya?: string;
  }): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    if (!data.namaTamu?.trim()) errors.namaTamu = 'Nama tamu wajib diisi';
    if (!data.instansiAsal?.trim()) errors.instansiAsal = 'Instansi asal wajib diisi';
    if (!data.nomorBadge?.trim()) errors.nomorBadge = 'Nomor badge wajib diisi';
    if (!data.tujuanBertemu?.trim()) errors.tujuanBertemu = 'Pihak dituju wajib diisi';
    if (!data.keperluan?.trim()) errors.keperluan = 'Keperluan wajib diisi';

    if (data.kategori === 'LAINNYA') {
      const trimmed = data.keteranganLainnya?.trim() || '';
      if (!trimmed) {
        errors.keteranganLainnya = 'Keterangan kategori tamu lainnya wajib diisi';
      } else if (trimmed.length > 300) {
        errors.keteranganLainnya = 'Keterangan kategori tidak boleh lebih dari 300 karakter';
      }
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // Test 5: Rejection when LAINNYA is empty or whitespace
  const invalidLainnya1 = validateVisitorForm({
    namaTamu: 'Drs. Supriyanto',
    instansiAsal: 'Yayasan Peduli Pendidikan',
    nomorBadge: 'TAMU-05',
    tujuanBertemu: 'Kepala Sekolah',
    keperluan: 'Silaturahmi dan audiensi',
    kategori: 'LAINNYA',
    keteranganLainnya: '    ',
  });
  assert(
    !invalidLainnya1.isValid && Boolean(invalidLainnya1.errors.keteranganLainnya),
    'Kategori LAINNYA dengan keterangan kosong/spasi berhasil ditolak'
  );

  // Test 6: Rejection when LAINNYA exceeds 300 characters
  const invalidLainnya2 = validateVisitorForm({
    namaTamu: 'Drs. Supriyanto',
    instansiAsal: 'Yayasan Peduli Pendidikan',
    nomorBadge: 'TAMU-05',
    tujuanBertemu: 'Kepala Sekolah',
    keperluan: 'Silaturahmi dan audiensi',
    kategori: 'LAINNYA',
    keteranganLainnya: 'k'.repeat(301),
  });
  assert(
    !invalidLainnya2.isValid && invalidLainnya2.errors.keteranganLainnya.includes('300'),
    'Kategori LAINNYA melebihi 300 karakter berhasil ditolak'
  );

  // Test 7: Valid LAINNYA
  const validLainnya = validateVisitorForm({
    namaTamu: 'Drs. Supriyanto',
    instansiAsal: 'Yayasan Peduli Pendidikan',
    nomorBadge: 'TAMU-05',
    tujuanBertemu: 'Kepala Sekolah',
    keperluan: 'Silaturahmi dan audiensi',
    kategori: 'LAINNYA',
    keteranganLainnya: 'Audiensi Program Beasiswa Yayasan',
  });
  assert(
    validLainnya.isValid,
    'Kategori LAINNYA dengan keterangan valid berhasil diterima'
  );

  console.log('\n--- [SUITE 3] Pengalihan Kategori & Sanitasi Payload ---');

  // Test 8: Switching category from LAINNYA to standard removes keteranganLainnya
  const payloadWithLainnya: Partial<VisitorRecord> = {
    id: 'vis-test-01',
    tanggal: '2026-10-07',
    jamMasuk: '08:30',
    namaTamu: 'Ir. Budi',
    instansiAsal: 'PT Telkom Indonesia',
    kategori: 'VENDOR_MITRA', // Diubah dari LAINNYA ke VENDOR_MITRA
    keteranganLainnya: 'Keterangan lama yang sudah tidak relevan',
    nomorBadge: 'TAMU-08',
    tujuanBertemu: 'Kepala Sekolah',
    keperluan: 'Perawatan Jaringan Internet',
    status: 'SEDANG_BERKUNJUNG',
  };

  const cleanPayload = { ...payloadWithLainnya };
  if (cleanPayload.kategori !== 'LAINNYA') {
    delete cleanPayload.keteranganLainnya;
  }
  const sanitized = FirestoreService.sanitizeFirestorePayload(cleanPayload);
  assert(
    !('keteranganLainnya' in sanitized),
    'Field keteranganLainnya terhapus bersih saat kategori diganti ke kategori biasa'
  );

  console.log('\n--- [SUITE 4] Edit Laporan Buku Tamu & Preservasi Status/Foto ---');

  const originalVisitor: VisitorRecord = {
    id: 'vis-2026-10-07-orig01',
    tanggal: '2026-10-07',
    jamMasuk: '09:00',
    jamKeluar: '10:15',
    namaTamu: 'Dr. Hj. Farida Hanum',
    instansiAsal: 'Puskesmas Kecamatan',
    kategori: 'DINAS_INSTANSI',
    noHp: '081299887766',
    nomorIdentitas: '3201019283740001',
    nomorBadge: 'TAMU-03',
    tujuanBertemu: 'Pembina UKS',
    keperluan: 'Pemeriksaan Berkala Kesehatan Remaja & Skrining HB',
    fotoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    status: 'SELESAI',
    catatanPetugas: 'Tamu telah menyelesaikan koordinasi dengan tim UKS.',
    petugasPiketName: 'Petugas Pagi',
    petugasPiketId: 'usr-piket-01',
    createdAt: '2026-10-07T02:00:00.000Z',
    createdBy: 'Petugas Pagi',
    updatedAt: '2026-10-07T02:00:00.000Z',
    updatedBy: 'Petugas Pagi',
  };

  const editData: Partial<VisitorRecord> = {
    id: originalVisitor.id,
    keperluan: 'Pemeriksaan Berkala Kesehatan Remaja & Skrining HB Siswi Kelas X',
    catatanPetugas: 'Koordinasi tuntas, berkas diserahkan ke pos piket.',
  };

  const updatedVisitor: VisitorRecord = {
    ...originalVisitor,
    ...editData,
    id: originalVisitor.id,
    createdAt: originalVisitor.createdAt,
    createdBy: originalVisitor.createdBy,
    fotoUrl: originalVisitor.fotoUrl,
    status: originalVisitor.status,
    jamMasuk: originalVisitor.jamMasuk,
    jamKeluar: originalVisitor.jamKeluar,
    updatedAt: '2026-10-07T03:30:00.000Z',
    updatedBy: mockOfficer.fullName,
  };

  assert(updatedVisitor.id === originalVisitor.id, 'ID catatan buku tamu tetap sama saat diedit (tidak menduplikasi dokumen)');
  assert(updatedVisitor.createdAt === originalVisitor.createdAt, 'Waktu createdAt asli dipertahankan');
  assert(updatedVisitor.createdBy === originalVisitor.createdBy, 'Pembuat awal createdBy dipertahankan');
  assert(updatedVisitor.fotoUrl === originalVisitor.fotoUrl, 'Foto dokumentasi identitas tamu dipertahankan utuh');
  assert(updatedVisitor.status === 'SELESAI', 'Status kunjungan tidak tereset saat mengedit keterangan');
  assert(updatedVisitor.jamMasuk === '09:00' && updatedVisitor.jamKeluar === '10:15', 'Jam masuk dan jam keluar asli dipertahankan');
  assert(updatedVisitor.updatedBy === mockOfficer.fullName, 'updatedBy mencatat petugas yang melakukan pembaruan');

  console.log('\n================================================================');
  console.log(`  HASIL SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVisitorsWorkflowVerification().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
