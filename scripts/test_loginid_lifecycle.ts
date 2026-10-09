/**
 * Test Suite: Lifecycle loginId & Orphan Reservation Cleanup (CR-LIFECYCLE-LOGINID)
 * Tests:
 * 1. Create -> Delete -> Re-create same loginId succeeds
 * 2. Duplicate active loginId rejected
 * 3. Cross-user reservation protection (other user's reservation not deleted)
 * 4. Concurrent account creation race condition (atomic single winner)
 * 5. Dry-run orphan inspection & atomic orphan cleanup (GURU-UJI-001 case)
 * 6. Active user orphan cleanup rejection
 * 7. Admin self-deletion and last admin protections
 */

import { normalizeLoginId, validateLoginId } from '../src/server/routes/authRoutes';
import { hashPinAdaptive, verifyPinAdaptive } from '../src/server/crypto/adaptiveHash';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

// In-memory simulation of Firestore Transaction and Collections
class MockDatabase {
  users = new Map<string, any>();
  credentials = new Map<string, any>();
  loginIds = new Map<string, any>();
  auditLogs: any[] = [];

  reset() {
    this.users.clear();
    this.credentials.clear();
    this.loginIds.clear();
    this.auditLogs = [];
  }

  // Simulated atomic user creation (exact replica of authRoutes POST /create-user transaction)
  async createUserTx(userData: {
    userId: string;
    loginId: string;
    fullName: string;
    role: string;
    nip?: string;
    initialPin?: string;
  }): Promise<{ success: boolean; error?: string; code?: string }> {
    const normId = normalizeLoginId(userData.loginId);

    // Atomic transaction simulation
    if (this.loginIds.has(normId)) {
      const res = this.loginIds.get(normId);
      if (res.userId !== userData.userId) {
        return { success: false, error: `ID Login '${normId}' sudah digunakan oleh akun lain.`, code: 'DUPLICATE_LOGIN_ID' };
      }
    }

    if (this.users.has(userData.userId)) {
      return { success: false, error: `User ID '${userData.userId}' sudah ada.`, code: 'USER_EXISTS' };
    }

    const now = new Date().toISOString();
    this.users.set(userData.userId, {
      id: userData.userId,
      loginId: normId,
      fullName: userData.fullName,
      role: userData.role,
      nip: userData.nip || '',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    this.loginIds.set(normId, {
      loginId: normId,
      userId: userData.userId,
      createdAt: now,
      updatedAt: now,
    });

    if (userData.initialPin) {
      const scryptHash = await hashPinAdaptive(userData.initialPin);
      this.credentials.set(userData.userId, {
        userId: userData.userId,
        nip: userData.nip || '',
        scryptHash,
      });
    }

    return { success: true };
  }

  // Simulated atomic user deletion (exact replica of authRoutes POST /delete-user transaction)
  async deleteUserTx(
    targetUserId: string,
    callerId: string
  ): Promise<{ success: boolean; error?: string; code?: string; reservationDeleted?: boolean }> {
    if (callerId === targetUserId) {
      return { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri.', code: 'CANNOT_DELETE_SELF' };
    }

    const userSnap = this.users.get(targetUserId);
    if (!userSnap) {
      return { success: false, error: 'Pengguna tidak ditemukan.', code: 'USER_NOT_FOUND' };
    }

    if (userSnap.role === 'ADMIN') {
      const otherAdmins = Array.from(this.users.values()).filter(
        (u) => u.role === 'ADMIN' && u.isActive && u.id !== targetUserId
      );
      if (otherAdmins.length === 0) {
        return { success: false, error: 'Tidak dapat menghapus satu-satunya Administrator aktif.', code: 'LAST_ADMIN_PROTECTED' };
      }
    }

    const targetLoginId = userSnap.loginId ? normalizeLoginId(userSnap.loginId) : null;
    let reservationDeleted = false;

    // Transaction execution: Read all then write
    const credExists = this.credentials.has(targetUserId);
    const resSnap = targetLoginId ? this.loginIds.get(targetLoginId) : null;

    // Deletions
    this.users.delete(targetUserId);
    if (credExists) {
      this.credentials.delete(targetUserId);
    }

    if (resSnap) {
      // Strict ownership check
      if (resSnap.userId === targetUserId) {
        this.loginIds.delete(targetLoginId!);
        reservationDeleted = true;
      }
    }

    return { success: true, reservationDeleted };
  }

  // Simulated dry-run scan of orphan reservations (GET /api/auth/orphan-reservations)
  scanOrphanReservations(): Array<{ loginId: string; userId: string; reason: string }> {
    const orphans: Array<{ loginId: string; userId: string; reason: string }> = [];
    for (const [loginId, resData] of this.loginIds.entries()) {
      const resUserId = resData.userId;
      if (!this.users.has(resUserId)) {
        const usersWithSameLoginId = Array.from(this.users.values()).filter((u) => u.loginId === loginId);
        if (usersWithSameLoginId.length === 0) {
          orphans.push({
            loginId,
            userId: resUserId,
            reason: `Profil akun pemilik (ID: ${resUserId}) sudah tidak ada di database.`,
          });
        }
      }
    }
    return orphans;
  }

  // Simulated atomic orphan reservation cleanup (POST /api/auth/clean-orphan-reservation)
  async cleanOrphanReservationTx(loginId: string): Promise<{ success: boolean; error?: string; code?: string }> {
    const normId = normalizeLoginId(loginId);
    const resSnap = this.loginIds.get(normId);
    if (!resSnap) {
      return { success: true }; // already cleaned
    }

    const resUserId = resSnap.userId;
    if (resUserId && this.users.has(resUserId)) {
      return {
        success: false,
        error: `Tidak dapat melepas reservasi karena akun pemilik '${resUserId}' masih aktif.`,
        code: 'ACTIVE_USER_EXISTS',
      };
    }

    this.loginIds.delete(normId);
    return { success: true };
  }
}

async function runLifecycleTests() {
  console.log('--- STARTING LOGINID LIFECYCLE & ORPHAN RESERVATION ACCEPTANCE TESTS ---\n');

  const db = new MockDatabase();

  // Test 1: Create -> Delete -> Re-create same loginId
  console.log('[Test Scenario 1: Buat -> Hapus -> Buat Ulang ID yang Sama]');
  const resCreate1 = await db.createUserTx({
    userId: 'usr-guru-001',
    loginId: 'GURU-001',
    fullName: 'Guru Pertama, S.Pd.',
    role: 'GURU',
    initialPin: '123456',
  });
  assert(resCreate1.success, 'Pembuatan akun GURU-001 pertama berhasil');
  assert(db.users.has('usr-guru-001'), 'Dokumen users/usr-guru-001 dibuat');
  assert(db.loginIds.has('GURU-001'), 'Reservasi login_ids/GURU-001 dibuat');
  assert(db.credentials.has('usr-guru-001'), 'Kredensial private dibuat');

  // Delete user
  const resDelete1 = await db.deleteUserTx('usr-guru-001', 'usr-admin-master');
  assert(resDelete1.success && resDelete1.reservationDeleted === true, 'Penghapusan akun GURU-001 berhasil');
  assert(!db.users.has('usr-guru-001'), 'Dokumen users/usr-guru-001 terhapus');
  assert(!db.loginIds.has('GURU-001'), 'Reservasi login_ids/GURU-001 terhapus secara atomik');
  assert(!db.credentials.has('usr-guru-001'), 'Kredensial private terhapus');

  // Re-create user with same loginId GURU-001
  const resCreate2 = await db.createUserTx({
    userId: 'usr-guru-002-new',
    loginId: 'GURU-001',
    fullName: 'Guru Pengganti, M.Pd.',
    role: 'GURU',
    initialPin: '654321',
  });
  assert(resCreate2.success, 'Pembuatan ulang akun dengan ID GURU-001 berhasil tanpa blokir reservasi');
  assert(db.users.has('usr-guru-002-new'), 'Dokumen user baru tersimpan');
  assert(db.loginIds.get('GURU-001')?.userId === 'usr-guru-002-new', 'Reservasi GURU-001 terasosiasi ke akun baru');

  // Test 2: Duplicate Active Account Rejected
  console.log('\n[Test Scenario 2: Duplikat Akun yang Masih Ada Ditolak]');
  const resDup = await db.createUserTx({
    userId: 'usr-guru-003-dup',
    loginId: 'guru-001', // Lowercase to test normalization
    fullName: 'Guru Duplikat',
    role: 'GURU',
  });
  assert(!resDup.success && resDup.code === 'DUPLICATE_LOGIN_ID', 'Pembuatan akun dengan loginId duplikat ditolak secara atomik');

  // Test 3: Other User's Reservation Protected
  console.log('\n[Test Scenario 3: Reservasi Milik Akun Lain Terlindungi]');
  // Setup: Account A has loginId GURU-AAA (userId: usr-a). Account B is usr-b.
  await db.createUserTx({
    userId: 'usr-a',
    loginId: 'GURU-AAA',
    fullName: 'User A',
    role: 'GURU',
  });

  // Manually simulate a bugged or cross situation where usr-b deletion runs
  db.users.set('usr-b', { id: 'usr-b', loginId: 'GURU-AAA', fullName: 'User B', role: 'GURU' }); // malicious or stale reference
  // Note: loginIds/GURU-AAA has userId: 'usr-a'
  const resDeleteB = await db.deleteUserTx('usr-b', 'usr-admin-master');
  assert(resDeleteB.success, 'Penghapusan usr-b selesai');
  assert(db.loginIds.has('GURU-AAA'), 'Reservasi login_ids/GURU-AAA tetap ada');
  assert(db.loginIds.get('GURU-AAA')?.userId === 'usr-a', 'Reservasi login_ids/GURU-AAA tetap milik usr-a (tidak terhapus)');

  // Test 4: Concurrent Account Creation
  console.log('\n[Test Scenario 4: Dua Pembuatan Bersamaan Tidak Menghasilkan Duplikat]');
  db.reset();
  // Admin user
  db.users.set('usr-admin-master', { id: 'usr-admin-master', role: 'ADMIN', isActive: true });

  const concurrentResults = await Promise.all([
    db.createUserTx({ userId: 'usr-conc-1', loginId: 'GURU-CONC-001', fullName: 'Guru Race 1', role: 'GURU' }),
    db.createUserTx({ userId: 'usr-conc-2', loginId: 'GURU-CONC-001', fullName: 'Guru Race 2', role: 'GURU' }),
  ]);

  const successCount = concurrentResults.filter((r) => r.success).length;
  const failCount = concurrentResults.filter((r) => !r.success && r.code === 'DUPLICATE_LOGIN_ID').length;

  assert(successCount === 1, 'Tepat 1 pembuatan akun berhasil dalam kondisi race condition');
  assert(failCount === 1, 'Tepat 1 pembuatan akun ditolak karena duplikasi');
  assert(db.loginIds.has('GURU-CONC-001'), 'Hanya terdapat 1 dokumen reservasi');

  // Test 5: Orphan Reservation Inspection & Cleanup (GURU-UJI-001 Case)
  console.log('\n[Test Scenario 5: Pemulihan Reservasi Yatim GURU-UJI-001]');
  // Simulate an orphan reservation left behind from legacy deletion
  db.loginIds.set('GURU-UJI-001', {
    loginId: 'GURU-UJI-001',
    userId: 'usr-deleted-legacy-999',
    createdAt: new Date().toISOString(),
  });

  // Step 5a: Dry run scan
  const dryRunScan = db.scanOrphanReservations();
  assert(dryRunScan.length === 1, 'Pemeriksaan awal mendeteksi 1 reservasi yatim');
  assert(dryRunScan[0].loginId === 'GURU-UJI-001', 'Reservasi yatim yang terdeteksi adalah GURU-UJI-001');
  assert(db.loginIds.has('GURU-UJI-001'), 'Pemeriksaan awal bersifat dry-run dan tidak mengubah data');

  // Step 5b: Atomic cleanup of orphan reservation
  const cleanRes = await db.cleanOrphanReservationTx('GURU-UJI-001');
  assert(cleanRes.success, 'Pembersihan atomik reservasi GURU-UJI-001 berhasil');
  assert(!db.loginIds.has('GURU-UJI-001'), 'Dokumen reservasi login_ids/GURU-UJI-001 telah dilepas');

  // Step 5c: New account can now be created with GURU-UJI-001
  const createUjiRes = await db.createUserTx({
    userId: 'usr-guru-uji-new',
    loginId: 'GURU-UJI-001',
    fullName: 'Guru Uji Resmi',
    role: 'GURU',
  });
  assert(createUjiRes.success, 'Akun baru dengan ID GURU-UJI-001 berhasil dibuat setelah reservasi dibersihkan');

  // Test 6: Active User Orphan Cleanup Rejection
  console.log('\n[Test Scenario 6: Penolakan Pembersihan Reservasi pada Akun Aktif]');
  const cleanActiveRes = await db.cleanOrphanReservationTx('GURU-UJI-001');
  assert(!cleanActiveRes.success && cleanActiveRes.code === 'ACTIVE_USER_EXISTS', 'Pembersihan reservasi ditolak jika akun pemilik masih aktif');

  // Test 7: Admin Protection
  console.log('\n[Test Scenario 7: Proteksi Penghapusan Administrator]');
  const selfDelRes = await db.deleteUserTx('usr-admin-master', 'usr-admin-master');
  assert(!selfDelRes.success && selfDelRes.code === 'CANNOT_DELETE_SELF', 'Admin ditolak menghapus akunnya sendiri');

  const lastAdminDelRes = await db.deleteUserTx('usr-admin-master', 'usr-other-admin');
  assert(!lastAdminDelRes.success && lastAdminDelRes.code === 'LAST_ADMIN_PROTECTED', 'Admin terakhir di sistem ditolak dihapus');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleTests().catch((err) => {
  console.error('Lifecycle test execution crashed:', err);
  process.exit(1);
});
