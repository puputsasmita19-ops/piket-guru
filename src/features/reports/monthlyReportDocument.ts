import type { TeacherAttendanceSummary, IncidentCategorySummary } from '../../services/reports/reportService';
import type { OperationalReport, ReportSection } from '../../utils/operationalReport';
import { type StudentTardyRecord, getTardyReasonDisplay, getDisciplineActionDisplay } from '../../types/studentTardy.types';
import { type StudentPermitRecord, getStudentPermitTypeDisplay } from '../../types/studentPermit.types';
import { type TeacherSubstitutionRecord, getSubstitutionReasonDisplay } from '../../types/substitution.types';
import { type VisitorRecord, getVisitorCategoryDisplay } from '../../types/visitor.types';
import { type DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';

export interface MonthlyReportInput {
  periodLabel: string; attendanceSummaries: TeacherAttendanceSummary[]; incidentSummaries: IncidentCategorySummary[];
  totalIncidents: number; resolvedIncidents: number; tardyRecords?: StudentTardyRecord[]; permitRecords?: StudentPermitRecord[];
  substitutionRecords?: TeacherSubstitutionRecord[]; visitorRecords?: VisitorRecord[]; dutyBookRecords?: DutyBookRecord[];
}
export function monthlyReportDocument(input: MonthlyReportInput): OperationalReport {
  const tardy = input.tardyRecords || [], permits = input.permitRecords || [], subs = input.substitutionRecords || [], visitors = input.visitorRecords || [], books = input.dutyBookRecords || [];
  const average = input.attendanceSummaries.length ? Math.round(input.attendanceSummaries.reduce((a, s) => a + s.percentage, 0) / input.attendanceSummaries.length) : 100;
  const sections: ReportSection[] = [
    { title: 'A. Rekapitulasi Presensi dan Kedisiplinan Guru Piket', headers: ['Nama Guru / Petugas', 'NIP', 'Total Shift', 'Hadir GPS', 'Luar Radius', 'Kehadiran'], rows: input.attendanceSummaries.map(r => [r.fullName, r.nip || '-', r.totalShift, r.hadir, r.terlambatOrOutside, `${r.percentage}%`]) },
    { title: 'B. Rekapitulasi Laporan Kejadian dan Penanganan Kasus', headers: ['Kategori Kejadian', 'Total Kasus', 'Kritis / Tinggi', 'Tuntas', 'Dalam Proses'], rows: input.incidentSummaries.map(r => [r.categoryName, r.total, r.kritis, r.selesai, r.penanganan]) },
    { title: 'C. Rekapitulasi Keterlambatan Siswa', headers: ['Siswa / Kelas', 'Tanggal / Jam', 'Terlambat', 'Alasan', 'Pembinaan / Poin'], rows: tardy.map(r => [`${r.namaSiswa}\n${r.kelas}`, `${r.tanggal}\n${r.jamDatang}`, `${r.menitTerlambat} menit`, getTardyReasonDisplay(r), `${getDisciplineActionDisplay(r)}\nPoin: ${r.poinPelanggaran}`]) },
    { title: 'D. Rekapitulasi Perizinan Meninggalkan Sekolah', headers: ['Siswa / Kelas', 'Tanggal / Keluar', 'Jenis Izin', 'Alasan / Penjemput', 'Status'], rows: permits.map(r => [`${r.namaSiswa}\n${r.kelas}`, `${r.tanggal}\n${r.jamKeluar}`, getStudentPermitTypeDisplay(r), `${r.alasan}\nPenjemput: ${r.penjemput}`, r.status.replace(/_/g, ' ')]) },
    { title: 'E. Rekapitulasi Guru Pengganti', headers: ['Guru Berhalangan', 'Pelajaran / Kelas', 'Jam Pelajaran', 'Guru Pengganti', 'Alasan / Status'], rows: subs.map(r => [r.guruBerhalanganName, `${r.mataPelajaran}\n${r.kelas}`, r.jamPelajaran, r.guruPenggantiName || 'Belum ditugaskan', `${getSubstitutionReasonDisplay(r)}\n${r.status.replace(/_/g, ' ')}`]) },
    { title: 'F. Rekapitulasi Kunjungan Tamu Sekolah', headers: ['Tamu / Instansi', 'Kategori', 'Tujuan / Keperluan', 'Tanggal / Masuk', 'Status'], rows: visitors.map(r => [`${r.namaTamu}\n${r.instansiAsal}`, getVisitorCategoryDisplay(r), `${r.tujuanBertemu}\n${r.keperluan}`, `${r.tanggal}\n${r.jamMasuk}`, r.status.replace(/_/g, ' ')]) },
  ];
  if (books.length) sections.push({ title: 'G. Rekapitulasi Jurnal Buku Piket', headers: ['Tanggal', 'Petugas / Pos', 'Catatan Kondisi Sekolah', 'Status'], rows: books.map(r => [r.tanggal, `${r.petugasName}\n${r.ruangName}`, r.catatanPiket || '-', getDutyBookDisplayStatus(r.status).label]) });
  return { title: 'Laporan Rekapitulasi Pelaksanaan Tugas Piket dan Ketertiban Sekolah', period: input.periodLabel, headers: [], rows: [], sections,
    summary: [{ label: 'Kepatuhan Guru Piket', value: `${average}%` }, { label: 'Insiden / Kasus', value: `${input.totalIncidents} kasus (${input.resolvedIncidents} tuntas)` }, { label: 'Keterlambatan Siswa', value: `${tardy.length} catatan` }, { label: 'Izin Keluar Siswa', value: `${permits.length} catatan` }, { label: 'Guru Pengganti', value: `${subs.length} penugasan` }, { label: 'Buku Tamu', value: `${visitors.length} kunjungan` }] };
}
