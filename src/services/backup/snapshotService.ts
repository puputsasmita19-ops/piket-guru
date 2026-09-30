import { FirestoreService } from '../firebase/firestoreService';
import { BackupService, BackupPayload } from './backupService';
import { CloudSnapshotRecord } from '../../types/security.types';
import { UserProfile } from '../../types';

export class SnapshotService {
  private static readonly SNAPSHOTS_COLLECTION = 'database_snapshots';

  /**
   * Generates a new snapshot in Firestore
   */
  public static async createSnapshot(
    name: string,
    currentUser: UserProfile
  ): Promise<CloudSnapshotRecord> {
    const fullBackup: BackupPayload = await BackupService.createFullBackup(currentUser);
    const jsonStr = JSON.stringify(fullBackup);
    const sizeBytes = new Blob([jsonStr]).size;

    // Calculate collection breakdown
    const summary: Record<string, number> = {
      users: fullBackup.data.users?.length || 0,
      teachers: fullBackup.data.teachers?.length || 0,
      staff: fullBackup.data.staff?.length || 0,
      rooms: fullBackup.data.rooms?.length || 0,
      schedules: fullBackup.data.schedules?.length || 0,
      attendance: fullBackup.data.attendance?.length || 0,
      dutyBooks: fullBackup.data.dutyBooks?.length || 0,
      incidents: fullBackup.data.incidents?.length || 0,
      studentTardiness: fullBackup.data.studentTardiness?.length || 0,
      studentPermits: fullBackup.data.studentPermits?.length || 0,
      substitutions: fullBackup.data.substitutions?.length || 0,
      visitors: fullBackup.data.visitors?.length || 0,
      auditLogs: fullBackup.data.auditLogs?.length || 0,
    };

    // Simple hash fingerprint
    let hash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
      hash = (hash << 5) - hash + jsonStr.charCodeAt(i);
      hash |= 0;
    }
    const hashFingerprint = 'SHA-' + Math.abs(hash).toString(16).toUpperCase();

    const snapshotId = `SNAP-${Date.now()}`;
    const record: CloudSnapshotRecord = {
      id: snapshotId,
      timestamp: new Date().toISOString(),
      name: name || `Snapshot Otomatis ${new Date().toLocaleDateString('id-ID')}`,
      sizeBytes,
      totalRecords: fullBackup.metadata.totalRecords,
      collectionsSummary: summary,
      createdBy: currentUser.id,
      createdByName: currentUser.fullName,
      status: 'READY',
      hashFingerprint,
      dataPayload: fullBackup,
    };

    await FirestoreService.setDocument(this.SNAPSHOTS_COLLECTION, snapshotId, record);

    await FirestoreService.logAudit({
      userId: currentUser.id,
      userName: currentUser.fullName,
      role: currentUser.role,
      action: 'BACKUP',
      module: 'SYSTEM',
      details: `Membuat Snapshot Database "${record.name}" (${record.totalRecords} dokumen, ${Math.round(sizeBytes / 1024)} KB)`,
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
   * Restores database state from a snapshot
   */
  public static async restoreSnapshot(
    snapshot: CloudSnapshotRecord,
    currentUser: UserProfile
  ): Promise<{ restoredCount: number }> {
    if (!snapshot.dataPayload) {
      const fullDoc = await FirestoreService.getById<CloudSnapshotRecord>(
        this.SNAPSHOTS_COLLECTION,
        snapshot.id
      );
      if (!fullDoc || !fullDoc.dataPayload) {
        throw new Error('Data payload snapshot tidak ditemukan.');
      }
      return await BackupService.restoreFullBackup(fullDoc.dataPayload, currentUser);
    }

    return await BackupService.restoreFullBackup(snapshot.dataPayload, currentUser);
  }

  /**
   * Deletes a snapshot record
   */
  public static async deleteSnapshot(snapshotId: string, currentUser: UserProfile): Promise<void> {
    await FirestoreService.deleteDocument(this.SNAPSHOTS_COLLECTION, snapshotId);
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
