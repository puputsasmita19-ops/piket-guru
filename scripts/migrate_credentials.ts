import { adminDb } from '../src/server/firebaseAdmin';
import { hashPinAdaptive, verifyPinAdaptive } from '../src/server/crypto/adaptiveHash';
import firebaseConfig from '../firebase-applet-config.json';

interface MigrationResult {
  userId: string;
  nip: string;
  hadLegacyPin: boolean;
  hadLegacyHash: boolean;
  migratedToPrivateStore: boolean;
  legacyFieldsDeleted: boolean;
  status: 'DRY_RUN_ELIGIBLE' | 'MIGRATED' | 'ALREADY_CLEAN' | 'REQUIRES_ACTIVATION' | 'FAILED';
  details?: string;
}

export async function runMigration(cliArgs: string[] = process.argv.slice(2)): Promise<{
  success: boolean;
  results: MigrationResult[];
}> {
  const hasExecute = cliArgs.includes('--execute');
  const hasDryRun = cliArgs.includes('--dry-run');

  // STRICT: Mutual exclusion guard. Never allow --execute together with --dry-run
  if (hasExecute && hasDryRun) {
    console.error('[FATAL] Argumen --execute dan --dry-run tidak dapat digunakan bersamaan.');
    const isDirectRun = typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('migrate_credentials.ts');
    if (isDirectRun) {
      process.exit(1);
    }
    return { success: false, results: [] };
  }

  const isExecute = hasExecute;
  const isDryRun = !isExecute;

  console.log('====================================================');
  console.log('  CR-AUTH-BACKUP-001: CREDENTIAL MIGRATION RUNNER   ');
  console.log('====================================================');
  console.log(`Target Project ID   : ${firebaseConfig.projectId}`);
  console.log(`Target Database ID  : ${firebaseConfig.firestoreDatabaseId}`);
  console.log(`Mode                : ${isDryRun ? 'DRY-RUN (Simulasi Aman - Read-Only)' : 'EXECUTE (Penulisan Data Nyata)'}`);
  console.log(`Timestamp           : ${new Date().toISOString()}\n`);

  if (isDryRun) {
    console.log('[INFO] Berjalan dalam mode DRY-RUN. Tidak ada data yang akan diubah.');
    console.log('[INFO] Gunakan argumen --execute tunggal untuk menjalankan migrasi sesungguhnya.\n');
  }

  const isDirectRun = typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('migrate_credentials.ts');

  if (!adminDb) {
    console.error('[FATAL] Admin SDK Firestore (adminDb) tidak terinisialisasi. Gagal tertutup.');
    if (isDirectRun) {
      process.exit(1);
    }
    return { success: false, results: [] };
  }

  // Precondition: Fetch all users via Admin SDK
  let usersDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const usersSnap = await adminDb.collection('users').get();
    usersDocs = usersSnap.docs;
    console.log(`[PRECONDITION] Menemukan ${usersDocs.length} dokumen dalam koleksi 'users'.\n`);
  } catch (err: any) {
    console.error(`[FATAL] Gagal mengambil koleksi 'users' via Admin SDK: ${err.message}`);
    if (isDirectRun) {
      process.exit(1);
    }
    return { success: false, results: [] };
  }

  const results: MigrationResult[] = [];
  let hasFailures = false;

  for (const userDoc of usersDocs) {
    const u = userDoc.data();
    const userId = userDoc.id;
    const nip = u.nip || 'N/A';
    const hadLegacyPin = u.pin !== undefined && u.pin !== null;
    const hadLegacyHash = u.pinHash !== undefined && u.pinHash !== null;

    // Check if user already exists in private store via Admin SDK
    let existingHash: string | null = null;
    try {
      const existingCredSnap = await adminDb.collection('user_credentials').doc(userId).get();
      if (existingCredSnap.exists) {
        existingHash = existingCredSnap.data()?.scryptHash || null;
      }
    } catch (readErr: any) {
      // STOP: Private credential read error must halt migration decision for this account
      console.error(`[FATAL] Gagal memeriksa user_credentials untuk '${userId}': ${readErr.message}`);
      hasFailures = true;
      results.push({
        userId,
        nip,
        hadLegacyPin,
        hadLegacyHash,
        migratedToPrivateStore: false,
        legacyFieldsDeleted: false,
        status: 'FAILED',
        details: `Gagal membaca kredensial privat: ${readErr.message}`,
      });
      continue;
    }

    // Case 1: Already has private credential
    if (existingHash) {
      if (hadLegacyPin || hadLegacyHash) {
        // Idempotent: Never overwrite newer private credential with leftover legacy fields!
        if (isExecute) {
          const { FieldValue } = await import('firebase-admin/firestore');
          await adminDb.collection('users').doc(userId).update({
            pin: FieldValue.delete(),
            pinHash: FieldValue.delete(),
            pinSalt: FieldValue.delete(),
            updatedAt: new Date().toISOString(),
          });
        }
        results.push({
          userId,
          nip,
          hadLegacyPin,
          hadLegacyHash,
          migratedToPrivateStore: false,
          legacyFieldsDeleted: isExecute,
          status: 'ALREADY_CLEAN',
          details: isExecute
            ? 'Kredensial privat sudah ada. Sisa legacy field dibersihkan tanpa menimpa hash baru.'
            : 'DRY-RUN: Kredensial privat sudah ada. Field legacy dijadwalkan untuk dibersihkan.',
        });
      } else {
        results.push({
          userId,
          nip,
          hadLegacyPin: false,
          hadLegacyHash: false,
          migratedToPrivateStore: false,
          legacyFieldsDeleted: false,
          status: 'ALREADY_CLEAN',
          details: 'Profil bersih dan kredensial privat scrypt sudah aktif.',
        });
      }
      continue;
    }

    // Case 2: No private credential, and NO legacy PIN available
    if (!hadLegacyPin || typeof u.pin !== 'string' || !/^\d{6}$/.test(u.pin)) {
      // NEVER assign default PIN 123456! Put into controlled activation
      if (isExecute) {
        const { FieldValue } = await import('firebase-admin/firestore');
        await adminDb.collection('users').doc(userId).update({
          requiresActivation: true,
          sessionRevokedAtSeconds: Math.floor(Date.now() / 1000),
          pin: FieldValue.delete(),
          pinHash: FieldValue.delete(),
          pinSalt: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });
      }
      results.push({
        userId,
        nip,
        hadLegacyPin,
        hadLegacyHash,
        migratedToPrivateStore: false,
        legacyFieldsDeleted: isExecute,
        status: 'REQUIRES_ACTIVATION',
        details: isExecute
          ? 'Tidak ada PIN valid untuk dimigrasikan. Akun ditandai requiresActivation (tidak diberikan default PIN).'
          : 'DRY-RUN: Tidak ada PIN valid. Dijadwalkan untuk ditandai requiresActivation.',
      });
      continue;
    }

    // Case 3: Valid legacy PIN exists -> Eligible for migration
    if (isDryRun) {
      results.push({
        userId,
        nip,
        hadLegacyPin,
        hadLegacyHash,
        migratedToPrivateStore: false,
        legacyFieldsDeleted: false,
        status: 'DRY_RUN_ELIGIBLE',
        details: 'DRY-RUN: Terdeteksi legacy PIN 6-digit. Siap dimigrasikan ke scrypt adaptif OWASP di user_credentials.',
      });
      continue;
    }

    // Execute migration with verification before deleting legacy fields
    try {
      const pinValue = u.pin.trim();
      const scryptHash = await hashPinAdaptive(pinValue);

      // Verify generated hash matches pin before touching database
      const selfVerify = await verifyPinAdaptive(pinValue, scryptHash);
      if (!selfVerify) {
        throw new Error('Self-verification of generated scrypt hash failed');
      }

      // Write to private store via Admin SDK
      const now = new Date().toISOString();
      const credRef = adminDb.collection('user_credentials').doc(userId);
      await credRef.set(
        {
          userId,
          nip,
          scryptHash,
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );

      // Verify write by reading back
      const verifySnap = await credRef.get();
      if (!verifySnap.exists || verifySnap.data()?.scryptHash !== scryptHash) {
        throw new Error('Failed to verify written scryptHash in user_credentials');
      }

      // Delete legacy fields from users collection only after write is proven
      const { FieldValue } = await import('firebase-admin/firestore');
      await adminDb.collection('users').doc(userId).update({
        pin: FieldValue.delete(),
        pinHash: FieldValue.delete(),
        pinSalt: FieldValue.delete(),
        sessionRevokedAtSeconds: Math.floor(Date.now() / 1000),
        updatedAt: now,
      });

      results.push({
        userId,
        nip,
        hadLegacyPin,
        hadLegacyHash,
        migratedToPrivateStore: true,
        legacyFieldsDeleted: true,
        status: 'MIGRATED',
        details: 'Sukses dimigrasikan ke scrypt OWASP (N=16384, r=8, p=5) dan field plaintext berhasil dihapus.',
      });
    } catch (err: any) {
      hasFailures = true;
      results.push({
        userId,
        nip,
        hadLegacyPin,
        hadLegacyHash,
        migratedToPrivateStore: false,
        legacyFieldsDeleted: false,
        status: 'FAILED',
        details: `Gagal migrasi: ${err.message}`,
      });
    }
  }

  console.log('--- HASIL MIGRASI KREDENSIAL ---');
  console.table(
    results.map((r) => ({
      userId: r.userId,
      nip: r.nip,
      status: r.status,
      details: r.details?.substring(0, 70),
    }))
  );

  if (hasFailures) {
    console.error('\n[FATAL] Migrasi mengalami kegagalan pada sebagian akun! Gagal tertutup (exit code 1).');
    if (isDirectRun) {
      process.exit(1);
    }
    return { success: false, results };
  }

  return { success: true, results };
}

// Auto-run if executed directly as main script
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.endsWith('migrate_credentials.ts')) {
  runMigration().catch((err) => {
    console.error('[FATAL] Script migrasi mengalami error tak terduga:', err);
    process.exit(1);
  });
}
