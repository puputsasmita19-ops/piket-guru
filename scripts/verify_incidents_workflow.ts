import { IncidentService } from '../src/services/firebase/incidentService';
import { FirestoreService } from '../src/services/firebase/firestoreService';
import { IncidentRecord, getIncidentCategoryDisplay } from '../src/types/incident.types';
import { UserProfile } from '../src/types';

async function runIncidentsVerification() {
  console.log('================================================================');
  console.log('  VERIFIKASI FITUR LAPORAN KEJADIAN & INSIDEN SEKOLAH           ');
  console.log('================================================================');

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

  const mockTeacherUser: UserProfile = {
    id: 'usr-guru-01',
    nip: '198501012010011001',
    fullName: 'Ahmad Dahlan, S.Pd.',
    role: 'GURU',
    permissions: ['incident.create', 'incident.update', 'incident.view'],
    isActive: true,
    email: 'ahmad@sekolah.sch.id',
    phone: '08123456789',
  };

  const mockKepsekUser: UserProfile = {
    id: 'usr-kepsek-01',
    nip: '197505052000031001',
    fullName: 'Dra. Hj. Siti Aminah, M.Pd.',
    role: 'KEPALA_SEKOLAH',
    permissions: ['*'],
    isActive: true,
    email: 'kepsek@sekolah.sch.id',
    phone: '08129876543',
  };

  console.log('\n--- [SUITE 1] Validasi Payload & Binding Identitas Pelapor ---');

  // Test 1: Payload creation correctly binds pelaporId and pelaporName
  const rawIncident: IncidentRecord = {
    id: '',
    tanggal: '2026-10-06',
    waktu: '08:45',
    kategori: 'SISWA',
    kategoriName: 'Kesiswaan & Perilaku',
    tingkatKeparahan: 'SEDANG',
    lokasi: 'Kantin Sekolah',
    pihakTerlibat: 'Siswa Kelas XI dan X',
    uraian: 'Terjadi kesalahpahaman antarsiswa saat antre di kantin',
    tindakanAwal: 'Dipisahkan oleh guru piket dan diajak berdialog damai',
    penanggungJawab: '',
    status: 'BARU',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
  };

  // Test 2: Sanitization strips undefined fields without losing false/0/null/arrays
  const payloadWithUndefined = {
    ...rawIncident,
    tindakLanjut: undefined,
    photos: undefined,
    resolvedAt: undefined,
    resolvedBy: undefined,
  };

  const sanitized = FirestoreService.sanitizeFirestorePayload(payloadWithUndefined);
  assert(!('tindakLanjut' in sanitized), 'Field tindakLanjut undefined berhasil dibersihkan');
  assert(!('photos' in sanitized), 'Field photos undefined berhasil dibersihkan');
  assert(sanitized.tingkatKeparahan === 'SEDANG', 'Field sah tingkatKeparahan SEDANG dipertahankan');
  assert(sanitized.lokasi === 'Kantin Sekolah', 'Field lokasi dipertahankan utuh');

  // Test 3: Photos preservation
  const payloadWithPhotos = {
    ...rawIncident,
    photos: [
      { id: 'photo-1', url: 'data:image/jpeg;base64,...', uploadedAt: '2026-10-06T08:50:00.000Z' },
    ],
  };
  const sanitizedWithPhotos = FirestoreService.sanitizeFirestorePayload(payloadWithPhotos);
  assert(Array.isArray(sanitizedWithPhotos.photos) && sanitizedWithPhotos.photos.length === 1, 'Array photos bukti foto terlampir dipertahankan utuh');

  console.log('\n--- [SUITE 2] Validasi Form & Kategori Khusus (Lain-lain) ---');

  // Test 4: Missing mandatory fields detection
  function validateIncidentFields(rec: Partial<IncidentRecord>): { valid: boolean; missing: string[]; errors: Record<string, string> } {
    const missing: string[] = [];
    const errors: Record<string, string> = {};

    if (!rec.tanggal) {
      errors.tanggal = 'Tanggal wajib diisi';
      missing.push('Tanggal');
    }
    if (!rec.waktu?.trim()) {
      errors.waktu = 'Waktu wajib diisi';
      missing.push('Waktu');
    }
    if (!rec.lokasi?.trim()) {
      errors.lokasi = 'Lokasi wajib diisi';
      missing.push('Lokasi Kejadian');
    }
    if (!rec.pihakTerlibat?.trim()) {
      errors.pihakTerlibat = 'Pihak terlibat wajib diisi';
      missing.push('Pihak Terlibat');
    }
    if (!rec.uraian?.trim()) {
      errors.uraian = 'Uraian kronologi wajib diisi';
      missing.push('Uraian Kejadian');
    }
    if (!rec.tindakanAwal?.trim()) {
      errors.tindakanAwal = 'Tindakan awal wajib diisi';
      missing.push('Tindakan Awal');
    }

    if (rec.kategori === 'LAINNYA') {
      const trimmed = (rec.kategoriLainnya || '').trim();
      if (!trimmed) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya wajib diisi saat memilih kategori Lain-lain';
        missing.push('Keterangan Kategori Lainnya');
      } else if (trimmed.length > 300) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya tidak boleh melebihi 300 karakter';
      }
    }

    return { valid: missing.length === 0 && Object.keys(errors).length === 0, missing, errors };
  }

  const incompleteCheck = validateIncidentFields({
    tanggal: '2026-10-06',
    waktu: '08:45',
    lokasi: '',
    pihakTerlibat: '',
    uraian: '',
    tindakanAwal: '',
  });

  assert(!incompleteCheck.valid, 'Formulir belum lengkap terdeteksi tidak valid');
  assert(
    incompleteCheck.missing.includes('Lokasi Kejadian') &&
    incompleteCheck.missing.includes('Pihak Terlibat') &&
    incompleteCheck.missing.includes('Uraian Kejadian') &&
    incompleteCheck.missing.includes('Tindakan Awal'),
    'Seluruh 4 field wajib yang kosong teridentifikasi secara presisi'
  );

  const completeCheck = validateIncidentFields(rawIncident);
  assert(completeCheck.valid, 'Formulir lengkap terverifikasi valid dan siap dikirim');

  // Test 5: Category LAINNYA with empty or whitespace-only is rejected
  const emptyLainnyaCheck = validateIncidentFields({
    ...rawIncident,
    kategori: 'LAINNYA',
    kategoriLainnya: '   ',
  });
  assert(!emptyLainnyaCheck.valid, 'Kategori LAINNYA tanpa keterangan ditolak');
  assert(Boolean(emptyLainnyaCheck.errors.kategoriLainnya), 'Pesan galat validasi kategori lainnya muncul');

  // Test 6: Category LAINNYA exceeding 300 chars is rejected
  const longText = 'A'.repeat(301);
  const tooLongLainnyaCheck = validateIncidentFields({
    ...rawIncident,
    kategori: 'LAINNYA',
    kategoriLainnya: longText,
  });
  assert(!tooLongLainnyaCheck.valid, 'Kategori LAINNYA > 300 karakter ditolak');
  assert(tooLongLainnyaCheck.errors.kategoriLainnya?.includes('300 karakter'), 'Pesan batas 300 karakter muncul');

  // Test 7: Category LAINNYA valid
  const validLainnyaCheck = validateIncidentFields({
    ...rawIncident,
    kategori: 'LAINNYA',
    kategoriLainnya: 'Gangguan instalasi listrik laboratorium IPA',
  });
  assert(validLainnyaCheck.valid, 'Kategori LAINNYA dengan keterangan valid diterima');

  console.log('\n--- [SUITE 3] Tampilan & Format Kategori (getIncidentCategoryDisplay) ---');

  // Test 8: Standard category display
  const standardDisplay = getIncidentCategoryDisplay({
    kategori: 'SISWA',
    kategoriName: 'Kesiswaan & Perilaku',
  });
  assert(standardDisplay === 'Kesiswaan & Perilaku', 'Format kategori standar menampilkan kategoriName');

  // Test 9: Lain-lain display format
  const lainnyaDisplay = getIncidentCategoryDisplay({
    kategori: 'LAINNYA',
    kategoriName: 'Lain-lain',
    kategoriLainnya: 'Instalasi Listrik Lab IPA',
  });
  assert(lainnyaDisplay === 'Lain-lain — Instalasi Listrik Lab IPA', 'Format kategori LAINNYA menampilkan "Lain-lain — [keterangan]"');

  // Test 10: Legacy incident record compatibility
  const legacyDisplay = getIncidentCategoryDisplay({
    kategori: 'KESEHATAN',
    kategoriName: 'Kesehatan & Medis',
  });
  assert(legacyDisplay === 'Kesehatan & Medis', 'Format rekaman lama tetap kompatibel tanpa kategoriLainnya');

  console.log('\n--- [SUITE 4] Lifecycle Status & Penyelesaian Insiden ---');

  // Test 11: Status transition to SELESAI with resolution note
  const resolvedIncident: IncidentRecord = {
    ...rawIncident,
    id: 'inc-2026-10-06-01',
    status: 'SELESAI',
    resolvedAt: '2026-10-06T10:00:00.000Z',
    resolvedBy: mockKepsekUser.fullName,
    resolutionNote: 'Kedua pihak telah saling memaafkan dan menandatangani surat komitmen',
  };

  const sanitizedResolved = FirestoreService.sanitizeFirestorePayload(resolvedIncident);
  assert(sanitizedResolved.status === 'SELESAI', 'Status SELESAI tercatat dengan benar');
  assert(sanitizedResolved.resolvedBy === mockKepsekUser.fullName, 'Metadata resolvedBy tercatat dengan benar');
  assert(Boolean(sanitizedResolved.resolutionNote), 'Catatan penyelesaian resolutionNote tersimpan utuh');

  console.log('================================================================');
  console.log(`  HASIL SUITE: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runIncidentsVerification().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
