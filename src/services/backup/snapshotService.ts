import { FirestoreService } from '../firebase/firestoreService';
import { BackupService, BackupPayload } from './backupService';
import { CloudSnapshotRecord } from '../../types/security.types';
import { UserProfile } from '../../types';

// 500 KB limit ensures single documents stay far below the 1,048,576 byte Firestore limit
const MAX_CHUNK_BYTES = 500 * 1024;

/**
 * Deterministic canonical JSON stringification with sorted keys across all nested levels.
 * Prevents key reordering in map structures from invalidating cryptographic SHA-256 digests.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k])).join(',') + '}';
}

/**
 * Computes standard cryptographic SHA-256 hex digest across browser and Node environments.
 */
export async function computeSha256(content: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  try {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  } catch {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}

/**
 * Splits a UTF-8 string by strict byte length boundaries without splitting multi-byte Unicode characters.
 */
export function splitUtf8StringByByteLimit(str: string, maxBytes: number): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let currentChunk = '';
  let currentBytes = 0;

  for (const char of str) {
    const charBytes = encoder.encode(char).length;
    if (currentBytes + charBytes > maxBytes && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = char;
      currentBytes = charBytes;
    } else {
      currentChunk += char;
      currentBytes += charBytes;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export class SnapshotService {
  private static readonly SNAPSHOTS_COLLECTION = 'database_snapshots';
  private static readonly CHUNKS_COLLECTION = 'database_snapshots_chunks';

  /**
   * Generates a new snapshot in Firestore with canonical cryptographic SHA-256 checksum
   * and strict UTF-8 byte chunking for datasets exceeding 500 KB.
   * Stores ONLY ONE canonical representation to prevent document size explosion.
   */
  public static async createSnapshot(
    name: string,
    currentUser: UserProfile
  ): Promise<CloudSnapshotRecord> {
    const fullBackup: BackupPayload = await BackupService.createFullBackup(currentUser);
    const canonicalJsonStr = canonicalJsonStringify(fullBackup);
    const encoder = new TextEncoder();
    const sizeBytes = encoder.encode(canonicalJsonStr).length;

    // Calculate collection breakdown
    const summary: Record<string, number> = {
      users: fullBackup.data.users?.length || 0,
      teachers: fullBackup.data.teachers?.length || 0,
      staff: fullBackup.data.staff?.length || 0,
      rooms: fullBackup.data.rooms?.length || 0,
      incidentCategories: fullBackup.data.incidentCategories?.length || 0,
      schedules: fullBackup.data.schedules?.length || 0,
      attendance: fullBackup.data.attendance?.length || 0,
      dutyBooks: fullBackup.data.dutyBooks?.length || 0,
      incidents: fullBackup.data.incidents?.length || 0,
      settings: fullBackup.data.settings?.length || 0,
      auditLogs: fullBackup.data.auditLogs?.length || 0,
      announcements: fullBackup.data.announcements?.length || 0,
      studentTardiness: fullBackup.data.studentTardiness?.length || 0,
      substitutions: fullBackup.data.substitutions?.length || 0,
      studentPermits: fullBackup.data.studentPermits?.length || 0,
      visitors: fullBackup.data.visitors?.length || 0,
      students: fullBackup.data.students?.length || 0,
      documents: fullBackup.data.documents?.length || 0,
      emergencies: fullBackup.data.emergencies?.length || 0,
      emergency_history: fullBackup.data.emergency_history?.length || 0,
    };

    // Canonical cryptographic SHA-256 checksum
    const hashFingerprint = await computeSha256(canonicalJsonStr);
    const snapshotId = `SNAP-${Date.now()}`;
    const isChunked = sizeBytes > MAX_CHUNK_BYTES;
    const chunks = isChunked ? splitUtf8StringByByteLimit(canonicalJsonStr, MAX_CHUNK_BYTES) : [];
    const totalChunks = isChunked ? chunks.length : 1;

    // Store ONLY rawPayloadStr (single representation) for non-chunked snapshots
    const record: CloudSnapshotRecord = {
      id: snapshotId,
      timestamp: new Date().toISOString(),
      name: name || `Snapshot Otomatis ${new Date().toLocaleDateString('id-ID')}`,
      sizeBytes,
      totalRecords: fullBackup.metadata.totalRecords,
      collectionsSummary: summary,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      status: 'BUILDING', // Initial state until verified
      hashFingerprint,
      digestAlgorithm: 'SHA-256',
      digestProvenance: 'Computed via canonical SHA-256 over deterministic JSON string before write',
      isChunked,
      totalChunks,
      rawPayloadStr: isChunked ? undefined : canonicalJsonStr,
    };

    // 1. Save metadata record in BUILDING state
    await FirestoreService.setDocument(this.SNAPSHOTS_COLLECTION, snapshotId, record);

    try {
      if (isChunked) {
        // 2. Write all chunks
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `${snapshotId}_chunk_${i}`;
          await FirestoreService.setDocument(
            this.CHUNKS_COLLECTION,
            chunkId,
            {
              id: chunkId,
              snapshotId,
              chunkIndex: i,
              totalChunks,
              data: chunks[i],
            }
          );
        }

        // 3. Read back and verify all chunks before finalizing
        const reassembledParts: string[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunkId = `${snapshotId}_chunk_${i}`;
          const chunkDoc = await FirestoreService.getByIdStrict<{ data: string; chunkIndex: number; snapshotId: string }>(
            this.CHUNKS_COLLECTION,
            chunkId
          );
          if (!chunkDoc || typeof chunkDoc.data !== 'string' || chunkDoc.snapshotId !== snapshotId) {
            throw new Error(`Write verification failed: chunk ${i} could not be read back or metadata mismatch.`);
          }
          reassembledParts.push(chunkDoc.data);
        }

        const readbackStr = reassembledParts.join('');
        const readbackHash = await computeSha256(readbackStr);
        if (readbackHash.toLowerCase() !== hashFingerprint.toLowerCase()) {
          throw new Error('Write consistency check failed: reassembled chunk digest does not match fingerprint.');
        }
      } else {
        // 3b. Read back non-chunked payload and verify digest before marking READY
        const savedDoc = await FirestoreService.getByIdStrict<CloudSnapshotRecord>(
          this.SNAPSHOTS_COLLECTION,
          snapshotId
        );
        if (!savedDoc || !savedDoc.rawPayloadStr) {
          throw new Error('Write verification failed: snapshot payload could not be read back.');
        }
        const readbackHash = await computeSha256(savedDoc.rawPayloadStr);
        if (readbackHash.toLowerCase() !== hashFingerprint.toLowerCase()) {
          throw new Error('Write consistency check failed: readback single document digest mismatch.');
        }
      }

      // 4. Finalize state to READY only after verification passes
      record.status = 'READY';
      await FirestoreService.setDocument(this.SNAPSHOTS_COLLECTION, snapshotId, {
        ...record,
        status: 'READY',
      });
    } catch (err: any) {
      // Clean up orphan chunks and set status to FAILED
      if (isChunked) {
        for (let i = 0; i < totalChunks; i++) {
          try {
            await FirestoreService.deleteDocument(this.CHUNKS_COLLECTION, `${snapshotId}_chunk_${i}`);
          } catch {}
        }
      }
      await FirestoreService.setDocument(this.SNAPSHOTS_COLLECTION, snapshotId, {
        ...record,
        status: 'FAILED',
        error: err.message,
      });
      throw new Error(`Snapshot creation failed: ${err.message}`);
    }

    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: 'BACKUP',
      module: 'SYSTEM',
      details: `Membuat Snapshot Database "${record.name}" (${record.totalRecords} dokumen, SHA-256: ${hashFingerprint.substring(
        0,
        12
      )}..., ${Math.round(sizeBytes / 1024)} KB${isChunked ? ` [${totalChunks} Chunks]` : ''})`,
    });

    return record;
  }

  /**
   * Retrieves all available snapshots
   */
  public static async getAllSnapshots(): Promise<CloudSnapshotRecord[]> {
    try {
      const records = await FirestoreService.getAll<CloudSnapshotRecord>(this.SNAPSHOTS_COLLECTION);
      return records.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (e) {
      console.warn('Failed to load snapshots:', e);
      return [];
    }
  }

  /**
   * Loads and verifies the full payload of a snapshot, reassembling chunks deterministically with bounds checking.
   */
  public static async loadAndVerifyPayload(
    snapshot: CloudSnapshotRecord
  ): Promise<BackupPayload> {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Snapshot record tidak valid.');
    }

    // Strict status check: ONLY 'READY' or 'RESTORED' snapshots can be loaded and restored
    if (snapshot.status !== 'READY' && snapshot.status !== 'RESTORED') {
      throw new Error(
        `Snapshot dalam status '${snapshot.status || 'UNKNOWN'}' tidak dapat dipulihkan. Hanya snapshot berstatus 'READY' yang dapat dipulihkan.`
      );
    }

    if (!snapshot.hashFingerprint || typeof snapshot.hashFingerprint !== 'string') {
      throw new Error('Metadata hashFingerprint snapshot tidak valid atau hilang.');
    }

    let rawJsonStr = '';

    if (snapshot.isChunked) {
      // Strict bounded metadata check (no recursion!)
      if (
        typeof snapshot.totalChunks !== 'number' ||
        !Number.isInteger(snapshot.totalChunks) ||
        snapshot.totalChunks <= 0 ||
        snapshot.totalChunks > 1000
      ) {
        throw new Error(`Metadata chunk snapshot '${snapshot.id}' tidak valid atau rusak (totalChunks: ${snapshot.totalChunks}).`);
      }

      const chunkParts: string[] = [];
      for (let i = 0; i < snapshot.totalChunks; i++) {
        const chunkId = `${snapshot.id}_chunk_${i}`;
        const chunkDoc = await FirestoreService.getByIdStrict<{ data: string; chunkIndex: number; snapshotId: string }>(
          this.CHUNKS_COLLECTION,
          chunkId
        );
        if (!chunkDoc || typeof chunkDoc.data !== 'string') {
          throw new Error(`Data chunk ${i} dari snapshot '${snapshot.id}' tidak ditemukan atau rusak.`);
        }
        if (chunkDoc.chunkIndex !== i || chunkDoc.snapshotId !== snapshot.id) {
          throw new Error(`Integritas urutan chunk ${i} gagal (metadata manifest tidak cocok).`);
        }
        chunkParts.push(chunkDoc.data);
      }
      rawJsonStr = chunkParts.join('');
    } else if (snapshot.rawPayloadStr) {
      rawJsonStr = snapshot.rawPayloadStr;
    } else if (snapshot.dataPayload) {
      rawJsonStr = canonicalJsonStringify(snapshot.dataPayload);
    } else {
      const fullDoc = await FirestoreService.getByIdStrict<CloudSnapshotRecord>(this.SNAPSHOTS_COLLECTION, snapshot.id);
      if (!fullDoc) {
        throw new Error(`Dokumen snapshot '${snapshot.id}' tidak ditemukan.`);
      }
      if (fullDoc.status !== 'READY' && fullDoc.status !== 'RESTORED') {
        throw new Error(`Snapshot dalam status '${fullDoc.status}' tidak dapat dipulihkan.`);
      }
      if (fullDoc.isChunked) {
        return this.loadAndVerifyPayload(fullDoc);
      }
      if (fullDoc.rawPayloadStr) {
        rawJsonStr = fullDoc.rawPayloadStr;
      } else if (fullDoc.dataPayload) {
        rawJsonStr = canonicalJsonStringify(fullDoc.dataPayload);
      } else {
        throw new Error(`Payload snapshot '${snapshot.id}' kosong.`);
      }
    }

    // Cryptographic canonical SHA-256 verification before restoring
    const computedHash = await computeSha256(rawJsonStr);
    if (computedHash.toLowerCase() !== snapshot.hashFingerprint.toLowerCase()) {
      throw new Error(
        `Verifikasi integritas snapshot gagal! Hash tercatat (${snapshot.hashFingerprint}) tidak cocok dengan isi payload (${computedHash}). Pemulihan dibatalkan.`
      );
    }

    return JSON.parse(rawJsonStr) as BackupPayload;
  }

  /**
   * Restores database state from a snapshot with mandatory cryptographic verification
   */
  public static async restoreSnapshot(
    snapshot: CloudSnapshotRecord,
    currentUser: UserProfile
  ): Promise<{ restoredCount: number; sanitizedUsersCount: number }> {
    const verifiedPayload = await this.loadAndVerifyPayload(snapshot);
    return await BackupService.restoreFullBackup(verifiedPayload, currentUser);
  }

  /**
   * Deletes a snapshot record and any associated chunks with full error reporting
   */
  public static async deleteSnapshot(snapshotId: string, currentUser: UserProfile): Promise<void> {
    const doc = await FirestoreService.getById<CloudSnapshotRecord>(this.SNAPSHOTS_COLLECTION, snapshotId);
    const deleteErrors: string[] = [];

    if (doc?.isChunked && typeof doc.totalChunks === 'number') {
      for (let i = 0; i < doc.totalChunks; i++) {
        try {
          await FirestoreService.deleteDocument(this.CHUNKS_COLLECTION, `${snapshotId}_chunk_${i}`);
        } catch (err: any) {
          deleteErrors.push(`Chunk ${i}: ${err.message}`);
        }
      }
    }

    try {
      await FirestoreService.deleteDocument(this.SNAPSHOTS_COLLECTION, snapshotId);
    } catch (err: any) {
      deleteErrors.push(`Metadata: ${err.message}`);
    }

    if (deleteErrors.length > 0) {
      throw new Error(`Peringatan saat menghapus snapshot: ${deleteErrors.join('; ')}`);
    }

    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: 'DELETE',
      module: 'SYSTEM',
      details: `Menghapus snapshot cadangan ${snapshotId}`,
    });
  }
}
