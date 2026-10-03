import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
  } else {
    // Check for explicit service account key (file path or inline JSON string)
    const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const gCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (saEnv) {
      try {
        let creds: any;
        if (saEnv.startsWith('{')) {
          creds = JSON.parse(saEnv);
        } else if (fs.existsSync(saEnv)) {
          creds = JSON.parse(fs.readFileSync(saEnv, 'utf8'));
        }
        if (creds) {
          adminApp = initializeApp({
            credential: cert(creds),
            projectId: firebaseConfig.projectId,
          });
        }
      } catch (err) {
        console.warn('[FIREBASE_ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to ADC:', err);
      }
    }

    if (!adminApp && gCreds && fs.existsSync(gCreds)) {
      try {
        const creds = JSON.parse(fs.readFileSync(gCreds, 'utf8'));
        adminApp = initializeApp({
          credential: cert(creds),
          projectId: firebaseConfig.projectId,
        });
      } catch (err) {
        console.warn('[FIREBASE_ADMIN] Failed to parse GOOGLE_APPLICATION_CREDENTIALS:', err);
      }
    }

    if (!adminApp) {
      // Default initialization via Google Cloud Application Default Credentials (ADC)
      adminApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }

  adminAuth = getAuth(adminApp);
  adminDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(adminApp);
}

initFirebaseAdmin();

export { adminApp, adminAuth, adminDb };

/**
 * Diagnostic tool to verify IAM signer capability for custom token creation
 */
export async function testSignerCapability(testUid = 'health-check-probe'): Promise<{
  available: boolean;
  code?: string;
  message?: string;
  token?: string;
}> {
  try {
    const token = await adminAuth.createCustomToken(testUid);
    return { available: true, token };
  } catch (err: any) {
    return {
      available: false,
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message,
    };
  }
}
