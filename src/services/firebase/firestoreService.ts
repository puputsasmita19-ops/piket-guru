import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { AuditLogRecord } from '../../types/master.types';

export class FirestoreService {
  /**
   * Generic get all documents from a collection
   */
  public static async getAll<T>(collectionName: string, constraints: QueryConstraint[] = []): Promise<T[]> {
    try {
      const colRef = collection(db, collectionName);
      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
    } catch (err) {
      console.error(`Error fetching collection ${collectionName}:`, err);
      // Fallback to local storage if network is offline
      const localData = localStorage.getItem(`piket_firestore_${collectionName}`);
      if (localData) {
        try {
          return JSON.parse(localData);
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Real-time listener for a collection
   */
  public static subscribeToCollection<T>(
    collectionName: string,
    onData: (data: T[]) => void,
    onError?: (err: Error) => void,
    constraints: QueryConstraint[] = []
  ): Unsubscribe {
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);

    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
        // Cache to local storage
        localStorage.setItem(`piket_firestore_${collectionName}`, JSON.stringify(items));
        onData(items);
      },
      (error) => {
        console.warn(`Snapshot listener warning for ${collectionName}:`, error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Get single document by ID
   */
  public static async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as unknown as T;
      }
      return null;
    } catch (err) {
      console.error(`Error getting document ${collectionName}/${id}:`, err);
      return null;
    }
  }

  /**
   * Create or overwrite a document
   */
  public static async setDocument<T extends { id: string }>(
    collectionName: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    const payload = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, payload, { merge: true });
    
    // Update local cache
    const existing = await this.getAll<T>(collectionName);
    const updated = existing.filter((item) => item.id !== id).concat(payload as unknown as T);
    localStorage.setItem(`piket_firestore_${collectionName}`, JSON.stringify(updated));
  }

  /**
   * Delete a document
   */
  public static async deleteDocument(collectionName: string, id: string): Promise<void> {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);

    // Update local cache
    const local = localStorage.getItem(`piket_firestore_${collectionName}`);
    if (local) {
      try {
        const items = JSON.parse(local).filter((item: { id: string }) => item.id !== id);
        localStorage.setItem(`piket_firestore_${collectionName}`, JSON.stringify(items));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Log an action to auditLogs collection
   */
  public static async logAudit(log: Omit<AuditLogRecord, 'id' | 'timestamp'>): Promise<void> {
    try {
      const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payload: AuditLogRecord = {
        ...log,
        id,
        timestamp: new Date().toISOString(),
      };
      await setDoc(doc(db, 'auditLogs', id), payload);
    } catch (err) {
      console.warn('Could not write audit log to Firestore:', err);
    }
  }
}
