import * as fs from 'fs';
import * as path from 'path';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

/**
 * Patch INSIDEN-20261007-R1 Emulator Test Suite
 * Target Project: demo-incident-repair
 */
async function runIncidentFixEmulatorTests() {
  console.log('================================================================');
  console.log('  FIRESTORE RULES EMULATOR TEST SUITE: INSIDEN-20261007-R1       ');
  console.log('  Target Project: demo-incident-repair                          ');
  console.log('================================================================\n');

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    console.log('[RULES_TEST] FIRESTORE_EMULATOR_HOST belum diset.');
    console.log('[RULES_TEST] Jalankan via: firebase emulators:exec --project demo-incident-repair --only firestore "npx tsx scripts/test_incident_fix_emulator.ts"');
    console.log('[FAIL_CLOSED] Gagal tertutup (emulator tidak aktif).\n');
    return false;
  }

  const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-incident-repair',
      firestore: {
        rules: rulesContent,
        host: emulatorHost.split(':')[0],
        port: parseInt(emulatorHost.split(':')[1], 10),
      },
    });
  } catch (err: any) {
    console.error(`[FAIL_CLOSED] Gagal menginisialisasi RulesTestEnvironment: ${err.message}`);
    return false;
  }

  // Clear and seed test fixtures
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Seed Active Admin
    await db.collection('users').doc('usr-admin-01').set({
      id: 'usr-admin-01',
      nip: '198503152010011002',
      fullName: 'Administrator Sistem',
      role: 'ADMIN',
      isActive: true,
      permissions: ['*'],
      sessionRevokedAtSeconds: 0,
    });

    // 2. Seed Active Kepala Sekolah
    await db.collection('users').doc('usr-kepsek-01').set({
      id: 'usr-kepsek-01',
      nip: '197501011999031001',
      fullName: 'Dra. Hj. Siti Aminah, M.Pd.',
      role: 'KEPALA_SEKOLAH',
      isActive: true,
      permissions: ['*'],
      sessionRevokedAtSeconds: 0,
    });

    // 3. Seed Active Guru 1 (Reporter)
    await db.collection('users').doc('usr-guru-01').set({
      id: 'usr-guru-01',
      nip: '199002022015042001',
      fullName: 'Ahmad Dahlan, S.Pd.',
      role: 'GURU',
      isActive: true,
      permissions: ['incident.create', 'incident.update', 'incident.view'],
      sessionRevokedAtSeconds: 1000,
    });

    // 4. Seed Active Guru 2 (Other teacher)
    await db.collection('users').doc('usr-guru-02').set({
      id: 'usr-guru-02',
      nip: '199002022015042002',
      fullName: 'Budi Santoso, M.Kom.',
      role: 'GURU',
      isActive: true,
      permissions: ['incident.create', 'incident.update', 'incident.view'],
      sessionRevokedAtSeconds: 0,
    });

    // 5. Seed Inactive Guru
    await db.collection('users').doc('usr-inactive-01').set({
      id: 'usr-inactive-01',
      nip: '199002022015042099',
      fullName: 'Guru Nonaktif',
      role: 'GURU',
      isActive: false,
      permissions: ['incident.create'],
      sessionRevokedAtSeconds: 0,
    });
  });

  let passed = 0;
  let failed = 0;

  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // TEST 1: Guru can create incident with status 'BARU' bound to own pelaporId
  await check('Guru CAN create incident report with status BARU bound to own pelaporId', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-01').set({
        id: 'inc-test-01',
        tanggal: '2026-10-06',
        waktu: '08:30',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan & Perilaku',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Kantin Sekolah',
        pihakTerlibat: 'Siswa Kelas XI',
        uraian: 'Terjadi perselisihan antre kantin',
        tindakanAwal: 'Dilerai dan dinasehati',
        pelaporId: 'usr-guru-01',
        pelaporName: 'Ahmad Dahlan, S.Pd.',
        penanggungJawab: 'Ahmad Dahlan, S.Pd.',
        status: 'BARU',
        createdAt: '2026-10-06T08:30:00.000Z',
        updatedAt: '2026-10-06T08:30:00.000Z',
      })
    );
  });

  // TEST 2: Guru can create incident with status 'DILAPORKAN' for backward compatibility
  await check('Guru CAN create incident report with status DILAPORKAN (backward compatibility)', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-dilaporkan').set({
        id: 'inc-test-dilaporkan',
        tanggal: '2026-10-06',
        waktu: '08:45',
        kategori: 'FASILITAS',
        kategoriName: 'Sarana & Prasarana',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Laboratorium Komputer',
        pihakTerlibat: 'Fasilitas Umum',
        uraian: 'AC laboratorium mati',
        tindakanAwal: 'Mematikan stop kontak',
        pelaporId: 'usr-guru-01',
        pelaporName: 'Ahmad Dahlan, S.Pd.',
        penanggungJawab: 'Ahmad Dahlan, S.Pd.',
        status: 'DILAPORKAN',
        createdAt: '2026-10-06T08:45:00.000Z',
        updatedAt: '2026-10-06T08:45:00.000Z',
      })
    );
  });

  // TEST 3: Guru can create incident with category 'LAINNYA' and 'kategoriLainnya'
  await check('Guru CAN create incident with category LAINNYA and structured kategoriLainnya', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-lainnya').set({
        id: 'inc-test-lainnya',
        tanggal: '2026-10-06',
        waktu: '09:00',
        kategori: 'LAINNYA',
        kategoriName: 'Lain-lain',
        kategoriLainnya: 'Instalasi Listrik Lab IPA',
        tingkatKeparahan: 'TINGGI',
        lokasi: 'Lab IPA Gedung B',
        pihakTerlibat: 'Siswa Kelas XII',
        uraian: 'Bau hangus tercium dekat panel listrik',
        tindakanAwal: 'Mematikan MCB utama lab IPA',
        pelaporId: 'usr-guru-01',
        pelaporName: 'Ahmad Dahlan, S.Pd.',
        penanggungJawab: 'Ahmad Dahlan, S.Pd.',
        status: 'BARU',
        createdAt: '2026-10-06T09:00:00.000Z',
        updatedAt: '2026-10-06T09:00:00.000Z',
      })
    );
  });

  // TEST 4: Atomic Batch Write (Incident + Audit Log)
  await check('Guru CAN write incident and audit log atomically in single batch', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    const batch = guruDb.batch();

    const incRef = guruDb.collection('incidents').doc('inc-batch-01');
    batch.set(incRef, {
      id: 'inc-batch-01',
      tanggal: '2026-10-06',
      waktu: '09:15',
      kategori: 'SISWA',
      kategoriName: 'Kesiswaan & Perilaku',
      tingkatKeparahan: 'RENDAH',
      lokasi: 'Koridor Utama',
      pihakTerlibat: '1 Siswa Kelas X',
      uraian: 'Atribut seragam tidak lengkap',
      tindakanAwal: 'Diberikan peringatan lisan',
      pelaporId: 'usr-guru-01',
      pelaporName: 'Ahmad Dahlan, S.Pd.',
      penanggungJawab: 'Ahmad Dahlan, S.Pd.',
      status: 'BARU',
      createdAt: '2026-10-06T09:15:00.000Z',
      updatedAt: '2026-10-06T09:15:00.000Z',
    });

    const auditRef = guruDb.collection('auditLogs').doc('audit-inc-batch-01');
    batch.set(auditRef, {
      id: 'audit-inc-batch-01',
      timestamp: '2026-10-06T09:15:00.000Z',
      userId: 'usr-guru-01',
      userName: 'Ahmad Dahlan, S.Pd.',
      role: 'GURU',
      action: 'CREATE',
      module: 'INCIDENTS',
      recordId: 'inc-batch-01',
      details: 'Melaporkan kejadian: [SISWA] Atribut seragam tidak lengkap',
    });

    await assertSucceeds(batch.commit());
  });

  // TEST 5: Guru CANNOT impersonate another user's pelaporId
  await check('Guru CANNOT create incident report with another pelaporId (impersonation rejected)', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertFails(
      guruDb.collection('incidents').doc('inc-impersonate-01').set({
        id: 'inc-impersonate-01',
        tanggal: '2026-10-06',
        waktu: '09:30',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan & Perilaku',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Kantin',
        pihakTerlibat: 'Siswa',
        uraian: 'Uraian insiden palsu',
        tindakanAwal: 'Tindakan palsu',
        pelaporId: 'usr-guru-02', // FORBIDDEN
        pelaporName: 'Budi Santoso, M.Kom.',
        penanggungJawab: 'Budi Santoso, M.Kom.',
        status: 'BARU',
        createdAt: '2026-10-06T09:30:00.000Z',
      })
    );
  });

  // TEST 6: Reporter CAN update own incident details
  await check('Reporter CAN update own incident report details', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-01').update({
        tindakLanjut: 'Diserahkan ke Guru BK untuk pendampingan',
        updatedAt: '2026-10-06T09:40:00.000Z',
      })
    );
  });

  // TEST 7: Other teacher CANNOT modify another teacher's incident report
  await check('Other teacher CANNOT modify someone elses incident report', async () => {
    const guru2Db = testEnv.authenticatedContext('usr-guru-02', { auth_time: 1001 }).firestore();
    await assertFails(
      guru2Db.collection('incidents').doc('inc-test-01').update({
        tindakLanjut: 'Diubah secara tidak sah oleh Guru 2',
      })
    );
  });

  // TEST 8: Kepala Sekolah CAN resolve incident to SELESAI
  await check('Kepala Sekolah CAN resolve incident to SELESAI with resolutionNote', async () => {
    const kepsekDb = testEnv.authenticatedContext('usr-kepsek-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      kepsekDb.collection('incidents').doc('inc-test-01').update({
        status: 'SELESAI',
        resolvedAt: '2026-10-06T10:00:00.000Z',
        resolvedBy: 'Dra. Hj. Siti Aminah, M.Pd.',
        resolutionNote: 'Kedua pihak siswa telah berdamai dan menandatangani komitmen',
        updatedAt: '2026-10-06T10:00:00.000Z',
      })
    );
  });

  // TEST 9: Inactive user is DENIED
  await check('Inactive user is DENIED creating incident report', async () => {
    const inactiveDb = testEnv.authenticatedContext('usr-inactive-01', { auth_time: 1000 }).firestore();
    await assertFails(
      inactiveDb.collection('incidents').doc('inc-inactive-01').set({
        id: 'inc-inactive-01',
        tanggal: '2026-10-06',
        waktu: '10:00',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Pos Piket',
        pihakTerlibat: 'Siswa',
        uraian: 'Laporan akun nonaktif',
        tindakanAwal: 'Tindakan awal',
        pelaporId: 'usr-inactive-01',
        status: 'BARU',
        createdAt: '2026-10-06T10:00:00.000Z',
      })
    );
  });

  // TEST 10: Revoked session token is DENIED
  await check('Revoked session token (auth_time <= sessionRevokedAtSeconds) is DENIED', async () => {
    // usr-guru-01 has sessionRevokedAtSeconds = 1000, auth_time = 1000
    const revokedDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1000 }).firestore();
    await assertFails(
      revokedDb.collection('incidents').doc('inc-revoked-01').set({
        id: 'inc-revoked-01',
        tanggal: '2026-10-06',
        waktu: '10:00',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Pos Piket',
        pihakTerlibat: 'Siswa',
        uraian: 'Laporan sesi kedaluwarsa',
        tindakanAwal: 'Tindakan awal',
        pelaporId: 'usr-guru-01',
        status: 'BARU',
        createdAt: '2026-10-06T10:00:00.000Z',
      })
    );
  });

  await testEnv.cleanup();

  console.log('\n================================================================');
  console.log(`  HASIL EMULATOR TEST SUITE: ${passed} PASS, ${failed} FAIL (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  return failed === 0;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('test_incident_fix_emulator.ts')) {
  runIncidentFixEmulatorTests().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}

export { runIncidentFixEmulatorTests };
