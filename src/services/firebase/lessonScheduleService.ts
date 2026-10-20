import { FirestoreService } from './firestoreService';
import { createAuthenticatedSession } from './sessionGuard';
import type { DayOfWeek, SchoolSettings, UserProfile } from '../../types';
import type { TeacherRecord } from '../../types/master.types';
import { ALL_DAYS_OF_WEEK } from '../../types/period.types';
import { getTeachingPeriods, isLessonScheduleDay, lessonConflict, MAX_LESSONS_PER_DAY, type LessonScheduleDay, type LessonScheduleEntry } from '../../types/lessonSchedule.types';

export type LessonScheduleInput = Omit<LessonScheduleEntry, 'teacherName' | 'updatedAt' | 'updatedBy'>;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

export class LessonScheduleService {
  private static async change(day: DayOfWeek, input: LessonScheduleInput | null, entryId: string, expectedRevision: string | null, user: UserProfile) {
    if (user.role !== 'ADMIN') throw new Error('Hanya admin yang dapat mengelola master jadwal pelajaran.');
    const session = createAuthenticatedSession(user.id);
    try {
      if (!ALL_DAYS_OF_WEEK.some(d => d.code === day)) throw new Error('Hari jadwal tidak valid.');
      const existing = await FirestoreService.getByIdStrict<LessonScheduleDay>('lessonSchedules', day);
      session.assertActive();
      if (existing && !isLessonScheduleDay(existing)) throw new Error('Format master jadwal tidak valid. Periksa data atau pulihkan cadangan jadwal yang benar.');
      const previous = existing?.entries.find(e => e.id === entryId);
      if ((previous?.updatedAt || null) !== expectedRevision) throw new Error('Jadwal telah berubah. Tutup formulir dan buka data terbaru sebelum menyimpan.');
      if (!input && !previous) throw new Error('Jadwal tidak ditemukan.');
      let next: LessonScheduleEntry | null = null;
      if (input) {
        if (!input.id || input.id !== entryId || input.id.length > 100) throw new Error('Identitas jadwal tidak valid.');
        if (!validDate(input.validFrom) || (input.validUntil && (!validDate(input.validUntil) || input.validUntil < input.validFrom))) throw new Error('Periksa tanggal mulai dan akhir berlaku jadwal.');
        if (!input.subject.trim() || input.subject.trim().length > 120 || !input.className.trim() || input.className.trim().length > 80 || input.notes.length > 240) throw new Error('Mata pelajaran dan kelas wajib diisi; periksa juga panjang keterangannya.');
        const teacher = await FirestoreService.getByIdStrict<TeacherRecord>('teachers', input.teacherId);
        session.assertActive();
        if (!teacher?.fullName) throw new Error('Guru tidak lagi ditemukan pada master guru. Pilih guru yang tersedia.');
        const settings = await FirestoreService.getByIdStrict<SchoolSettings>('settings', 'school_config');
        session.assertActive();
        const numbers = [...new Set(input.periodNumbers)].sort((a, b) => a - b);
        if (!numbers.length || numbers.some(n => !Number.isInteger(n) || n < 1)) throw new Error('Pilih minimal satu nomor JP yang valid.');
        const allowed = new Set(getTeachingPeriods(settings?.lessonPeriodConfig, day, input.validFrom).map(p => p.periodNumber));
        // Deactivating an old schedule remains possible after the school's JP changes.
        if (input.isActive && numbers.some(n => !allowed.has(n))) throw new Error('JP belum tersedia pada hari/tanggal berlaku ini. Periksa Pengaturan Sekolah → Jam Pelajaran.');
        next = { id: entryId, teacherId: teacher.id, teacherName: teacher.fullName.slice(0, 160), subject: input.subject.trim(), className: input.className.trim(), periodNumbers: numbers, validFrom: input.validFrom, validUntil: input.validUntil, isActive: input.isActive, notes: input.notes.trim(), updatedAt: FirestoreService.nextUpdatedAt(previous), updatedBy: user.fullName };
        const conflict = lessonConflict(next, existing?.entries || []);
        if (conflict) throw new Error(conflict);
      }
      const entries = (existing?.entries || []).filter(e => e.id !== entryId);
      if (next) entries.push(next);
      if (entries.length > MAX_LESSONS_PER_DAY) throw new Error(`Maksimal ${MAX_LESSONS_PER_DAY} rincian per hari. Hapus jadwal yang tidak dipakai sebelum menambah.`);
      const payload: LessonScheduleDay = { id: day, entries, updatedAt: FirestoreService.nextUpdatedAt(existing), updatedBy: user.fullName };
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 700_000) throw new Error('Ukuran jadwal hari ini terlalu besar. Ringkas keterangan atau hapus jadwal yang tidak dipakai.');
      session.assertActive();
      await FirestoreService.setDocumentWithAudit('lessonSchedules', day, payload, {
        userId: user.id, userName: user.fullName, role: user.role, action: !input ? 'DELETE' : previous ? 'UPDATE' : 'CREATE', module: 'LESSON_SCHEDULES', recordId: entryId,
        details: `${!input ? 'Menghapus' : previous ? 'Memperbarui' : 'Menambah'} jadwal pelajaran ${day}: ${(next || previous)!.teacherName}, ${(next || previous)!.subject}, kelas ${(next || previous)!.className}.`,
      }, { expectedState: existing, controlledReplace: true });
      return next;
    } finally { session.close(); }
  }
  public static save(day: DayOfWeek, input: LessonScheduleInput, user: UserProfile, expectedRevision: string | null = null) {
    return this.change(day, input, input.id, expectedRevision, user);
  }
  public static remove(day: DayOfWeek, entry: LessonScheduleEntry, user: UserProfile) {
    return this.change(day, null, entry.id, entry.updatedAt, user);
  }
}
