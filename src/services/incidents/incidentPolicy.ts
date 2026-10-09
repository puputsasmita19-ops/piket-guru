import { UserProfile } from '../../types';
import { IncidentRecord, IncidentStatus, getIncidentCategoryDisplay } from '../../types/incident.types';
import { IncidentCategoryRecord } from '../../types/master.types';
import { PERMISSIONS } from '../../config/permissions';

/**
 * Patch INSIDEN-20261007-R1: Incident Policy & Access Control Module
 * Centralizes permission checks, status alignments, category handling, and validations.
 */

export const ALLOWED_INITIAL_INCIDENT_STATUSES: IncidentStatus[] = [
  'BARU',
  'INVESTIGASI',
  'PENANGANAN',
];

export class IncidentPolicy {
  /**
   * Check if a user has permission to create new incident reports.
   * Matches Firestore Rules hasIncidentCreatePerm(): ADMIN, KEPALA_SEKOLAH, GURU, TENAGA_KEPENDIDIKAN, SATPAM
   * or permissions: ['*', 'incident.create', 'report_incidents', 'input_duty_book'].
   */
  public static canCreate(user: UserProfile | null | undefined): boolean {
    if (!user || !user.isActive || user.requiresActivation) return false;
    if (user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH') return true;
    if (['GURU', 'TENAGA_KEPENDIDIKAN', 'SATPAM'].includes(user.role)) return true;
    const perms = user.permissions || [];
    return perms.some((p) =>
      ['*', 'incident.create', 'report_incidents', 'input_duty_book'].includes(p)
    );
  }

  /**
   * Check if a user can edit an existing incident report.
   * - Admins and Kepala Sekolah can update any incident.
   * - Original reporter (pelaporId) can edit their own incident report.
   */
  public static canUpdate(user: UserProfile | null | undefined, incident: IncidentRecord | null | undefined): boolean {
    if (!user || !user.isActive || user.requiresActivation) return false;
    if (user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH') return true;
    if (!incident) return false;
    if (incident.pelaporId === user.id) return true;
    const perms = user.permissions || [];
    return perms.some((p) =>
      ['*', 'incident.update', 'report_incidents'].includes(p)
    );
  }

  /**
   * Check if a user can change status / resolve incidents (Admin / Kepala Sekolah).
   */
  public static canResolve(user: UserProfile | null | undefined): boolean {
    if (!user || !user.isActive || user.requiresActivation) return false;
    return user.role === 'ADMIN' || user.role === 'KEPALA_SEKOLAH';
  }

  /**
   * Check if a user can delete an incident report (Admin only).
   */
  public static canDelete(user: UserProfile | null | undefined): boolean {
    if (!user || !user.isActive || user.requiresActivation) return false;
    return user.role === 'ADMIN';
  }

  /**
   * Ensures 'LAINNYA' is always present as a stable option without duplicate entries.
   */
  public static getEffectiveCategories(categories: IncidentCategoryRecord[]): IncidentCategoryRecord[] {
    const list = [...categories];
    const hasLainnya = list.some(
      (c) => c.code === 'LAINNYA' || c.name.toLowerCase().includes('lain-lain')
    );
    if (!hasLainnya) {
      list.push({
        id: 'cat-99',
        code: 'LAINNYA',
        name: 'Lain-lain',
        description: 'Kejadian atau insiden khusus lainnya yang belum tercakup dalam pilihan standar.',
        severity: 'SEDANG',
        isActive: true,
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: new Date().toISOString(),
        createdBy: 'SYSTEM',
        updatedAt: new Date().toISOString(),
        updatedBy: 'SYSTEM',
      });
    }
    return list;
  }

  /**
   * Validates incident form input before submission.
   */
  public static validate(record: Partial<IncidentRecord>): {
    isValid: boolean;
    errors: Record<string, string>;
    missing: string[];
  } {
    const errors: Record<string, string> = {};
    const missing: string[] = [];

    if (!record.tanggal) {
      errors.tanggal = 'Tanggal kejadian wajib diisi';
      missing.push('Tanggal');
    }
    if (!record.waktu?.trim()) {
      errors.waktu = 'Waktu kejadian wajib diisi';
      missing.push('Waktu');
    }
    if (!record.lokasi?.trim()) {
      errors.lokasi = 'Lokasi kejadian di sekolah wajib diisi';
      missing.push('Lokasi Kejadian');
    }
    if (!record.pihakTerlibat?.trim()) {
      errors.pihakTerlibat = 'Pihak/siswa yang terlibat wajib diisi';
      missing.push('Pihak Terlibat');
    }
    if (!record.uraian?.trim()) {
      errors.uraian = 'Uraian kronologis kejadian wajib diisi';
      missing.push('Uraian Kejadian');
    }
    if (!record.tindakanAwal?.trim()) {
      errors.tindakanAwal = 'Tindakan awal oleh petugas piket wajib diisi';
      missing.push('Tindakan Awal');
    }

    // Validation for 'LAINNYA' category
    if (record.kategori === 'LAINNYA') {
      const trimmedLainnya = (record.kategoriLainnya || '').trim();
      if (!trimmedLainnya) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya wajib diisi saat memilih kategori Lain-lain';
        missing.push('Keterangan Kategori Lainnya');
      } else if (trimmedLainnya.length > 300) {
        errors.kategoriLainnya = 'Keterangan kategori lainnya tidak boleh melebihi 300 karakter';
      }
    }

    return {
      isValid: missing.length === 0 && Object.keys(errors).length === 0,
      errors,
      missing,
    };
  }
}
