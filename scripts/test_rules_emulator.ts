import * as fs from 'fs';
import * as path from 'path';
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

/**
 * Real Firestore Rules Test Suite using @firebase/rules-unit-testing.
 * Project ID: demo-piket-guru
 * Pre-seeds active user profiles and target documents deterministically.
 */
async function runEmulatorRulesTests() {
  console.log('====================================================');
  console.log('  FIRESTORE SECURITY RULES EMULATOR TEST SUITE      ');
  console.log('====================================================\n');

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    console.log('[RULES_TEST] FIRESTORE_EMULATOR_HOST belum diset.');
    console.log('[RULES_TEST] Untuk menjalankan test emulator:');
    console.log('  1. Jalankan emulator: firebase emulators:start --only firestore');
    console.log('  2. Ekspor environment: export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"');
    console.log('  3. Jalankan suite ini.\n');
    console.log('[FAIL_CLOSED] Sesuai kebijakan audit: Gagal tertutup (emulator tidak aktif).\n');
    return false;
  }

  const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');

  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-piket-guru',
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

  // Clear database and seed initial test fixtures
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    // Seed Active Admin
    await db.collection('users').doc('usr-admin-01').set({
      id: 'usr-admin-01',
      nip: '198503152010011002',
      fullName: 'Administrator Sistem',
      role: 'ADMIN',
      isActive: true,
      permissions: ['*'],
      sessionRevokedAtSeconds: 0,
    });

    // Seed Active Kepala Sekolah
    await db.collection('users').doc('usr-kepsek-01').set({
      id: 'usr-kepsek-01',
      nip: '197501011999031001',
      fullName: 'Kepala Sekolah',
      role: 'KEPALA_SEKOLAH',
      isActive: true,
      permissions: ['dutyBook.verify', 'dutyBook.lock'],
      sessionRevokedAtSeconds: 0,
    });

    // Seed Active Guru with Revocation Marker at 1000
    await db.collection('users').doc('usr-guru-01').set({
      id: 'usr-guru-01',
      nip: '199002022015042001',
      fullName: 'Guru Piket',
      role: 'GURU',
      isActive: true,
      permissions: ['dutyBook.create', 'dutyBook.update', 'dutyBook.view'],
      sessionRevokedAtSeconds: 1000,
    });

    // Seed Active Guru 2
    await db.collection('users').doc('usr-guru-02').set({
      id: 'usr-guru-02',
      nip: '199002022015042002',
      fullName: 'Guru Piket 2',
      role: 'GURU',
      isActive: true,
      permissions: ['dutyBook.create', 'dutyBook.update', 'dutyBook.view'],
      sessionRevokedAtSeconds: 0,
    });

    // Seed View-Only User (dutyBook.view only)
    await db.collection('users').doc('usr-viewonly-01').set({
      id: 'usr-viewonly-01',
      nip: '199002022015042003',
      fullName: 'Guru View Only',
      role: 'GURU',
      isActive: true,
      permissions: ['dutyBook.view'],
      sessionRevokedAtSeconds: 0,
    });

    // Seed Pending Activation User
    await db.collection('users').doc('usr-pending-01').set({
      id: 'usr-pending-01',
      nip: '199505052020051001',
      fullName: 'Guru Pending',
      role: 'GURU',
      isActive: true,
      requiresActivation: true,
      permissions: ['dutyBook.create'],
      sessionRevokedAtSeconds: 0,
    });

    // Seed Users for R21-03 / R21-06 Email Exception Elimination Tests
    await db.collection('users').doc('usr-email-inactive').set({
      id: 'usr-email-inactive',
      nip: '999001',
      fullName: 'Inactive Admin Candidate',
      email: 'puputsasmita19@gmail.com',
      role: 'ADMIN',
      isActive: false,
      permissions: ['*'],
      sessionRevokedAtSeconds: 0,
    });

    await db.collection('users').doc('usr-email-pending').set({
      id: 'usr-email-pending',
      nip: '999002',
      fullName: 'Pending Admin Candidate',
      email: 'puputsasmita19@gmail.com',
      role: 'ADMIN',
      isActive: true,
      requiresActivation: true,
      permissions: ['*'],
      sessionRevokedAtSeconds: 0,
    });

    await db.collection('users').doc('usr-email-demoted').set({
      id: 'usr-email-demoted',
      nip: '999003',
      fullName: 'Demoted Candidate',
      email: 'puputsasmita19@gmail.com',
      role: 'GURU',
      isActive: true,
      permissions: ['dutyBook.create'],
      sessionRevokedAtSeconds: 1500,
    });

    // Seed Public and Private Settings
    await db.collection('settings').doc('public_config').set({
      schoolName: 'SMK dr. SOEBANDI',
      npsn: '20109988',
    });
    await db.collection('settings').doc('school_config').set({
      schoolName: 'SMK dr. SOEBANDI',
      geofenceLat: -6.2,
      geofenceLng: 106.8,
    });

    // Seed Test Audit Log
    await db.collection('auditLogs').doc('audit-1').set({
      id: 'audit-1',
      userId: 'usr-admin-01',
      action: 'LOGIN',
      timestamp: '2026-10-02T10:00:00.000Z',
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

  // 1. Unauthenticated read to /users -> denied
  await check('Unauthenticated read to /users must be DENIED', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection('users').doc('usr-admin-01').get());
  });

  // 1b. Authenticated read to /users -> allowed
  await check('Authenticated active user read to /users is ALLOWED', async () => {
    const authedDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(authedDb.collection('users').doc('usr-admin-01').get());
  });

  // 2. Unauthenticated read to /settings/school_config -> denied
  await check('Unauthenticated read to /settings/school_config must be DENIED', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection('settings').doc('school_config').get());
  });

  // 3. Unauthenticated read to /settings/public_config -> allowed
  await check('Unauthenticated read to /settings/public_config is ALLOWED for kiosk', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(unauthedDb.collection('settings').doc('public_config').get());
  });

  // 4. Any client access to /user_credentials -> denied
  await check('Admin client access to /user_credentials must be DENIED', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertFails(adminDb.collection('user_credentials').doc('usr-admin-01').get());
    await assertFails(adminDb.collection('user_credentials').doc('usr-admin-01').set({ scryptHash: 'test' }));
  });

  // 5. Audit logs update/delete -> denied
  await check('Audit logs update and delete must be DENIED for all clients', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertFails(adminDb.collection('auditLogs').doc('audit-1').update({ details: 'tampered' }));
    await assertFails(adminDb.collection('auditLogs').doc('audit-1').delete());
  });

  // 6. DutyBook Kepala Sekolah cannot unlock locked status
  await check('Kepala Sekolah CANNOT unlock DIKUNCI to DRAFT in dutyBooks', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('dutyBooks').doc('db-locked-1').set({
        petugasId: 'usr-guru-01',
        status: 'DIKUNCI',
        tanggal: '2026-10-02',
      });
    });

    const kepsekDb = testEnv.authenticatedContext('usr-kepsek-01', { auth_time: 1000 }).firestore();
    await assertFails(
      kepsekDb.collection('dutyBooks').doc('db-locked-1').update({
        status: 'DRAFT',
      })
    );
  });

  // 7. DutyBook Admin CAN unlock locked status
  await check('Admin CAN unlock DIKUNCI in dutyBooks', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      adminDb.collection('dutyBooks').doc('db-locked-1').update({
        status: 'DRAFT',
      })
    );
  });

  // 7a. DutyBook Direct Submit (1 step) by Teacher: Create with DIAJUKAN
  await check('Guru CAN create new dutyBook directly with status DIAJUKAN (Kirim Jurnal 1 langkah)', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('dutyBooks').doc('db-direct-diajukan-1').set({
        petugasId: 'usr-guru-01',
        status: 'DIAJUKAN',
        tanggal: '2026-10-06',
      })
    );
  });

  // 7b. DutyBook View-Only User CANNOT create dutyBook
  await check('View-only user CANNOT create dutyBook (Izin melihat ditolak)', async () => {
    const viewOnlyDb = testEnv.authenticatedContext('usr-viewonly-01', { auth_time: 1000 }).firestore();
    await assertFails(
      viewOnlyDb.collection('dutyBooks').doc('db-viewonly-1').set({
        petugasId: 'usr-viewonly-01',
        status: 'DRAFT',
        tanggal: '2026-10-06',
      })
    );
  });

  // 7c. DutyBook Create for another user is DENIED
  await check('Guru CANNOT create dutyBook for another user', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertFails(
      guruDb.collection('dutyBooks').doc('db-other-user-1').set({
        petugasId: 'usr-guru-02', // Not own ID
        status: 'DRAFT',
        tanggal: '2026-10-06',
      })
    );
  });

  // 7d. DutyBook Kepala Sekolah One-step Sahkan & Selesaikan (DIAJUKAN -> DIKUNCI)
  await check('Kepala Sekolah CAN advance DIAJUKAN to DIKUNCI (Sahkan & Selesaikan)', async () => {
    const kepsekDb = testEnv.authenticatedContext('usr-kepsek-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      kepsekDb.collection('dutyBooks').doc('db-direct-diajukan-1').update({
        status: 'DIKUNCI',
      })
    );
  });

  // 7e. DutyBook Kepala Sekolah Return to Draft (DIAJUKAN -> DRAFT)
  await check('Kepala Sekolah CAN return DIAJUKAN to DRAFT for revision', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('dutyBooks').doc('db-for-revision-1').set({
        petugasId: 'usr-guru-01',
        status: 'DIAJUKAN',
        tanggal: '2026-10-06',
      });
    });

    const kepsekDb = testEnv.authenticatedContext('usr-kepsek-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      kepsekDb.collection('dutyBooks').doc('db-for-revision-1').update({
        status: 'DRAFT',
      })
    );
  });

  // 7f. Guru cannot edit once submitted (status DIAJUKAN)
  await check('Guru CANNOT update dutyBook while in DIAJUKAN status', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('dutyBooks').doc('db-submitted-pending').set({
        petugasId: 'usr-guru-01',
        status: 'DIAJUKAN',
        tanggal: '2026-10-06',
      });
    });

    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertFails(
      guruDb.collection('dutyBooks').doc('db-submitted-pending').update({
        catatanPiket: 'Revisi tanpa persetujuan',
      })
    );
  });

  // 7g. Admin CAN create dutyBook with any status during backup restore
  await check('Admin CAN create dutyBook with any status (jalur restore berwenang)', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      adminDb.collection('dutyBooks').doc('db-restore-diverifikasi').set({
        petugasId: 'usr-guru-02',
        status: 'DIVERIFIKASI',
        tanggal: '2026-09-30',
      })
    );
  });

  // 7h. Batch write atomic: Guru can commit dutyBook + auditLog together without undefined metadata
  await check('Batch Write: Guru CAN commit dutyBook + auditLog together atomically without undefined metadata', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    const batch = guruDb.batch();
    const bookRef = guruDb.collection('dutyBooks').doc('db-batch-atom-1');
    const auditRef = guruDb.collection('auditLogs').doc('audit-batch-atom-1');

    batch.set(bookRef, {
      id: 'db-batch-atom-1',
      petugasId: 'usr-guru-01',
      petugasName: 'Guru Piket 1',
      status: 'DIAJUKAN',
      tanggal: '2026-10-06',
      createdAt: '2026-10-06T08:00:00.000Z',
    });
    batch.set(auditRef, {
      id: 'audit-batch-atom-1',
      userId: 'usr-guru-01',
      userName: 'Guru Piket 1',
      role: 'GURU',
      action: 'STATUS_CHANGE',
      module: 'DUTY_BOOK',
      recordId: 'db-batch-atom-1',
      details: 'Pengiriman jurnal',
      timestamp: '2026-10-06T08:00:00.000Z',
    });
    await assertSucceeds(batch.commit());
  });

  // 7i. Batch write atomic: Guru can commit dutyBook + auditLog with valid metadata object
  await check('Batch Write: Guru CAN commit dutyBook + auditLog with valid metadata object', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    const batch = guruDb.batch();
    const bookRef = guruDb.collection('dutyBooks').doc('db-batch-atom-2');
    const auditRef = guruDb.collection('auditLogs').doc('audit-batch-atom-2');

    batch.set(bookRef, {
      id: 'db-batch-atom-2',
      petugasId: 'usr-guru-01',
      petugasName: 'Guru Piket 1',
      status: 'DIAJUKAN',
      tanggal: '2026-10-06',
      createdAt: '2026-10-06T08:00:00.000Z',
    });
    batch.set(auditRef, {
      id: 'audit-batch-atom-2',
      userId: 'usr-guru-01',
      userName: 'Guru Piket 1',
      role: 'GURU',
      action: 'CREATE',
      module: 'DUTY_BOOK',
      recordId: 'db-batch-atom-2',
      details: 'Pengiriman jurnal dengan metadata',
      timestamp: '2026-10-06T08:00:00.000Z',
      metadata: {
        stage: 'TERKIRIM',
        status: 'DIAJUKAN',
        tanggal: '2026-10-06',
      },
    });
    await assertSucceeds(batch.commit());
  });

  // 7j. Atomicity check: Batch fails completely if one write fails
  await check('Atomicity: Batch write rolls back completely if dutyBook operation is unauthorized', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    const batch = guruDb.batch();
    const bookRef = guruDb.collection('dutyBooks').doc('db-batch-fail-1');
    const auditRef = guruDb.collection('auditLogs').doc('audit-batch-fail-1');

    // Unauthorized: guru 1 writing as guru 2
    batch.set(bookRef, {
      id: 'db-batch-fail-1',
      petugasId: 'usr-guru-02', // FORBIDDEN!
      status: 'DIAJUKAN',
      tanggal: '2026-10-06',
    });
    batch.set(auditRef, {
      id: 'audit-batch-fail-1',
      userId: 'usr-guru-01',
      userName: 'Guru Piket 1',
      role: 'GURU',
      action: 'CREATE',
      module: 'DUTY_BOOK',
      details: 'Mencoba submit akun lain',
      timestamp: '2026-10-06T08:00:00.000Z',
    });
    await assertFails(batch.commit());

    // Verify audit log document was NOT created (no partial write)
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    const auditDoc = await adminDb.collection('auditLogs').doc('audit-batch-fail-1').get();
    if (auditDoc.exists) {
      throw new Error('Audit log was written despite batch failure! Atomicity broken.');
    }
  });

  // 7k. Guru can save Draft (create status: 'DRAFT') and then submit the existing Draft (update DRAFT -> DIAJUKAN)
  await check('Guru CAN save Draft and then submit existing Draft (DRAFT -> DIAJUKAN)', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    const bookRef = guruDb.collection('dutyBooks').doc('db-draft-to-submit-1');

    // 1. Save initial draft
    await assertSucceeds(
      bookRef.set({
        id: 'db-draft-to-submit-1',
        petugasId: 'usr-guru-01',
        petugasName: 'Guru Piket 1',
        status: 'DRAFT',
        tanggal: '2026-10-06',
        catatanPiket: 'Draf catatan awal',
        createdAt: '2026-10-06T07:00:00.000Z',
        updatedAt: '2026-10-06T07:00:00.000Z',
      })
    );

    // 2. Submit existing draft (DRAFT -> DIAJUKAN)
    await assertSucceeds(
      bookRef.update({
        status: 'DIAJUKAN',
        submittedAt: '2026-10-06T08:00:00.000Z',
        submittedBy: 'Guru Piket 1',
        catatanPiket: 'Catatan lengkap disubmit',
        updatedAt: '2026-10-06T08:00:00.000Z',
      })
    );
  });

  // 7l. Other teacher (Guru 2) cannot submit or modify Guru 1's existing draft
  await check('Other teacher CANNOT modify or submit existing draft belonging to Guru 1', async () => {
    const guru2Db = testEnv.authenticatedContext('usr-guru-02', { auth_time: 1001 }).firestore();
    const bookRef = guru2Db.collection('dutyBooks').doc('db-draft-to-submit-1');

    await assertFails(
      bookRef.update({
        catatanPiket: 'Modifikasi oleh guru 2',
      })
    );
  });

  // 7m. Incidents: Authorized Staff / Guru CAN create incident report bound to own pelaporId
  await check('Guru CAN create incident report bound to own pelaporId (status: BARU)', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-01').set({
        id: 'inc-test-01',
        tanggal: '2026-10-06',
        waktu: '09:30',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Lapangan Basket',
        pihakTerlibat: 'Siswa Kelas X',
        uraian: 'Kejadian pertengkaran kecil di lapangan',
        tindakanAwal: 'Dilerai dan dipanggil ke pos piket',
        pelaporId: 'usr-guru-01',
        pelaporName: 'Guru Piket 1',
        penanggungJawab: 'Guru Piket 1',
        status: 'BARU',
        createdAt: '2026-10-06T09:30:00.000Z',
        updatedAt: '2026-10-06T09:30:00.000Z',
      })
    );
  });

  // 7n. Incidents: Guru CANNOT create incident with someone else's pelaporId
  await check('Guru CANNOT create incident report with someone else pelaporId', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertFails(
      guruDb.collection('incidents').doc('inc-test-impersonate').set({
        id: 'inc-test-impersonate',
        tanggal: '2026-10-06',
        waktu: '09:30',
        kategori: 'SISWA',
        kategoriName: 'Kesiswaan',
        tingkatKeparahan: 'SEDANG',
        lokasi: 'Lapangan Basket',
        pihakTerlibat: 'Siswa Kelas X',
        uraian: 'Kejadian pelanggaran tata tertib',
        tindakanAwal: 'Ditegur di tempat',
        pelaporId: 'usr-guru-02', // FORBIDDEN!
        pelaporName: 'Guru Piket 2',
        status: 'BARU',
        createdAt: '2026-10-06T09:30:00.000Z',
      })
    );
  });

  // 7o. Incidents: Reporter CAN update own incident report details
  await check('Reporter CAN update own incident report details', async () => {
    const guruDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(
      guruDb.collection('incidents').doc('inc-test-01').update({
        tindakLanjut: 'Diserahkan ke Guru BK',
        updatedAt: '2026-10-06T09:40:00.000Z',
      })
    );
  });

  // 7p. Incidents: Other user CANNOT update someone else incident report
  await check('Other user CANNOT update someone else incident report', async () => {
    const guru2Db = testEnv.authenticatedContext('usr-guru-02', { auth_time: 1001 }).firestore();
    await assertFails(
      guru2Db.collection('incidents').doc('inc-test-01').update({
        tindakLanjut: 'Diubah oleh guru 2 tanpa izin',
      })
    );
  });

  // 7q. Incidents: Admin or Kepala Sekolah CAN update and resolve any incident
  await check('Admin or Kepala Sekolah CAN resolve any incident to SELESAI', async () => {
    const kepsekDb = testEnv.authenticatedContext('usr-kepsek-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      kepsekDb.collection('incidents').doc('inc-test-01').update({
        status: 'SELESAI',
        resolvedAt: '2026-10-06T10:00:00.000Z',
        resolvedBy: 'Kepala Sekolah',
        resolutionNote: 'Masalah telah diselesaikan secara kekeluargaan',
        updatedAt: '2026-10-06T10:00:00.000Z',
      })
    );
  });

  // 8. Top-level & Subcollection Snapshot Chunks
  await check('Admin CAN write to database_snapshots_chunks top-level collection', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      adminDb.collection('database_snapshots_chunks').doc('snap_chunk_0').set({
        snapshotId: 'snap-1',
        chunkIndex: 0,
        totalChunks: 1,
        data: 'canonical-test-data',
      })
    );
  });

  await check('Admin CAN write to database_snapshots/{id}/chunks subcollection', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    await assertSucceeds(
      adminDb.collection('database_snapshots').doc('snap-1').collection('chunks').doc('chunk-0').set({
        chunkIndex: 0,
        data: 'canonical-subchunk-data',
      })
    );
  });

  // 9. Session Revocation Boundaries (auth_time <= marker vs auth_time > marker)
  await check('Token with auth_time <= sessionRevokedAtSeconds must be DENIED', async () => {
    // usr-guru-01 has marker 1000
    const revokedTokenDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1000 }).firestore();
    await assertFails(revokedTokenDb.collection('users').doc('usr-guru-01').get());

    const olderTokenDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 999 }).firestore();
    await assertFails(olderTokenDb.collection('users').doc('usr-guru-01').get());
  });

  await check('Token with auth_time > sessionRevokedAtSeconds is ALLOWED', async () => {
    const freshTokenDb = testEnv.authenticatedContext('usr-guru-01', { auth_time: 1001 }).firestore();
    await assertSucceeds(freshTokenDb.collection('users').doc('usr-guru-01').get());
  });

  // 10. Activation Gate Enforcement
  await check('User with requiresActivation == true must be DENIED access in Rules', async () => {
    const pendingDb = testEnv.authenticatedContext('usr-pending-01', { auth_time: 2000 }).firestore();
    await assertFails(pendingDb.collection('users').doc('usr-pending-01').get());
  });

  // 11. Monotonic sessionRevokedAtSeconds enforcement on update
  await check('Admin CANNOT decrease sessionRevokedAtSeconds (monotonic enforcement)', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    // usr-guru-01 has marker 1000, attempt to decrease to 500
    await assertFails(
      adminDb.collection('users').doc('usr-guru-01').update({
        sessionRevokedAtSeconds: 500,
      })
    );
  });

  // 11b. Marker Removal Rejection (deleteField / replacement without marker)
  await check('Admin CANNOT delete or omit existing sessionRevokedAtSeconds marker', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    // usr-guru-01 has marker 1000, attempt full replacement omitting marker
    await assertFails(
      adminDb.collection('users').doc('usr-guru-01').set({
        id: 'usr-guru-01',
        nip: '199002022015042001',
        fullName: 'Guru Piket',
        role: 'GURU',
        isActive: true,
        permissions: ['dutyBook.create'],
      })
    );
  });

  // 11c. Marker Safe Equal / Increase Approval
  await check('Admin CAN advance sessionRevokedAtSeconds (monotonic advancement)', async () => {
    const adminDb = testEnv.authenticatedContext('usr-admin-01', { auth_time: 1000 }).firestore();
    // usr-guru-01 has marker 1000, advance to 2000
    await assertSucceeds(
      adminDb.collection('users').doc('usr-guru-01').update({
        sessionRevokedAtSeconds: 2000,
      })
    );
  });

  // 12. R21-03 & R21-06: Elimination of Email Exception in Security Rules
  await check('R21-06: Email token with MISSING profile in Firestore must be DENIED', async () => {
    const unprovisionedEmailDb = testEnv
      .authenticatedContext('usr-ghost-email', { email: 'puputsasmita19@gmail.com', auth_time: 2000 })
      .firestore();
    await assertFails(unprovisionedEmailDb.collection('users').doc('usr-admin-01').get());
  });

  await check('R21-06: Email token with INACTIVE profile (isActive=false) must be DENIED', async () => {
    const inactiveEmailDb = testEnv
      .authenticatedContext('usr-email-inactive', { email: 'puputsasmita19@gmail.com', auth_time: 2000 })
      .firestore();
    await assertFails(inactiveEmailDb.collection('users').doc('usr-admin-01').get());
  });

  await check('R21-06: Email token with PENDING activation (requiresActivation=true) must be DENIED', async () => {
    const pendingEmailDb = testEnv
      .authenticatedContext('usr-email-pending', { email: 'puputsasmita19@gmail.com', auth_time: 2000 })
      .firestore();
    await assertFails(pendingEmailDb.collection('users').doc('usr-admin-01').get());
  });

  await check('R21-06: Email token DEMOTED to GURU cannot perform ADMIN unlock action', async () => {
    const demotedEmailDb = testEnv
      .authenticatedContext('usr-email-demoted', { email: 'puputsasmita19@gmail.com', auth_time: 2000 })
      .firestore();
    await assertFails(
      demotedEmailDb.collection('dutyBooks').doc('db-locked-1').update({
        status: 'DRAFT',
      })
    );
  });

  await check('R21-06: Email token with auth_time <= sessionRevokedAtSeconds must be DENIED', async () => {
    const revokedEmailDb = testEnv
      .authenticatedContext('usr-email-demoted', { email: 'puputsasmita19@gmail.com', auth_time: 1500 })
      .firestore();
    await assertFails(revokedEmailDb.collection('users').doc('usr-email-demoted').get());
  });

  await check('R21-06: Positive Control: Provisioned active ADMIN with fresh auth_time > marker is ALLOWED', async () => {
    const validAdminDb = testEnv
      .authenticatedContext('usr-admin-01', { auth_time: 2000 })
      .firestore();
    await assertSucceeds(validAdminDb.collection('users').doc('usr-admin-01').get());
  });

  await testEnv.cleanup();

  console.log(`\nHasil Rules Emulator: ${passed} PASS, ${failed} FAIL\n`);
  return failed === 0;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('test_rules_emulator.ts')) {
  runEmulatorRulesTests().then((ok) => {
    process.exit(ok ? 0 : 1);
  });
}
export { runEmulatorRulesTests };
