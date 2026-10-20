import { getSubstitutionReasonDisplay, type TeacherSubstitutionRecord, type SubstitutionStatus } from '../../types/substitution.types';

const STATUSES: Record<SubstitutionStatus, { label: string; priority: number }> = {
  MENUNGGU_GURU_INVAL: { label: 'Menunggu pengganti', priority: 0 },
  SEDANG_BERLANGSUNG: { label: 'Sedang berlangsung', priority: 1 },
  TERTUGASKAN: { label: 'Tertugaskan', priority: 2 },
  SELESAI_INVAL: { label: 'Selesai', priority: 3 },
};
const text = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

/** Reuse today's dashboard records. Preview priority never changes business status. */
export function buildSubstitutionFlashSummary(records: TeacherSubstitutionRecord[], date: string) {
  const rows = [...new Map(records.filter(row => row.tanggal === date).map(row => [row.id, row])).values()];
  rows.sort((a, b) =>
    (STATUSES[a.status]?.priority ?? 4) - (STATUSES[b.status]?.priority ?? 4) ||
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '') ||
    a.id.localeCompare(b.id));
  const teachers = new Set(rows.map(row => text(row.guruBerhalanganId)
    ? `id:${text(row.guruBerhalanganId)}`
    : `name:${text(row.guruBerhalanganName).toLocaleLowerCase('id-ID')}`).filter(key => key !== 'name:'));
  return {
    teacherCount: teachers.size,
    taskCount: rows.length,
    pendingCount: rows.filter(row => row.status === 'MENUNGGU_GURU_INVAL').length,
    items: rows.map(row => ({
      id: row.id,
      title: `${text(row.guruBerhalanganName) || 'Guru belum tercatat'} · ${text(row.kelas) || 'Kelas belum diisi'}`,
      // Struktur yang sama dengan TV Lobi: identitas guru berhalangan + keterangan,
      // dan identitas guru pengganti + tindak lanjut/tugas kelas.
      absentTeacher: text(row.guruBerhalanganName) || 'Guru belum tercatat',
      subjectAndClass: [text(row.mataPelajaran), text(row.kelas)].filter(Boolean).join(' · ') || 'Mapel / kelas belum diisi',
      lessonPeriod: text(row.jamPelajaran) || 'Jam pelajaran belum diisi',
      reason: text(getSubstitutionReasonDisplay(row)) === '-' ? 'Belum dicatat' : text(getSubstitutionReasonDisplay(row)),
      replacementTeacher: text(row.guruPenggantiName) || (row.guruPenggantiId ? 'Nama belum tercatat' : 'Sedang dikoordinasikan'),
      assignmentStatus: STATUSES[row.status]?.label || 'Status belum dikenali',
      task: text(row.materiDanTugasSiswa) || 'Belum ada tindak lanjut atau tugas kelas yang dicatat.',
    })),
  };
}
