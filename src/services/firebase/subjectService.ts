import { FirestoreService } from './firestoreService';
import { createAuthenticatedSession } from './sessionGuard';
import type { UserProfile } from '../../types';
import { isSubjectCatalog, MAX_SUBJECTS, subjectKey, type SubjectCatalog, type SubjectRecord } from '../../types/subject.types';

export type SubjectInput = Omit<SubjectRecord, 'updatedAt' | 'updatedBy'>;
export class SubjectService {
  private static async change(input: SubjectInput | null, id: string, revision: string | null, user: UserProfile) {
    if (user.role !== 'ADMIN') throw new Error('Hanya admin yang dapat mengelola master mata pelajaran.');
    const session = createAuthenticatedSession(user.id);
    try {
      const existing = await FirestoreService.getByIdStrict<SubjectCatalog>('subjects', 'catalog');
      session.assertActive();
      if (existing && !isSubjectCatalog(existing)) throw new Error('Format master mata pelajaran perlu diperiksa admin atau dipulihkan dari cadangan yang benar.');
      const old = existing?.entries.find(row => row.id === id);
      if ((old?.updatedAt || null) !== revision) throw new Error('Mata pelajaran telah berubah. Buka kembali data terbaru sebelum menyimpan.');
      if (!input && !old) throw new Error('Mata pelajaran tidak ditemukan.');
      const entries = (existing?.entries || []).filter(row => row.id !== id);
      let next: SubjectRecord | null = null;
      if (input) {
        const name = input.name.trim().replace(/\s+/g, ' '), code = input.code.trim().toUpperCase();
        if (!id || id.length > 100 || !name || name.length > 120 || code.length > 30 || input.notes.length > 240 || typeof input.isActive !== 'boolean') throw new Error('Periksa nama (maks. 120 karakter), kode (30), dan keterangan (240) mata pelajaran.');
        if (entries.some(row => subjectKey(row.name) === subjectKey(name))) throw new Error('Nama mata pelajaran sudah ada, termasuk pada daftar nonaktif. Edit atau aktifkan kembali data tersebut.');
        if (code && entries.some(row => subjectKey(row.code) === subjectKey(code))) throw new Error('Kode mata pelajaran sudah digunakan. Gunakan kode lain.');
        next = { id, name, code, notes: input.notes.trim(), isActive: input.isActive, updatedAt: FirestoreService.nextUpdatedAt(old), updatedBy: user.fullName };
        entries.push(next);
      }
      if (entries.length > MAX_SUBJECTS) throw new Error(`Master dibatasi ${MAX_SUBJECTS} mata pelajaran. Hapus yang tidak digunakan sebelum menambah.`);
      const payload: SubjectCatalog = { id: 'catalog', entries, updatedAt: FirestoreService.nextUpdatedAt(existing), updatedBy: user.fullName };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 700_000) throw new Error('Master mata pelajaran terlalu besar. Ringkas keterangan atau hapus data yang tidak digunakan.');
      session.assertActive();
      await FirestoreService.setDocumentWithAudit('subjects', 'catalog', payload, { userId: user.id, userName: user.fullName, role: user.role, action: !input ? 'DELETE' : old ? 'UPDATE' : 'CREATE', module: 'SUBJECTS', recordId: id, details: `${!input ? 'Menghapus' : old ? 'Memperbarui' : 'Menambah'} mata pelajaran ${(next || old)!.name}.` }, { controlledReplace: true, expectedState: existing });
      return next;
    } finally { session.close(); }
  }
  public static save(input: SubjectInput, user: UserProfile, revision: string | null = null) { return this.change(input, input.id, revision, user); }
  public static remove(entry: SubjectRecord, user: UserProfile) { return this.change(null, entry.id, entry.updatedAt, user); }
}
