import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FirestoreService } from '../services/firebase/firestoreService';
import { isSubjectCatalog, type SubjectCatalog } from '../types/subject.types';

/** Identical document subscriptions share the existing Firestore live source. */
export function useSubjectCatalog() {
  const { currentUser } = useAuth();
  const uid = currentUser?.id || '';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ uid: string; data: SubjectCatalog | null; loading: boolean; error: string }>({ uid: '', data: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ uid, data: null, loading: true, error: '' });
    if (!uid) return;
    const stop = FirestoreService.subscribeToDocument<SubjectCatalog>('subjects', 'catalog', data => {
      if (!active) return;
      if (data && !isSubjectCatalog(data)) { setState({ uid, data: null, loading: false, error: 'Format master mata pelajaran tidak valid. Hubungi admin.' }); return; }
      setState({ uid, data: data || null, loading: false, error: '' });
    }, error => {
      if (active) setState({ uid, data: null, loading: false, error: (error as any).code === 'permission-denied' ? 'Master mata pelajaran belum dapat diakses. Admin perlu menerapkan Firestore Rules dari pembaruan ini.' : 'Saran mata pelajaran belum dapat dimuat. Periksa koneksi atau gunakan isian manual.' });
    });
    return () => { active = false; stop(); };
  }, [uid, attempt]);
  const data = state.uid === uid ? state : { uid, data: null, loading: true, error: '' };
  return { entries: data.data?.entries || [], loading: data.loading, error: data.error, reload: () => setAttempt(n => n + 1) };
}
