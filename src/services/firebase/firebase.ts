import { getFirestore, Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import app, { auth } from './firebaseAuth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firestore with specific databaseId if provided
export const db: Firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export { auth };

/**
 * Returns active Firebase Auth user if present
 */
export const ensureFirebaseAuth = async (): Promise<User | null> => {
  return auth.currentUser || null;
};

export default app;


