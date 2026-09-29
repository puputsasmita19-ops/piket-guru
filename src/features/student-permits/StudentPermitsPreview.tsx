import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Clock,
  Printer,
  MessageSquare,
  LogIn,
  Trash2,
  Calendar,
  Download,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Award,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { StudentPermitFormModal } from './StudentPermitFormModal';
import { StudentPermitPrintModal } from './StudentPermitPrintModal';
import { StudentPermitRecord, StudentPermitType, StudentPermitStatus } from '../../types/studentPermit.types';
import { TeacherRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { StudentPermitService } from '../../services/firebase/studentPermitService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

export const StudentPermitsPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [typeFilter, setTypeFilter] = useState<string>('SEMUA');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [printPermit, setPrintPermit] = useState<StudentPermitRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StudentPermitRecord | null>(null);

  // WhatsApp Alert Modal
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: '',
  });

  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    StudentPermitService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubPermits = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', (data) => {
      setPermits(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);

    return () => {
      unsubPermits();
      unsubTeachers();
    };
  }, []);

  // Create Permit
  const handleSavePermit = async (data: any) => {
    if (!currentUser) return;
    await StudentPermitService.createPermit(data, currentUser);
  };

  // Mark Student Returned
  const handleMarkReturned = async (permit: StudentPermitRecord) => {
    if (!currentUser) return;
    await StudentPermitService.markReturned(permit.id, currentUser);
  };

  // Delete Permit
  const handleDeletePermit = async () => {
    if (!deleteConfirm || !currentUser) return;
    await StudentPermitService.deletePermit(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
  };

  // Send WhatsApp Alert to Parent
  const handleSendWaToParent = (permit: StudentPermitRecord) => {
    const msg = `*PEMBERITAHUAN IZIN KELUAR SEKOLAH*
*${settings.schoolName}*

Yth. Orang Tua / Wali dari siswa:
👤 *Nama Siswa:* ${permit.namaSiswa}
🎓 *Kelas:* ${permit.kelas}
📅 *Waktu:* ${formatIndonesianDate(permit.tanggal)} (Pukul ${permit.jamKeluar} WIB)
🏷️ *Jenis Izin:* ${permit.jenisIzin.replace('_', ' ')}
📝 *Alasan:* ${permit.alasan}
👥 *Pendamping/Penjemput:* ${permit.namaPenjemput} (${permit.penjemput})

Siswa telah diberikan surat izin resmi oleh Petugas Piket Sekolah (*${permit.petugasPiketName}*).
Demikian informasi ini disampaikan. Terima kasih. 🙏`;

    setWaModalData({
      isOpen: true,
      phone: permit.noHpOrangTua || '',
      message: msg,
      title: `Kirim Notifikasi Izin ke Orang Tua (${permit.namaSiswa})`,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['No Surat', 'Tanggal', 'Jam Keluar', 'Jam Kembali', 'Nama Siswa', 'NISN', 'Kelas', 'Jenis Izin', 'Alasan', 'Penjemput', 'No HP Ortu', 'Guru Mapel', 'Petugas Piket', 'Status'];
    const rows = filteredPermits.map((p) => [
      p.id,
      p.tanggal,
      p.jamKeluar,
      p.jamKembali || '-',
      p.namaSiswa,
      p.nisn,
      p.kelas,
      p.jenisIzin,
      p.alasan,
      `${p.namaPenjemput} (${p.penjemput})`,
      p.noHpOrangTua || '-',
      p.guruPengajarName || '-',
      p.petugasPiketName,
      p.status,
    ]);

    ExportUtils.exportToCsv(`Rekap_Izin_Keluar_Siswa_${Date.now()}`, headers, rows);
  };

  // Metrics
  const todayPermits = permits.filter((p) => p.tanggal === todayISO);
  const activeOutside = permits.filter((p) => p.status === 'SEDANG_KELUAR');
  const sickLeaves = todayPermits.filter((p) => p.jenisIzin === 'SAKIT_PULANG');

  const filteredPermits = permits.filter((p) => {
    const matchStatus = statusFilter === 'SEMUA' || p.status === statusFilter;
    const matchType = typeFilter === 'SEMUA' || p.jenisIzin === typeFilter;
    const matchSearch =
      p.namaSiswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.alasan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.petugasPiketName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Izin Keluar Siswa & Dispensasi Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Penerbitan surat izin gerbang, monitoring siswa keluar, pulangkan siswa sakit, dan notifikasi ortu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Ekspor Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsFormModalOpen(true)}
          >
            + Terbitkan Surat Izin
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Izin Hari Ini</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {todayPermits.length} Siswa
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Surat Diterbitkan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Sedang di Luar</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {activeOutside.length} Siswa
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Belum Kembali</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Pulang Sakit / Rujuk</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {sickLeaves.length} Siswa
            </div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">Observasi UKS / Ortu</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Total Seluruh Arsip</span>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {permits.length} Surat
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Database Izin Siswa</div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa, kelas, alasan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="SEDANG_KELUAR">Sedang di Luar</option>
                <option value="SUDAH_KEMBALI">Sudah Kembali</option>
                <option value="SELESAI_PULANG">Pulang Selesai</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Jenis Izin</option>
                <option value="SAKIT_PULANG">Sakit (Pulang)</option>
                <option value="URUSAN_KELUARGA">Urusan Keluarga</option>
                <option value="DISPENSASI_LOMBA">Dispensasi Lomba</option>
                <option value="KELUAR_SEBENTAR">Keluar Sebentar</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PERMITS TABLE */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-4">Siswa & Kelas</th>
                <th className="p-4">Jenis Izin</th>
                <th className="p-4">Waktu Keluar / Kembali</th>
                <th className="p-4">Alasan & Penjemput</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPermits.length > 0 ? (
                filteredPermits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.namaSiswa}
                      </div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        {item.kelas} {item.nisn !== '-' ? `• NISN: ${item.nisn}` : ''}
                      </div>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={
                          item.jenisIzin === 'SAKIT_PULANG'
                            ? 'danger'
                            : item.jenisIzin === 'DISPENSASI_LOMBA'
                            ? 'success'
                            : item.jenisIzin === 'KELUAR_SEBENTAR'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {item.jenisIzin.replace('_', ' ')}
                      </Badge>
                    </td>

                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>{formatIndonesianDate(item.tanggal)}</div>
                      <div className="text-[11px] text-slate-500">
                        Keluar: <strong>{item.jamKeluar}</strong> {item.jamKembali ? `• Kembali: ${item.jamKembali}` : ''}
                      </div>
                    </td>

                    <td className="p-4 max-w-xs">
                      <p className="text-slate-800 dark:text-slate-200 truncate">
                        "{item.alasan}"
                      </p>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Dijemput: <strong>{item.namaPenjemput}</strong> ({item.penjemput})
                      </div>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={
                          item.status === 'SEDANG_KELUAR'
                            ? 'warning'
                            : item.status === 'SUDAH_KEMBALI'
                            ? 'success'
                            : 'primary'
                        }
                        size="sm"
                      >
                        {item.status === 'SEDANG_KELUAR'
                          ? 'Sedang di Luar'
                          : item.status === 'SUDAH_KEMBALI'
                          ? 'Sudah Kembali'
                          : 'Pulang Selesai'}
                      </Badge>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Notify Parent WA */}
                        <button
                          type="button"
                          onClick={() => handleSendWaToParent(item)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                          title="Kirim Notifikasi WA ke Orang Tua Siswa"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Print Gate Pass */}
                        <button
                          type="button"
                          onClick={() => setPrintPermit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Cetak Surat Izin Gerbang"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Check-In Return */}
                        {item.status === 'SEDANG_KELUAR' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            leftIcon={<LogIn className="w-3.5 h-3.5" />}
                            onClick={() => handleMarkReturned(item)}
                          >
                            Tiba Kembali
                          </Button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 text-xs">
                    Belum ada data izin keluar siswa untuk filter terpilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* PERMIT FORM MODAL */}
      <StudentPermitFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSavePermit}
        teachers={teachers}
      />

      {/* PRINT GATE PASS MODAL */}
      <StudentPermitPrintModal
        isOpen={!!printPermit}
        onClose={() => setPrintPermit(null)}
        permit={printPermit}
        settings={settings}
      />

      {/* WHATSAPP MODAL */}
      <WhatsAppModal
        isOpen={waModalData.isOpen}
        onClose={() => setWaModalData({ ...waModalData, isOpen: false })}
        title={waModalData.title}
        defaultPhone={waModalData.phone}
        defaultMessage={waModalData.message}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Surat Izin Siswa"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Catatan Izin Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Siswa: <strong>{deleteConfirm?.namaSiswa}</strong> ({deleteConfirm?.kelas})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeletePermit}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
