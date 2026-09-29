import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Search,
  Filter,
  Printer,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Download,
  AlertTriangle,
  GraduationCap,
  ShieldAlert,
  LogIn,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { StudentTardyFormModal } from './StudentTardyFormModal';
import { StudentTardyAdmitPrintModal } from './StudentTardyAdmitPrintModal';
import { StudentTardyRecord, TardyStatus, TardyReason } from '../../types/studentTardy.types';
import { SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { StudentTardyService } from '../../services/firebase/studentTardyService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const StudentTardyPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  const [tardyList, setTardyList] = useState<StudentTardyRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [reasonFilter, setReasonFilter] = useState<string>('SEMUA');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [printTardy, setPrintTardy] = useState<StudentTardyRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StudentTardyRecord | null>(null);

  // WhatsApp Modal
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
    StudentTardyService.bootstrapIfEmpty();

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubTardy = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', (data) => {
      setTardyList(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => unsubTardy();
  }, []);

  // Register Tardy Student
  const handleSaveTardy = async (data: any) => {
    if (!currentUser) return;
    await StudentTardyService.registerTardyStudent(data, currentUser);
  };

  // Complete Discipline & Admit to Class
  const handleAdmitToClass = async (tardy: StudentTardyRecord) => {
    if (!currentUser) return;
    await StudentTardyService.admitToClass(tardy.id, currentUser);
  };

  // Delete Tardy Record
  const handleDeleteTardy = async () => {
    if (!deleteConfirm || !currentUser) return;
    await StudentTardyService.deleteTardyRecord(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
  };

  // Send WhatsApp Alert to Parent
  const handleSendWaToParent = (tardy: StudentTardyRecord) => {
    const msg = `*PEMBERITAHUAN KETERLAMBATAN SISWA*
*${settings.schoolName}*

Yth. Orang Tua / Wali dari siswa:
👤 *Nama Siswa:* ${tardy.namaSiswa}
🎓 *Kelas:* ${tardy.kelas}
📅 *Waktu Tiba:* ${formatIndonesianDate(tardy.tanggal)} (Pukul ${tardy.jamDatang} WIB)
⏱️ *Selisih Keterlambatan:* ${tardy.menitTerlambat} Menit (Batas Bel: 07.00 WIB)
📝 *Alasan:* ${tardy.alasan.replace('_', ' ')}
🧹 *Pembinaan Karakter:* ${tardy.pembinaan.replace('_', ' ')}
⚠️ *Keterlambatan Bulan Ini:* Ke-${tardy.frekuensiBulanIni} kali (+${tardy.poinPelanggaran} Poin)

${tardy.frekuensiBulanIni >= 3 ? '⚠️ *CATATAN PENTING:* Siswa telah terlambat 3x atau lebih bulan ini. Mohon perhatian Bapak/Ibu atau menghadiri koordinasi ke sekolah.' : 'Siswa saat ini telah selesai mengikuti pembinaan piket dan dipersilakan mengikuti pembelajaran di kelas.'}

Petugas Piket: *${tardy.petugasPiketName}*
Terima kasih atas kerja sama dan bimbingannya di rumah. 🙏`;

    setWaModalData({
      isOpen: true,
      phone: tardy.noHpOrangTua || '',
      message: msg,
      title: `Kirim Notifikasi Keterlambatan (${tardy.namaSiswa})`,
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Tanggal', 'Jam Datang', 'Terlambat (Menit)', 'Nama Siswa', 'NISN', 'Kelas', 'Alasan', 'Pembinaan', 'Poin', 'Frekuensi Bulan Ini', 'No HP Ortu', 'Status', 'Petugas Piket'];
    const rows = filteredTardy.map((t) => [
      t.tanggal,
      t.jamDatang,
      t.menitTerlambat,
      t.namaSiswa,
      t.nisn,
      t.kelas,
      t.alasan,
      t.pembinaan,
      t.poinPelanggaran,
      t.frekuensiBulanIni,
      t.noHpOrangTua || '-',
      t.status,
      t.petugasPiketName,
    ]);

    ExportUtils.exportToCsv(`Rekap_Siswa_Terlambat_${Date.now()}`, headers, rows);
  };

  // Metrics
  const todayTardy = tardyList.filter((t) => t.tanggal === todayISO);
  const inDiscipline = todayTardy.filter((t) => t.status === 'DALAM_PEMBINAAN');
  const admittedToday = todayTardy.filter((t) => t.status === 'SELESAI_MASUK_KELAS');
  const chronicTardy = todayTardy.filter((t) => t.frekuensiBulanIni >= 3 || t.status === 'PEMANGGILAN_ORTU');

  const filteredTardy = tardyList.filter((t) => {
    const matchStatus = statusFilter === 'SEMUA' || t.status === statusFilter;
    const matchReason = reasonFilter === 'SEMUA' || t.alasan === reasonFilter;
    const matchSearch =
      t.namaSiswa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.petugasPiketName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchReason && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Buku Siswa Terlambat & Pembinaan Disiplin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pencatatan keterlambatan gerbang pagi, pembinaan karakter, sistem poin, dan slip izin masuk kelas
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
            + Catat Siswa Terlambat
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Terlambat Hari Ini</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {todayTardy.length} Siswa
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Gerbang Pagi</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Dalam Pembinaan</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {inDiscipline.length} Siswa
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Literasi / Kebersihan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Izin Masuk Kelas</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {admittedToday.length} Siswa
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Tuntas Pembinaan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Keterlambatan Kritis (≥3x)</span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {chronicTardy.length} Siswa
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-1">Panggilan Ortu / BK</div>
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
                placeholder="Cari nama siswa, kelas, petugas..."
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
                <option value="DALAM_PEMBINAAN">Dalam Pembinaan</option>
                <option value="SELESAI_MASUK_KELAS">Selesai (Masuk Kelas)</option>
                <option value="PEMANGGILAN_ORTU">Panggilan Ortu</option>
              </select>

              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Alasan</option>
                <option value="BANGUN_KESIANGAN">Bangun Kesiangan</option>
                <option value="MACET_LALULINTAS">Macet Lalu Lintas</option>
                <option value="KENDARAAN_MOGOK">Kendaraan Mogok</option>
                <option value="HUJAN_LEBAT">Hujan Lebat</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TARDY TABLE */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-4">Siswa & Kelas</th>
                <th className="p-4">Waktu & Durasi</th>
                <th className="p-4">Alasan & Pembinaan</th>
                <th className="p-4">Frekuensi & Poin</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTardy.length > 0 ? (
                filteredTardy.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.namaSiswa}
                      </div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        {item.kelas} {item.nisn !== '-' ? `• NISN: ${item.nisn}` : ''}
                      </div>
                    </td>

                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>{formatIndonesianDate(item.tanggal)}</div>
                      <div className="text-[11px] text-rose-600 font-bold">
                        {item.jamDatang} WIB (+{item.menitTerlambat} menit)
                      </div>
                    </td>

                    <td className="p-4 max-w-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.alasan.replace('_', ' ')}
                      </div>
                      <p className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                        Pembinaan: {item.pembinaan.replace('_', ' ')}
                      </p>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${
                        item.frekuensiBulanIni >= 3
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        Ke-{item.frekuensiBulanIni} ({item.poinPelanggaran} Poin)
                      </span>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={
                          item.status === 'SELESAI_MASUK_KELAS'
                            ? 'success'
                            : item.status === 'PEMANGGILAN_ORTU'
                            ? 'danger'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {item.status === 'SELESAI_MASUK_KELAS'
                          ? 'Izin Masuk Kelas'
                          : item.status === 'PEMANGGILAN_ORTU'
                          ? 'Panggilan Ortu'
                          : 'Dalam Pembinaan'}
                      </Badge>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Notify Parent WA */}
                        <button
                          type="button"
                          onClick={() => handleSendWaToParent(item)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                          title="Kirim Notifikasi WA ke Orang Tua"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Print Admit Slip */}
                        <button
                          type="button"
                          onClick={() => setPrintTardy(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Cetak Slip Izin Masuk Kelas"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Complete Discipline & Admit to Class */}
                        {item.status === 'DALAM_PEMBINAAN' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            onClick={() => handleAdmitToClass(item)}
                          >
                            Masuk Kelas
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
                    Tidak ada catatan siswa terlambat untuk filter terpilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* FORM MODAL */}
      <StudentTardyFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveTardy}
      />

      {/* ADMIT PRINT MODAL */}
      <StudentTardyAdmitPrintModal
        isOpen={!!printTardy}
        onClose={() => setPrintTardy(null)}
        tardy={printTardy}
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
        title="Hapus Catatan Keterlambatan"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Data Keterlambatan Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Siswa: <strong>{deleteConfirm?.namaSiswa}</strong> ({deleteConfirm?.kelas})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteTardy}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
