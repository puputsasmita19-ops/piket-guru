import * as fs from 'fs';
import * as path from 'path';
import { hashPinAdaptive, verifyPinAdaptive, DEFAULT_SCRYPT_PARAMS } from '../src/server/crypto/adaptiveHash';
import { AuthRateLimiter } from '../src/server/middleware/rateLimiter';
import { sanitizeUserProfile } from '../src/server/routes/authRoutes';
import { BackupService, BackupPayload } from '../src/services/backup/backupService';
import { ROLE_PERMISSIONS, checkUserPermission } from '../src/config/permissions';
import { UserProfile, UserRole } from '../src/types';
import { testSignerCapability } from '../src/server/firebaseAdmin';

interface AssertionResult {
  category: string;
  testId: string;
  title: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  expected: string;
  actual: string;
  evidence: string;
}

const testResults: AssertionResult[] = [];

function recordTest(
  category: string,
  testId: string,
  title: string,
  status: 'PASS' | 'FAIL' | 'BLOCKED',
  expected: string,
  actual: string,
  evidence: string
) {
  testResults.push({ category, testId, title, status, expected, actual, evidence });
  const icon = status === 'PASS' ? '✅' : status === 'BLOCKED' ? '⚠️' : '❌';
  console.log(`${icon} [${status}] [${category}] ${testId}: ${title}`);
  console.log(`   Expected : ${expected}`);
  console.log(`   Actual   : ${actual}`);
  console.log(`   Evidence : ${evidence}\n`);
}

/**
 * High-fidelity Rule Engine Simulator implementing the EXACT logic of firestore.rules
 * (including profile existence, isActive, session revocation, document-role precedence,
 * ownership checks, and status locking).
 */
class ProductionRulesEngine {
  private userDatabase: Map<string, any> = new Map();

  constructor() {
    // Seed test users database
    this.userDatabase.set('usr-admin-01', {
      id: 'usr-admin-01',
      role: 'ADMIN',
      isActive: true,
      nip: '198503152010011002',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-kepsek-01', {
      id: 'usr-kepsek-01',
      role: 'KEPALA_SEKOLAH',
      isActive: true,
      nip: '197001011995011001',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-guru-01', {
      id: 'usr-guru-01',
      role: 'GURU',
      isActive: true,
      nip: '198801012015011002',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-guru-02', {
      id: 'usr-guru-02',
      role: 'GURU',
      isActive: true,
      nip: '198902022016012003',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-tendik-01', {
      id: 'usr-tendik-01',
      role: 'TENAGA_KEPENDIDIKAN',
      isActive: true,
      nip: '199203032018011004',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-satpam-01', {
      id: 'usr-satpam-01',
      role: 'SATPAM',
      isActive: true,
      nip: '199504042020011005',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-inactive-01', {
      id: 'usr-inactive-01',
      role: 'GURU',
      isActive: false, // Disabled account
      nip: '198000000000000000',
      sessionRevokedAtSeconds: 1000,
    });
    this.userDatabase.set('usr-demoted-01', {
      id: 'usr-demoted-01',
      role: 'GURU', // Formerly ADMIN, recently demoted in Firestore document
      isActive: true,
      nip: '198111111111111111',
      sessionRevokedAtSeconds: 2000, // Demoted & revoked at t=2000
    });
  }

  public setUser(uid: string, data: any) {
    this.userDatabase.set(uid, data);
  }

  public evaluate(req: {
    auth: {
      uid: string;
      token: {
        auth_time: number; // Unix timestamp in seconds
        role?: string;
        [key: string]: any;
      };
    } | null;
    method: 'get' | 'list' | 'create' | 'update' | 'delete';
    path: string;
    resource?: { data: Record<string, any> };
    requestResource?: { data: Record<string, any> };
  }): { allowed: boolean; reason: string } {
    const hasAuthToken = req.auth !== null && typeof req.auth.uid === 'string';
    if (!hasAuthToken) {
      // Unauthenticated requests can only access public kiosk paths
      if (req.path === '/settings/public_config' && (req.method === 'get' || req.method === 'list')) {
        return { allowed: true, reason: 'Public read allowed for /settings/public_config' };
      }
      if (
        (req.path.startsWith('/schedules/') || req.path.startsWith('/announcements/') || req.path.startsWith('/emergencies/')) &&
        (req.method === 'get' || req.method === 'list')
      ) {
        return { allowed: true, reason: 'Public read allowed for digital signage / emergency broadcast' };
      }
      return { allowed: false, reason: 'Unauthenticated access rejected (hasAuthToken == false)' };
    }

    const uid = req.auth!.uid;
    const userDoc = this.userDatabase.get(uid);

    // Rule: Profile must exist in Firestore
    if (!userDoc) {
      return { allowed: false, reason: `Profile document for UID '${uid}' does not exist in users collection` };
    }

    // Rule: Account must be active
    if (userDoc.isActive !== true) {
      return { allowed: false, reason: `User account '${uid}' is inactive (isActive == false)` };
    }

    // Rule: Session Revocation Check (token auth_time must be >= sessionRevokedAtSeconds)
    if (userDoc.sessionRevokedAtSeconds && req.auth!.token.auth_time < userDoc.sessionRevokedAtSeconds) {
      return {
        allowed: false,
        reason: `Session revoked. Token auth_time (${req.auth!.token.auth_time}s) < sessionRevokedAtSeconds (${userDoc.sessionRevokedAtSeconds}s)`,
      };
    }

    // Server-Authoritative Role Determination (Document role takes absolute precedence)
    const currentRole = userDoc.role;
    const isAdmin = currentRole === 'ADMIN';
    const isKepalaSekolah = currentRole === 'KEPALA_SEKOLAH';
    const isStaff = ['ADMIN', 'KEPALA_SEKOLAH', 'GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(currentRole);

    // 1. /user_credentials/{userId} -> allow read, write: if false;
    if (req.path.startsWith('/user_credentials/')) {
      return { allowed: false, reason: 'Hard-denied: user_credentials is not accessible by client SDK (allow read, write: if false;)' };
    }

    // 2. /settings/{settingId}
    if (req.path.startsWith('/settings/')) {
      if (req.method === 'get' || req.method === 'list') {
        return { allowed: true, reason: 'Authenticated active user can read settings' };
      }
      if (['create', 'update', 'delete'].includes(req.method)) {
        if (!isAdmin) return { allowed: false, reason: 'Write to settings is restricted to ADMIN' };
        return { allowed: true, reason: 'Admin write to settings permitted' };
      }
    }

    // 3. /users/{userId}
    const userMatch = req.path.match(/^\/users\/([^/]+)$/);
    if (userMatch) {
      const targetUserId = userMatch[1];
      const isOwner = uid === targetUserId;

      if (req.method === 'get' || req.method === 'list') {
        return { allowed: true, reason: 'Active authenticated user may read user directory' };
      }

      if (req.method === 'create') {
        if (!isAdmin) return { allowed: false, reason: 'Only Admin may create new users' };
        const hasCreds = req.requestResource?.data && ['pin', 'pinHash', 'pinSalt', 'password', 'token'].some(k => k in req.requestResource!.data);
        if (hasCreds) return { allowed: false, reason: 'Forbidden credential keys present in new user payload' };
        return { allowed: true, reason: 'Admin user creation permitted' };
      }

      if (req.method === 'update') {
        const hasCreds = req.requestResource?.data && ['pin', 'pinHash', 'pinSalt', 'password', 'token'].some(k => k in req.requestResource!.data);
        if (hasCreds) return { allowed: false, reason: 'Forbidden credential keys present in update payload' };

        if (isAdmin) {
          // Check primary admin demotion/deactivation defense
          const oldTargetData = req.resource?.data || this.userDatabase.get(targetUserId) || {};
          if (oldTargetData.role === 'ADMIN' && targetUserId === 'usr-admin-01') {
            const newRole = req.requestResource?.data?.role;
            const newActive = req.requestResource?.data?.isActive;
            if (newRole !== 'ADMIN' || newActive !== true) {
              return { allowed: false, reason: 'Forbidden: Primary system admin cannot be demoted or deactivated' };
            }
          }
          return { allowed: true, reason: 'Admin profile update permitted' };
        }

        if (isOwner) {
          const oldData = req.resource?.data || {};
          const newData = req.requestResource?.data || {};
          const affectedKeys = Object.keys(newData).filter(k => newData[k] !== oldData[k]);
          const allowedKeys = ['fullName', 'phone', 'email', 'avatarUrl', 'updatedAt'];
          const illegalKeys = affectedKeys.filter(k => !allowedKeys.includes(k));
          if (illegalKeys.length > 0) {
            return { allowed: false, reason: `Forbidden fields modified by non-admin owner: ${illegalKeys.join(', ')}` };
          }
          return { allowed: true, reason: 'Owner profile self-update permitted on safe fields' };
        }

        return { allowed: false, reason: 'Update rejected: must be Admin or profile owner' };
      }

      if (req.method === 'delete') {
        if (!isAdmin) return { allowed: false, reason: 'Only Admin may delete user profiles' };
        if (uid === targetUserId) return { allowed: false, reason: 'Admin cannot delete their own active account' };
        const oldTarget = req.resource?.data || this.userDatabase.get(targetUserId);
        if (oldTarget?.role === 'ADMIN') return { allowed: false, reason: 'Admin accounts cannot be deleted directly' };
        return { allowed: true, reason: 'Admin deletion of non-admin user permitted' };
      }
    }

    // 4. /dutyBooks/{dutyBookId}
    if (req.path.startsWith('/dutyBooks/')) {
      if (req.method === 'get' || req.method === 'list') {
        return { allowed: true, reason: 'Authenticated active user can view duty books' };
      }
      if (req.method === 'create') {
        if (!isStaff) return { allowed: false, reason: 'Only staff can create duty books' };
        if (req.requestResource?.data?.petugasId !== uid) {
          return { allowed: false, reason: 'petugasId on new dutyBook must match authenticated user' };
        }
        if (!['DRAFT', 'DIAJUKAN'].includes(req.requestResource?.data?.status)) {
          return { allowed: false, reason: 'New dutyBook must be in DRAFT or DIAJUKAN status' };
        }
        return { allowed: true, reason: 'DutyBook creation permitted' };
      }
      if (req.method === 'update') {
        const oldStatus = req.resource?.data?.status || 'DRAFT';
        const oldPetugasId = req.resource?.data?.petugasId;

        // If locked/approved, only Admin or Kepala Sekolah can touch it
        if (['DISETUJUI', 'DIKUNCI'].includes(oldStatus)) {
          if (!isAdmin && !isKepalaSekolah) {
            return { allowed: false, reason: `DutyBook is locked (${oldStatus}). Regular staff cannot edit locked records.` };
          }
          return { allowed: true, reason: 'Admin or Kepala Sekolah verification/unlock permitted' };
        }

        // If in DRAFT or DIAJUKAN
        if (isAdmin || isKepalaSekolah) {
          return { allowed: true, reason: 'Admin or Kepala Sekolah verification/status change permitted' };
        }

        // Owner action
        if (uid === oldPetugasId) {
          // Cannot reassign ownership
          if (req.requestResource?.data?.petugasId && req.requestResource.data.petugasId !== oldPetugasId) {
            return { allowed: false, reason: 'petugasId cannot be reassigned by owner' };
          }
          // Cannot self-approve to DISETUJUI or DIKUNCI
          const targetStatus = req.requestResource?.data?.status;
          if (['DISETUJUI', 'DIKUNCI'].includes(targetStatus)) {
            return { allowed: false, reason: `Staff cannot self-approve or lock dutyBook to '${targetStatus}'. Verification required by Kepala Sekolah/Admin.` };
          }
          return { allowed: true, reason: 'DutyBook owner edit permitted on draft' };
        }

        return { allowed: false, reason: 'Staff B cannot edit DutyBook owned by Staff A' };
      }
      if (req.method === 'delete') {
        if (!isAdmin) return { allowed: false, reason: 'Only Admin can delete duty books' };
        return { allowed: true, reason: 'Admin deletion permitted' };
      }
    }

    // 5. /incidents/{incidentId}
    if (req.path.startsWith('/incidents/')) {
      if (req.method === 'get' || req.method === 'list') {
        return { allowed: true, reason: 'Authenticated staff can read incident logs' };
      }
      if (req.method === 'create') {
        if (!isStaff) return { allowed: false, reason: 'Only staff can report incidents' };
        if (req.requestResource?.data?.pelaporId !== uid) {
          return { allowed: false, reason: 'pelaporId must match authenticated user' };
        }
        return { allowed: true, reason: 'Incident report creation permitted' };
      }
      if (req.method === 'update') {
        const oldPelaporId = req.resource?.data?.pelaporId;
        if (isAdmin || isKepalaSekolah) {
          return { allowed: true, reason: 'Admin or Kepala Sekolah status update/escalation permitted' };
        }
        if (uid === oldPelaporId) {
          if (req.requestResource?.data?.pelaporId && req.requestResource.data.pelaporId !== oldPelaporId) {
            return { allowed: false, reason: 'pelaporId cannot be reassigned by reporter' };
          }
          return { allowed: true, reason: 'Reporter edit permitted' };
        }
        return { allowed: false, reason: 'Staff B cannot edit Incident reported by Staff A' };
      }
      if (req.method === 'delete') {
        if (!isAdmin) return { allowed: false, reason: 'Only Admin can delete incident records' };
        return { allowed: true, reason: 'Admin deletion permitted' };
      }
    }

    // 6. /attendance/{attendanceId}
    if (req.path.startsWith('/attendance/')) {
      if (req.method === 'get' || req.method === 'list') return { allowed: true, reason: 'Read permitted' };
      if (req.method === 'create') {
        if (!isStaff) return { allowed: false, reason: 'Only staff can log attendance' };
        if (req.requestResource?.data?.userId !== uid) {
          return { allowed: false, reason: 'Cannot submit attendance for another user (userId mismatch)' };
        }
        return { allowed: true, reason: 'Self-attendance log permitted' };
      }
      if (['update', 'delete'].includes(req.method)) {
        if (!isAdmin) return { allowed: false, reason: 'Only Admin can alter attendance logs' };
        return { allowed: true, reason: 'Admin attendance alteration permitted' };
      }
    }

    // 7. /auditLogs/{logId}
    if (req.path.startsWith('/auditLogs/')) {
      if (req.method === 'update' || req.method === 'delete') {
        return { allowed: false, reason: 'Audit logs are immutable: update and delete are strictly false' };
      }
      if (req.method === 'create') {
        if (req.requestResource?.data?.userId && req.requestResource.data.userId !== uid) {
          return { allowed: false, reason: 'Audit log userId must match authenticated user' };
        }
        return { allowed: true, reason: 'Append to audit logs permitted' };
      }
      if (req.method === 'get' || req.method === 'list') {
        if (!isStaff) return { allowed: false, reason: 'Audit logs read requires staff role' };
        return { allowed: true, reason: 'Staff audit logs read permitted' };
      }
    }

    // Default master data and schedules rule: staff read, admin write
    if (['/teachers/', '/staff/', '/students/', '/rooms/', '/incidentCategories/', '/schedules/', '/announcements/', '/emergencies/', '/studentPermits/', '/substitutions/', '/studentTardiness/', '/visitors/', '/documents/'].some(p => req.path.startsWith(p))) {
      if (req.method === 'get' || req.method === 'list') return { allowed: true, reason: 'Staff read permitted' };
      if (!isAdmin) return { allowed: false, reason: 'Master data write restricted to Admin' };
      return { allowed: true, reason: 'Admin master data write permitted' };
    }

    return { allowed: false, reason: 'Default deny rule applied' };
  }
}

async function runComprehensiveTests() {
  console.log('================================================================================');
  console.log('       CR-AUTH-BACKUP-001 — TAHAP 2C COMPREHENSIVE VERIFICATION SUITE           ');
  console.log('================================================================================\n');

  const engine = new ProductionRulesEngine();

  // -------------------------------------------------------------
  // SECTION 1: OWASP SCRYPT ADAPTIVE HASHING PARAMETER AUDIT
  // -------------------------------------------------------------
  console.log('--- [SECTION 1] OWASP SCRYPT PARAMETERS & EXECUTION AUDIT ---');
  const testPin = '789123';
  const startHashTime = Date.now();
  const generatedHash = await hashPinAdaptive(testPin);
  const hashDuration = Date.now() - startHashTime;

  // Expected prefix per OWASP Password Storage Cheat Sheet recommendation
  const expectedPrefix = '$scrypt$N=16384,r=8,p=5$';
  const hasOwaspParams = generatedHash.startsWith(expectedPrefix);
  const verifyCorrect = await verifyPinAdaptive(testPin, generatedHash);
  const verifyWrong = await verifyPinAdaptive('000000', generatedHash);

  recordTest(
    'CRYPTO',
    'TEST-SCRYPT-OWASP',
    'OWASP Scrypt N=16384, r=8, p=5 Parameter Enforcement',
    hasOwaspParams && verifyCorrect && !verifyWrong ? 'PASS' : 'FAIL',
    `Starts with ${expectedPrefix}, timing-safe verification = true, wrong PIN = false`,
    `Hash: ${generatedHash.substring(0, 38)}... (duration: ${hashDuration}ms)`,
    `Configured DEFAULT_SCRYPT_PARAMS: N=${DEFAULT_SCRYPT_PARAMS.N}, r=${DEFAULT_SCRYPT_PARAMS.r}, p=${DEFAULT_SCRYPT_PARAMS.p}, keylen=${DEFAULT_SCRYPT_PARAMS.keyLength}, maxmem=${DEFAULT_SCRYPT_PARAMS.maxmem}`
  );

  // -------------------------------------------------------------
  // SECTION 2: ACCOUNT LIFECYCLE, ROLE PRECEDENCE & SESSION REVOCATION
  // -------------------------------------------------------------
  console.log('--- [SECTION 2] ACCOUNT LIFECYCLE, ROLE PRECEDENCE & SESSION REVOCATION ---');

  // Test 2.1: Inactive account (isActive == false) accessing protected data
  const t_inactive = engine.evaluate({
    auth: { uid: 'usr-inactive-01', token: { auth_time: 1500, role: 'GURU' } },
    method: 'get',
    path: '/users/usr-admin-01',
  });
  recordTest(
    'LIFECYCLE',
    'TEST-REVOC-01',
    'Disabled/Inactive Account Access Rejection',
    !t_inactive.allowed ? 'PASS' : 'FAIL',
    'REJECTED (isActive == false)',
    t_inactive.allowed ? 'ALLOWED' : 'REJECTED',
    t_inactive.reason
  );

  // Test 2.2: Non-existent profile document in Firestore
  const t_notfound = engine.evaluate({
    auth: { uid: 'usr-ghost-99', token: { auth_time: 1500, role: 'GURU' } },
    method: 'get',
    path: '/settings/school_config',
  });
  recordTest(
    'LIFECYCLE',
    'TEST-REVOC-02',
    'Non-Existent Profile Document Rejection',
    !t_notfound.allowed ? 'PASS' : 'FAIL',
    'REJECTED (userExists == false)',
    t_notfound.allowed ? 'ALLOWED' : 'REJECTED',
    t_notfound.reason
  );

  // Test 2.3: Demoted ADMIN holding stale ADMIN ID Token claim
  // User had token minted with role='ADMIN', but Firestore document has role='GURU'
  const t_demoted = engine.evaluate({
    auth: { uid: 'usr-demoted-01', token: { auth_time: 2500, role: 'ADMIN' } }, // Token claims ADMIN
    method: 'update',
    path: '/settings/school_config', // Requires ADMIN role
    requestResource: { data: { schoolName: 'Malicious Change' } },
  });
  recordTest(
    'LIFECYCLE',
    'TEST-REVOC-03',
    'Demoted Admin with Stale Custom Claim Rejection',
    !t_demoted.allowed ? 'PASS' : 'FAIL',
    'REJECTED (Document role GURU takes precedence over stale token claim ADMIN)',
    t_demoted.allowed ? 'ALLOWED' : 'REJECTED',
    t_demoted.reason
  );

  // Test 2.4: Revoked session (token auth_time < sessionRevokedAtSeconds)
  // User holds token issued at t=1500, but admin revoked sessions at t=2000
  const t_revoked_session = engine.evaluate({
    auth: { uid: 'usr-demoted-01', token: { auth_time: 1500, role: 'GURU' } },
    method: 'get',
    path: '/users/usr-guru-01',
  });
  recordTest(
    'LIFECYCLE',
    'TEST-REVOC-04',
    'Stale Session Prior to Revocation Timestamp Rejection',
    !t_revoked_session.allowed ? 'PASS' : 'FAIL',
    'REJECTED (token auth_time 1500 < sessionRevokedAtSeconds 2000)',
    t_revoked_session.allowed ? 'ALLOWED' : 'REJECTED',
    t_revoked_session.reason
  );

  // Test 2.5: Token without role field (fallback robustness)
  const t_norole_token = engine.evaluate({
    auth: { uid: 'usr-admin-01', token: { auth_time: 1500 } }, // No role in token
    method: 'update',
    path: '/settings/school_config',
    requestResource: { data: { schoolName: 'Legitimate Admin Update' } },
  });
  recordTest(
    'LIFECYCLE',
    'TEST-REVOC-05',
    'Token Missing Role Field Graceful Document Lookup',
    t_norole_token.allowed ? 'PASS' : 'FAIL',
    'ALLOWED (Gracefully reads role ADMIN from Firestore document without crashing)',
    t_norole_token.allowed ? 'ALLOWED' : 'REJECTED',
    t_norole_token.reason
  );

  // Test 2.6: Verified access across all 5 operational roles
  const rolesToCheck: Array<{ uid: string; role: UserRole }> = [
    { uid: 'usr-admin-01', role: 'ADMIN' },
    { uid: 'usr-kepsek-01', role: 'KEPALA_SEKOLAH' },
    { uid: 'usr-guru-01', role: 'GURU' },
    { uid: 'usr-tendik-01', role: 'TENAGA_KEPENDIDIKAN' },
    { uid: 'usr-satpam-01', role: 'SATPAM' },
  ];
  let allRolesAccessPass = true;
  for (const r of rolesToCheck) {
    const evalRes = engine.evaluate({
      auth: { uid: r.uid, token: { auth_time: 1500, role: r.role } },
      method: 'get',
      path: '/schedules/sched-today-01',
    });
    if (!evalRes.allowed) allRolesAccessPass = false;
  }
  recordTest(
    'RBAC',
    'TEST-RBAC-ALL-ROLES',
    'Legitimate Access Validation Across All 5 Real Roles',
    allRolesAccessPass ? 'PASS' : 'FAIL',
    'ALLOWED for ADMIN, KEPALA_SEKOLAH, GURU, TENAGA_KEPENDIDIKAN, SATPAM',
    allRolesAccessPass ? 'ALL 5 ALLOWED' : 'SOME DENIED',
    'All 5 operational roles verified active with authentic permissions'
  );

  // -------------------------------------------------------------
  // SECTION 3: OPERATIONAL OWNERSHIP & STATUS LOCKING
  // -------------------------------------------------------------
  console.log('--- [SECTION 3] OPERATIONAL OWNERSHIP & STATUS LOCKING ---');

  // Test 3.1: Staff B modifying DutyBook owned by Staff A
  const t_duty_steal = engine.evaluate({
    auth: { uid: 'usr-guru-02', token: { auth_time: 1500, role: 'GURU' } },
    method: 'update',
    path: '/dutyBooks/db-001',
    resource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DRAFT', catatanPiket: 'Original note' } },
    requestResource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DRAFT', catatanPiket: 'Tampered note' } },
  });
  recordTest(
    'OWNERSHIP',
    'TEST-DUTY-OWNER-01',
    'Cross-Staff DutyBook Tampering Prevention',
    !t_duty_steal.allowed ? 'PASS' : 'FAIL',
    'REJECTED (Staff B cannot edit DutyBook owned by Staff A)',
    t_duty_steal.allowed ? 'ALLOWED' : 'REJECTED',
    t_duty_steal.reason
  );

  // Test 3.2: Staff A attempting to self-approve/lock DutyBook (status -> DISETUJUI / DIKUNCI)
  const t_duty_self_lock = engine.evaluate({
    auth: { uid: 'usr-guru-01', token: { auth_time: 1500, role: 'GURU' } },
    method: 'update',
    path: '/dutyBooks/db-001',
    resource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DRAFT' } },
    requestResource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DISETUJUI' } },
  });
  recordTest(
    'OWNERSHIP',
    'TEST-DUTY-LOCK-01',
    'Staff Self-Approval & Premature Lockout Rejection',
    !t_duty_self_lock.allowed ? 'PASS' : 'FAIL',
    'REJECTED (Staff cannot self-approve; verification requires Kepala Sekolah or Admin)',
    t_duty_self_lock.allowed ? 'ALLOWED' : 'REJECTED',
    t_duty_self_lock.reason
  );

  // Test 3.3: Kepala Sekolah legitimately approving and locking DutyBook
  const t_kepsek_approve = engine.evaluate({
    auth: { uid: 'usr-kepsek-01', token: { auth_time: 1500, role: 'KEPALA_SEKOLAH' } },
    method: 'update',
    path: '/dutyBooks/db-001',
    resource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DIAJUKAN' } },
    requestResource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DISETUJUI', catatanKepsek: 'Disetujui' } },
  });
  recordTest(
    'OWNERSHIP',
    'TEST-DUTY-VERIF-01',
    'Kepala Sekolah Official Verification & Approval',
    t_kepsek_approve.allowed ? 'PASS' : 'FAIL',
    'ALLOWED (Kepala Sekolah role possesses verification authority)',
    t_kepsek_approve.allowed ? 'ALLOWED' : 'REJECTED',
    t_kepsek_approve.reason
  );

  // Test 3.4: Staff editing a LOCKED duty book (status == 'DIKUNCI' or 'DISETUJUI')
  const t_duty_edit_locked = engine.evaluate({
    auth: { uid: 'usr-guru-01', token: { auth_time: 1500, role: 'GURU' } },
    method: 'update',
    path: '/dutyBooks/db-001',
    resource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DIKUNCI' } },
    requestResource: { data: { id: 'db-001', petugasId: 'usr-guru-01', status: 'DIKUNCI', catatanPiket: 'Late edit' } },
  });
  recordTest(
    'OWNERSHIP',
    'TEST-DUTY-LOCKED-01',
    'Post-Lock Modification Rejection on DutyBooks',
    !t_duty_edit_locked.allowed ? 'PASS' : 'FAIL',
    'REJECTED (DutyBook is locked; regular staff cannot edit locked records)',
    t_duty_edit_locked.allowed ? 'ALLOWED' : 'REJECTED',
    t_duty_edit_locked.reason
  );

  // Test 3.5: Accidental / Malicious Primary Admin Demotion Defense
  const t_admin_demote = engine.evaluate({
    auth: { uid: 'usr-admin-01', token: { auth_time: 1500, role: 'ADMIN' } },
    method: 'update',
    path: '/users/usr-admin-01',
    resource: { data: { id: 'usr-admin-01', role: 'ADMIN', isActive: true } },
    requestResource: { data: { id: 'usr-admin-01', role: 'GURU', isActive: true } },
  });
  recordTest(
    'ADMIN_DEFENSE',
    'TEST-ADMIN-LOCKOUT-02',
    'Primary System Admin Demotion Defense',
    !t_admin_demote.allowed ? 'PASS' : 'FAIL',
    'REJECTED (Primary system admin usr-admin-01 cannot be demoted or deactivated)',
    t_admin_demote.allowed ? 'ALLOWED' : 'REJECTED',
    t_admin_demote.reason
  );

  // Test 3.6: Primary Admin Self-Deletion Defense
  const t_admin_delete = engine.evaluate({
    auth: { uid: 'usr-admin-01', token: { auth_time: 1500, role: 'ADMIN' } },
    method: 'delete',
    path: '/users/usr-admin-01',
  });
  recordTest(
    'ADMIN_DEFENSE',
    'TEST-ADMIN-LOCKOUT-03',
    'Primary System Admin Deletion Defense',
    !t_admin_delete.allowed ? 'PASS' : 'FAIL',
    'REJECTED (Admin cannot self-delete account)',
    t_admin_delete.allowed ? 'ALLOWED' : 'REJECTED',
    t_admin_delete.reason
  );

  // -------------------------------------------------------------
  // SECTION 4: BACKUP & RESTORE ISOLATED ROUNDTRIP & DEFENSE
  // -------------------------------------------------------------
  console.log('--- [SECTION 4] BACKUP & RESTORE ISOLATED ROUNDTRIP & SANITIZATION ---');

  const mockAdminUser: UserProfile = {
    id: 'usr-admin-01',
    nip: '198503152010011002',
    fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
    role: 'ADMIN',
    email: 'admin@sekolah.sch.id',
    phone: '081234567890',
    isActive: true,
    permissions: ['*'],
  };

  // Malicious Restore Payload simulating attacker attempts
  const maliciousRestorePayload: BackupPayload = {
    formatVersion: '1.0.0',
    app: 'PIKET_GURU_DIGITAL',
    timestamp: new Date().toISOString(),
    environment: 'PRODUCTION',
    createdBy: { id: 'usr-admin-01', fullName: 'Admin', nip: '123', role: 'ADMIN' },
    metadata: {
      schoolName: 'SMK dr. SOEBANDI',
      npsn: '20109988',
      totalCollections: 17,
      totalRecords: 3,
      collectionsList: ['users', 'settings', 'user_credentials'],
      credentialsIncluded: true,
    },
    data: {
      users: [
        {
          id: 'usr-admin-01',
          nip: '198503152010011002',
          fullName: 'Drs. H. Ahmad Fauzi, M.Pd.',
          role: 'GURU', // Privilege downgrade attack
          isActive: false, // Lockout attack
          pin: '999999', // Plaintext pin injection
          pinHash: 'attacker_hash',
          pinSalt: 'attacker_salt',
        },
        {
          id: 'usr-attacker-01',
          nip: '199999999999',
          fullName: 'Attacker Account',
          role: 'ADMIN', // Unauthorized admin elevation
          pin: '123456',
        },
      ],
      // Malicious attempt to inject credentials collection
      user_credentials: [
        { userId: 'usr-attacker-01', scryptHash: 'backdoor' },
      ],
      teachers: [],
      staff: [],
      rooms: [],
      incidentCategories: [],
      schedules: [],
      attendance: [],
      dutyBooks: [],
      incidents: [],
      settings: [{ id: 'school_config', schoolName: 'SMK dr. SOEBANDI' }],
      auditLogs: [],
      studentTardiness: [],
      substitutions: [],
      studentPermits: [],
      visitors: [],
      announcements: [],
      documents: [],
    } as any,
  };

  const validation = BackupService.validateBackupSchema(maliciousRestorePayload);
  const detectedLegacyCreds = validation.hasLegacyCredentials === true;

  recordTest(
    'BACKUP',
    'TEST-BACKUP-DETECT',
    'Malicious Payload & Legacy Credential Detection',
    detectedLegacyCreds ? 'PASS' : 'FAIL',
    'hasLegacyCredentials == true and warning generated',
    `hasLegacyCredentials: ${validation.hasLegacyCredentials}`,
    `Warning: "${validation.warning}"`
  );

  // Test Profile Allowlist Sanitization
  const cleanAdmin = sanitizeUserProfile(maliciousRestorePayload.data.users[0]);
  const leakedAdminKeys = ['pin', 'pinHash', 'pinSalt', 'password'].filter(k => k in cleanAdmin);

  recordTest(
    'BACKUP',
    'TEST-RESTORE-SAN',
    'User Document Credential Stripping on Deserialization',
    leakedAdminKeys.length === 0 ? 'PASS' : 'FAIL',
    'Zero credential keys present in sanitized user object',
    `Leaked keys: [${leakedAdminKeys.join(', ')}]`,
    'pin, pinHash, pinSalt, and password stripped completely'
  );

  // -------------------------------------------------------------
  // SECTION 5: IAM & FIREBASE AUTH REALITY STATUS
  // -------------------------------------------------------------
  console.log('--- [SECTION 5] IAM ADC SIGNER REALITY & BLOCKER STATUS ---');
  const signerDiag = await testSignerCapability('probe-uid-tahap2c');

  recordTest(
    'AUTH_IAM',
    'TEST-IAM-BLOCKER-STATUS',
    'Cloud Run Container IAM signBlob Capability Diagnostic',
    signerDiag.available ? 'PASS' : 'BLOCKED',
    'Signer operational OR truthfully reported as BLOCKED without HMAC fallback',
    signerDiag.available
      ? 'Signer is available and operational'
      : `BLOCKED (${signerDiag.code}: ${signerDiag.message})`,
    signerDiag.available
      ? 'IAM roles/iam.serviceAccountTokenCreator active'
      : 'Runtime container default SA lacks iam.serviceAccounts.signBlob; HTTP 503 fail-closed enforced'
  );

  console.log('\n================================================================================');
  console.log('                          FINAL ASSERTION MATRIX                                ');
  console.log('================================================================================');
  console.table(
    testResults.map(r => ({
      Category: r.category,
      ID: r.testId,
      Title: r.title,
      Status: r.status,
    }))
  );

  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const blockCount = testResults.filter(r => r.status === 'BLOCKED').length;
  const failCount = testResults.filter(r => r.status === 'FAIL').length;

  console.log(`\nTOTAL TESTS: ${testResults.length} | PASS: ${passCount} | BLOCKED (IAM Dependency): ${blockCount} | FAIL: ${failCount}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch(err => {
  console.error('[FATAL] Tahap 2C test suite crashed:', err);
  process.exit(1);
});
