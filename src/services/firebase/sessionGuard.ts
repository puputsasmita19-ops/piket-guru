import { auth } from './firebaseAuth';
import { OfflineStorage } from '../offline/offlineStorage';

/** Guards a complete async action, including gaps between reads, photos and writes. */
export function createAuthenticatedSession(expectedUid?: string, onCancel?: () => void) {
  const uid = auth.currentUser?.uid;
  const changed = () => Object.assign(new Error('Sesi akun telah berubah. Masuk kembali dengan akun pemilik data sebelum melanjutkan.'), { code: 'SESSION_CHANGED' });
  if (!uid || (expectedUid !== undefined && expectedUid !== uid)) throw changed();
  let active = true;
  const close = OfflineStorage.registerListener(() => { active = false; onCancel?.(); });
  return {
    uid, close,
    assertActive: () => { if (!active || auth.currentUser?.uid !== uid) throw changed(); },
  };
}
