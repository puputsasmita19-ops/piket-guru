import { hashPinAdaptive, verifyPinAdaptive } from '../crypto/adaptiveHash.js';
import { adminDb } from '../firebaseAdmin.js';

export interface UserCredentialRecord {
  userId: string;
  loginId?: string;
  nip: string;
  scryptHash: string;
  createdAt: string;
  updatedAt: string;
}

const CREDENTIALS_COLLECTION = 'user_credentials';

/**
 * Server-authoritative CredentialStore.
 * Directly communicates with private Firestore collection 'user_credentials' via Admin SDK.
 * Strictly avoids in-memory credential fallbacks, mock bypasses, or error-swallowing (CR-AUTH-BACKUP-001).
 * Permission denied, unavailable, readback mismatch, or delete failure propagate immediately as exceptions.
 * Server not-found returns strictly null.
 */
export class CredentialStore {
  private static getDb(): FirebaseFirestore.Firestore {
    if (!adminDb) {
      throw new Error('[CREDENTIAL_STORE] Admin SDK Firestore (adminDb) is uninitialized or unavailable.');
    }
    return adminDb;
  }

  /**
   * Sets or updates the adaptive scrypt hashed PIN for a user.
   * Enforces 6-digit numeric constraint, verifies write consistency by reading back,
   * and propagates any database errors immediately.
   */
  public static async setCredential(userId: string, nip: string, pin: string, loginId?: string): Promise<void> {
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      throw new Error('PIN must be exactly 6 numeric digits');
    }

    const scryptHash = await hashPinAdaptive(pin.trim());
    const now = new Date().toISOString();
    const record: UserCredentialRecord = {
      userId,
      loginId: loginId ? loginId.trim().toUpperCase() : '',
      nip: nip ? nip.trim() : '',
      scryptHash,
      updatedAt: now,
      createdAt: now,
    };

    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);

    // 1. Write the new credential record via Admin SDK
    await credRef.set(record, { merge: true });

    // 2. Read back to verify consistency before considering the write successful
    const verifySnap = await credRef.get();
    if (!verifySnap.exists || verifySnap.data()?.scryptHash !== scryptHash) {
      throw new Error(`Write consistency check failed for credential of user '${userId}'`);
    }
  }

  /**
   * Retrieves user credential from private collection.
   * Returns null strictly when document does not exist.
   * Propagates errors on permission or connection failure.
   */
  public static async getCredential(userId: string): Promise<UserCredentialRecord | null> {
    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);
    const snap = await credRef.get();

    if (!snap.exists) {
      return null;
    }

    return snap.data() as UserCredentialRecord;
  }

  /**
   * Verifies a PIN against the user's stored adaptive hash.
   * Fails closed: returns false if credential not found or hash invalid.
   * Strictly avoids plaintext fallback or cached credential revival.
   */
  public static async verifyCredential(userId: string, pin: string): Promise<boolean> {
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin.trim())) {
      return false;
    }

    const cred = await this.getCredential(userId);
    if (!cred || !cred.scryptHash) {
      return false;
    }

    return verifyPinAdaptive(pin.trim(), cred.scryptHash);
  }

  /**
   * Permanently deletes credentials for a removed user with error propagation and readback verification.
   */
  public static async deleteCredential(userId: string): Promise<void> {
    const dbInstance = this.getDb();
    const credRef = dbInstance.collection(CREDENTIALS_COLLECTION).doc(userId);
    await credRef.delete();

    // Verify deletion readback
    const checkSnap = await credRef.get();
    if (checkSnap.exists) {
      throw new Error(`Failed to delete credential record for user '${userId}': document still exists.`);
    }
  }
}
