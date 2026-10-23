import { useHistoryPeriod, useHistoryPagination } from '../../hooks/useHistoryPeriod';
import { useOperationalSchoolSettings } from '../../hooks/useOperationalSchoolSettings';
import { HistoryControls, HistoryPagination, HistoryTable, useHistoryView } from '../../components/common/HistoryControls';
import { OperationalExport } from '../../components/common/OperationalExport';
import type { OperationalReport } from '../../utils/operationalReport';
import { Phone } from '../../components/icons';
import { MapPin } from '../../components/icons';
import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Clock,
  Building,
  Printer,
  MessageSquare,
  LogOut,
  Trash2,
  Calendar,
  Download,
  CheckCircle2,
  Tag,
  CreditCard,
  Edit2,
  Image,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { VisitorFormModal } from './VisitorFormModal';
import { VisitorSelfCheckinPanel } from './VisitorSelfCheckinPanel';
import { VisitorPassPrintModal } from './VisitorPassPrintModal';
import {
  VisitorRecord,
  VisitorStatus,
  VisitorCategory,
  getVisitorCategoryDisplay,
} from '../../types/visitor.types';
import { TeacherRecord, StaffRecord } from '../../types/master.types';
import { SchoolSettings, UserProfile } from '../../types';
import { where, limit } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { VisitorService } from '../../services/firebase/visitorService';
import { mayEditOwnRecord } from '../../utils/recordOwnership';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

export const VisitorPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN', 'KEPALA_SEKOLAH');
  const canEdit = Boolean(
    currentUser?.role &&
      ['ADMIN', 'SUPER_ADMIN', 'PETUGAS_PIKET', 'GURU', 'STAFF', 'KEPALA_SEKOLAH'].includes(currentUser.role)
  );

  const canEditRecord = (record: VisitorRecord) => mayEditOwnRecord(currentUser, record as unknown as Record<string, unknown>, 'petugasPiketId');
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const settings = useOperationalSchoolSettings();
  const history = useHistoryPeriod(settings);
  const [viewMode, setViewMode] = useHistoryView();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [categoryFilter, setCategoryFilter] = useState<string>('SEMUA');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<VisitorRecord | null>(null);
  const [showSelfCheckin, setShowSelfCheckin] = useState(false);
  const [registrationFeedback, setRegistrationFeedback] = useState('');
  const [printVisitor, setPrintVisitor] = useState<VisitorRecord | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<VisitorRecord | null>(null);
  const [photoVisitor, setPhotoVisitor] = useState<VisitorRecord | null>(null);

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

  const todayISO = history.today;

  useEffect(() => {
    VisitorService.bootstrapIfEmpty();


    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', setTeachers);
    const unsubStaff = FirestoreService.subscribeToCollection<StaffRecord>('staff', setStaffList);
    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', setUsersList);

    return () => {
      unsubTeachers();
      unsubStaff();
      unsubUsers();
    };
  }, []);

  // Server query always keeps the selected date bounds; invalid ranges never query.
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    setVisitors([]); setHistoryError('');
    if (history.range.error) return;
    return FirestoreService.subscribeToCollection<VisitorRecord>('visitors', data => {
      setVisitors([...data].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    }, error => setHistoryError(error.message || 'Riwayat belum dapat dimuat.'), history.constraints, { cacheKey: history.key });
  }, [history.constraints, history.range.error]);

  // Create or Update Visitor
  const handleSaveVisitor = async (data: any, isEdit?: boolean) => {
    if (!currentUser) return;
    if (isEdit && data.id) {
      await VisitorService.updateVisitor(data, currentUser);
    } else {
      const saved = await VisitorService.registerVisitor(data, currentUser);
      const count = Array.isArray(data.namaRombongan) ? data.namaRombongan.length : 1;
      setRegistrationFeedback(`${count} tamu berhasil didaftarkan. Nomor badge dimulai dari ${saved.nomorBadge}.`);
    }
  };

  // Check-Out Visitor
  const handleCheckoutVisitor = async (visitor: VisitorRecord) => {
    if (!currentUser) return;
    await VisitorService.checkoutVisitor(visitor.id, currentUser);
  };

  // Delete Visitor
  const handleDeleteVisitor = async () => {
    if (!deleteConfirm || !currentUser) return;
    await VisitorService.deleteVisitor(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
  };

  // Trigger WhatsApp Notice to Host Teacher
  const handleSendWaToHost = (visitor: VisitorRecord) => {
    const hostTeacher = teachers.find((t) => visitor.tujuanBertemu.includes(t.fullName.split(' ')[0]));
    const msg = `*PEMBERITAHUAN TAMU DI POS PIKET*
Halo Bapak/Ibu *${visitor.tujuanBertemu}*,

Diinformasikan bahwa tamu Anda telah tiba di Pos Piket *${settings.schoolName}*:
👤 *Nama Tamu:* ${visitor.namaTamu}
🏢 *Instansi:* ${visitor.instansiAsal}
🏷️ *Kategori:* ${getVisitorCategoryDisplay(visitor)}
⏰ *Waktu Tiba:* ${visitor.jamMasuk} WIB
🔖 *No. Badge:* ${visitor.nomorBadge}
📝 *Keperluan:* ${visitor.keperluan}

Tamu saat ini sedang menunggu di ruang tamu / pos piket sekolah. Terima kasih. 🙏`;

    setWaModalData({
      isOpen: true,
      phone: hostTeacher?.phone || visitor.noHp || '',
      message: msg,
      title: `Kirim Notifikasi Tamu ke ${visitor.tujuanBertemu}`,
    });
  };

  // Export all records matching the active filters
  const buildReport = (): OperationalReport => ({ title: 'Rekap Buku Tamu Digital', period: history.range.label + (searchQuery ? ' · Pencarian: ' + searchQuery : ''), headers: ['Tanggal / Waktu', 'Tamu / Instansi', 'Kategori / Badge', 'Tujuan', 'Keperluan', 'Status / Petugas'], rows: filteredVisitors.map(v => [v.tanggal + '\nMasuk: ' + v.jamMasuk + '\nKeluar: ' + (v.jamKeluar || '-'), v.namaTamu + '\n' + v.instansiAsal, getVisitorCategoryDisplay(v) + '\n' + v.nomorBadge, v.tujuanBertemu, v.keperluan, v.status.replace(/_/g, ' ') + '\n' + v.petugasPiketName]) });

  // Metrics
  const todayVisitors = visitors.filter((v) => v.tanggal === todayISO);
  const activeVisitors = visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG');
  const completedToday = todayVisitors.filter((v) => v.status === 'SELESAI');

  const filteredVisitors = visitors.filter((v) => {
    const matchStatus = statusFilter === 'SEMUA' || v.status === statusFilter;
    const matchCat = categoryFilter === 'SEMUA' || v.kategori === categoryFilter;
    const q = searchQuery.toLowerCase();
    const catLabel = getVisitorCategoryDisplay(v).toLowerCase();
    const matchSearch =
      v.namaTamu.toLowerCase().includes(q) ||
      v.instansiAsal.toLowerCase().includes(q) ||
      v.tujuanBertemu.toLowerCase().includes(q) ||
      v.nomorBadge.toLowerCase().includes(q) ||
      v.keperluan.toLowerCase().includes(q) ||
      (v.keteranganLainnya && v.keteranganLainnya.toLowerCase().includes(q)) ||
      catLabel.includes(q) ||
      (v.noHp && v.noHp.includes(q)) ||
      (v.petugasPiketName && v.petugasPiketName.toLowerCase().includes(q));

    return !history.range.error && v.tanggal >= history.range.start && v.tanggal <= history.range.end && matchStatus && matchCat && matchSearch;
  });

  const historyPage = useHistoryPagination(filteredVisitors, [history.key, searchQuery, statusFilter, categoryFilter].join('|'));

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Buku Tamu
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Catat tamu masuk, tujuan kunjungan, dan waktu pulang.</p>
        </div>

        <div className="page-actions flex flex-wrap items-center gap-2">
          <OperationalExport report={buildReport()} settings={settings} disabled={Boolean(history.range.error)} />
          {canEdit && <Button variant="outline" size="sm" onClick={() => setShowSelfCheckin(true)}>QR Tamu Mandiri & Verifikasi</Button>}
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingVisitor(null);
                setIsFormModalOpen(true);
              }}
            >
              Catat Tamu Masuk
            </Button>
          )}
        </div>
      </div>

      {registrationFeedback && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-3 text-xs font-semibold">{registrationFeedback}</div>}

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Tamu Hari Ini</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {todayVisitors.length} Tamu
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Kunjungan Terdata</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Sedang di Sekolah</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {activeVisitors.length} Tamu
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Belum Check-Out</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Selesai Berkunjung</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {completedToday.length} Tamu
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Sudah Check-Out</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Total Periode Dipilih</span>
            <div className="text-xl font-bold text-purple-600 mt-1">
              {visitors.length} Tamu
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Database Buku Tamu</div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTER BAR */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama tamu, instansi, guru, badge, atau keperluan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="app-filter-group flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">

              <label className="app-filter-field"><span>Status</span><select aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="SEDANG_BERKUNJUNG">Sedang Berkunjung (Aktif)</option>
                <option value="SELESAI">Selesai (Sudah Keluar)</option>
              </select></label>

              <label className="app-filter-field"><span>Kategori</span><select aria-label="Kategori"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Kategori</option>
                <option value="DINAS_INSTANSI">Dinas / Instansi</option>
                <option value="ORANG_TUA">Orang Tua Siswa</option>
                <option value="VENDOR_MITRA">Mitra / Vendor</option>
                <option value="ALUMNI">Alumni</option>
                <option value="UMUM">Tamu Umum</option>
                <option value="LAINNYA">Lain-lain</option>
              </select></label>
            </div>
          </div>
        </CardContent>
      </Card>

      <HistoryControls history={history} view={viewMode} onViewChange={setViewMode} />
      {historyError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{historyError}</p>}

      {/* VISITORS LIST: RESPONSIVE MOBILE CARDS & DESKTOP TABLE */}
      {/* Mobile Card List (Hidden on tablet/desktop) */}
      <div className={viewMode === 'grid' ? 'history-card-grid' : 'hidden'}>
        {filteredVisitors.length > 0 ? (
          historyPage.records.map((item) => (
            <Card key={item.id} className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <CardContent className="p-3.5 sm:p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.fotoUrl ? <AuthenticatedImage src={item.fotoUrl} loading="lazy" decoding="async" alt={`Foto ${item.namaTamu}`} className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 object-cover shrink-0" /> : <span aria-hidden="true" className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold text-sm flex items-center justify-center shrink-0">{item.namaTamu.trim().charAt(0).toUpperCase() || 'T'}</span>}
                    <span className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 font-mono font-bold text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900 shrink-0">
                      {item.nomorBadge}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white break-words">
                        {item.namaTamu}
                      </div>
                      {Boolean(item.groupSize && item.groupSize > 1) && <p className="text-[10px] font-semibold text-sky-700">Rombongan · {item.groupIndex} dari {item.groupSize}</p>}
                      <div className="text-xs text-slate-500 dark:text-slate-400 break-words">
                        {item.instansiAsal}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={item.status === 'SEDANG_BERKUNJUNG' ? 'warning' : 'success'}
                    size="sm"
                  >
                    {item.status === 'SEDANG_BERKUNJUNG' ? 'Sedang Berkunjung' : 'Selesai'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="info" size="sm">
                    {getVisitorCategoryDisplay(item)}
                  </Badge>
                  <span className="text-[11px] font-mono text-slate-500">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Masuk: <strong>{item.jamMasuk}</strong>
                    {item.jamKeluar ? ` • Keluar: ${item.jamKeluar}` : ''}
                  </span>
                </div>

                <div className="text-xs bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    <MapPin className="w-3.5 h-3.5 mr-1" /> Bertemu: <strong>{item.tujuanBertemu}</strong>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 italic">
                    "{item.keperluan}"
                  </p>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
                    {item.noHp && <span className="font-mono text-emerald-600"><Phone className="w-3.5 h-3.5 mr-1" /> {item.noHp}</span>}
                    {item.nomorIdentitas && <span>ID: {item.nomorIdentitas}</span>}
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {item.fotoUrl && (
                      <Button type="button" variant="outline" size="sm" aria-label={`Lihat foto ${item.namaTamu}`}
                        onClick={() => setPhotoVisitor(item)} leftIcon={<Image className="w-4 h-4" />}>
                        Foto
                      </Button>
                    )}
                    {canEditRecord(item) && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="text-xs min-h-[36px] px-3 font-semibold"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setEditingVisitor(item);
                          setIsFormModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs min-h-[36px] px-2.5"
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                      onClick={() => setPrintVisitor(item)}
                    >
                      Slip
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEditRecord(item) && item.status === 'SEDANG_BERKUNJUNG' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50 min-h-[36px] px-2.5"
                        leftIcon={<LogOut className="w-3.5 h-3.5" />}
                        onClick={() => handleCheckoutVisitor(item)}
                      >
                        Check-Out
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSendWaToHost(item)}
                      className="p-2 rounded-lg text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 cursor-pointer"
                      title="Kirim Notifikasi WA ke Guru yang Dituju"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(item)}
                        className="p-2 rounded-lg text-rose-500 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-slate-400 text-xs">
              Belum ada data kunjungan tamu untuk kriteria filter ini.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Desktop Table View (Hidden on mobile) */}
      <Card className={viewMode === 'list' ? '' : 'hidden'}>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-4">Badge & Tamu</th>
                <th className="p-4">Instansi Asal</th>
                <th className="p-4">Kategori Tamu</th>
                <th className="p-4">Waktu Kunjungan</th>
                <th className="p-4">Tujuan & Keperluan</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVisitors.length > 0 ? (
                historyPage.records.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 font-mono font-bold text-blue-700 dark:text-blue-300 text-xs border border-blue-200 dark:border-blue-900 shrink-0">
                          {item.nomorBadge}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.namaTamu}
                          </div>
                          {Boolean(item.groupSize && item.groupSize > 1) && <p className="text-[10px] font-semibold text-sky-700">Rombongan · {item.groupIndex}/{item.groupSize}</p>}
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.noHp || 'Tanpa No HP'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.instansiAsal}
                      </div>
                      {item.nomorIdentitas && (
                        <div className="text-[10px] font-mono text-slate-400">
                          ID: {item.nomorIdentitas}
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <Badge variant="info" size="sm">
                        {getVisitorCategoryDisplay(item)}
                      </Badge>
                    </td>

                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div>{formatIndonesianDate(item.tanggal)}</div>
                      <div className="text-[11px] text-slate-500">
                        Masuk: <strong>{item.jamMasuk}</strong> {item.jamKeluar ? `• Keluar: ${item.jamKeluar}` : ''}
                      </div>
                    </td>

                    <td className="p-4 max-w-xs">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        <MapPin className="w-3.5 h-3.5 mr-1" /> {item.tujuanBertemu}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5" title={item.keperluan}>
                        "{item.keperluan}"
                      </p>
                    </td>

                    <td className="p-4">
                      <Badge
                        variant={item.status === 'SEDANG_BERKUNJUNG' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {item.status === 'SEDANG_BERKUNJUNG' ? 'Sedang Berkunjung' : 'Selesai'}
                      </Badge>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        {item.fotoUrl && (
                          <button type="button" onClick={() => setPhotoVisitor(item)} title="Lihat Foto Tamu"
                            aria-label={`Lihat foto ${item.namaTamu}`} className="p-2 rounded-lg text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                            <Image className="w-4 h-4" />
                          </button>
                        )}
                        {canEditRecord(item) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVisitor(item);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ubah Data Buku Tamu"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Notify host button */}
                        <button
                          type="button"
                          onClick={() => handleSendWaToHost(item)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                          title="Kirim Notifikasi WA ke Guru yang Dituju"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>

                        {/* Print slip button */}
                        <button
                          type="button"
                          onClick={() => setPrintVisitor(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Cetak Slip Masuk Tamu"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Check-Out button */}
                        {canEditRecord(item) && item.status === 'SEDANG_BERKUNJUNG' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                            leftIcon={<LogOut className="w-3.5 h-3.5" />}
                            onClick={() => handleCheckoutVisitor(item)}
                          >
                            Check-Out
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
                  <td colSpan={7} className="p-12 text-center text-slate-400 text-xs">
                    Belum ada data kunjungan tamu untuk kriteria filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <HistoryPagination {...historyPage} />

      {/* VISITOR FORM MODAL */}
      <VisitorFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingVisitor(null);
        }}
        onSave={handleSaveVisitor}
        editingVisitor={editingVisitor}
        teachers={teachers}
        staffList={staffList}
        usersList={usersList}
      />

      {canEdit && <VisitorSelfCheckinPanel isOpen={showSelfCheckin} onClose={() => setShowSelfCheckin(false)} />}

      {/* PRINT PASS MODAL */}
      <Modal isOpen={!!photoVisitor} onClose={() => setPhotoVisitor(null)} title="Dokumentasi Foto Tamu" maxWidth="md">
        {photoVisitor?.fotoUrl && <AuthenticatedImage src={photoVisitor.fotoUrl} alt={`Foto ${photoVisitor.namaTamu}`} className="w-full max-h-[70vh] object-contain rounded-xl" />}
      </Modal>

      <VisitorPassPrintModal
        isOpen={!!printVisitor}
        onClose={() => setPrintVisitor(null)}
        visitor={printVisitor}
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
        title="Hapus Catatan Kunjungan Tamu"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Data Kunjungan?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Tamu: <strong>{deleteConfirm?.namaTamu}</strong> ({deleteConfirm?.instansiAsal})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteVisitor}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
