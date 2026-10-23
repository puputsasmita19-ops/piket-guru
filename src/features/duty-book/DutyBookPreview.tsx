import { useHistoryPeriod, useHistoryPagination } from '../../hooks/useHistoryPeriod';
import { useOperationalSchoolSettings } from '../../hooks/useOperationalSchoolSettings';
import { HistoryControls, HistoryPagination, HistoryTable, useHistoryView } from '../../components/common/HistoryControls';
import React, { useState, useEffect } from 'react';
import {
  BookOpenCheck,
  Plus,
  Search,
  Lock,
  Printer,
  Edit2,
  FileCheck2,
  Clock,
  ShieldAlert,
} from '../../components/icons';
import { Card, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DutyBookFormModal } from './DutyBookFormModal';
import { DutyBookPrintModal } from './DutyBookPrintModal';
import { DutyBookRecord, getDutyBookDisplayStatus } from '../../types/dutyBook.types';
import { DutyBookStatus, ScheduleItem, SchoolSettings } from '../../types';
import { where, limit } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { DutyBookService } from '../../services/firebase/dutyBookService';
import { mayEditOwnRecord } from '../../utils/recordOwnership';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, getTodayISODate } from '../../utils/dateUtils';

export const DutyBookPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const settings = useOperationalSchoolSettings();
  const history = useHistoryPeriod(settings);
  const [viewMode, setViewMode] = useHistoryView();
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [historyUser, setHistoryUser] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [activeDutyBook, setActiveDutyBook] = useState<DutyBookRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDutyBook, setPrintDutyBook] = useState<DutyBookRecord | null>(null);

  const todayISO = history.today;

  // Load subscriptions
  useEffect(() => {
    DutyBookService.bootstrapIfEmpty().then(() => {
      setIsLoading(false);
    });


    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
    });

    return () => {
      unsubSched();
    };
  }, []);

  // Server query always keeps the selected date bounds; invalid ranges never query.
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    setDutyBooks([]); setHistoryError('');
    if (history.range.error) return;
    return FirestoreService.subscribeToCollection<DutyBookRecord>('dutyBooks', data => {
      setDutyBooks([...data].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    }, error => setHistoryError(error.message || 'Riwayat belum dapat dimuat.'), history.constraints, { cacheKey: history.key });
  }, [history.constraints, history.range.error]);

  // Save Draft (Guru or Admin)
  const handleSaveDutyBook = async (record: DutyBookRecord, originalUpdatedAt?: string) => {
    if (!currentUser) return;
    await DutyBookService.saveDraft(record, currentUser, originalUpdatedAt);
  };

  // Submit Journal (Guru or Admin)
  const handleSubmitJournal = async (record: DutyBookRecord, originalUpdatedAt?: string) => {
    if (!currentUser) return;
    await DutyBookService.submitJournal(record, currentUser, originalUpdatedAt);
  };

  // One-step Sahkan & Selesaikan (Admin or Kepsek)
  const handleApproveAndComplete = async (record: DutyBookRecord) => {
    if (!currentUser) return;
    await DutyBookService.approveAndComplete(record, currentUser);
  };

  // Kembalikan ke Draft (Admin or Kepsek)
  const handleRequestRevision = async (record: DutyBookRecord, reason: string) => {
    if (!currentUser) return;
    await DutyBookService.requestRevision(record, currentUser, reason);
  };

  // Advance Status (backwards compatible)
  const handleStatusChange = async (
    record: DutyBookRecord,
    newStatus: DutyBookStatus,
    note?: string
  ) => {
    if (!currentUser) return;
    await DutyBookService.updateWorkflowStatus(record, newStatus, currentUser, note);
  };

  // Unlock (Admin only)
  const handleUnlock = async (record: DutyBookRecord, reason: string) => {
    if (!currentUser) return;
    await DutyBookService.unlockDutyBook(record, currentUser, reason);
  };

  // Streamlined 3-Stage Pipeline
  const stages = [
    {
      key: 'DRAFT',
      label: '1. Draft',
      subtitle: 'Draf Belum Lengkap',
      count: dutyBooks.filter((b) => b.status === 'DRAFT').length,
    },
    {
      key: 'TERKIRIM',
      label: '2. Terkirim',
      subtitle: 'Menunggu Pengesahan',
      count: dutyBooks.filter((b) => b.status === 'DIAJUKAN' || b.status === 'DIVERIFIKASI').length,
    },
    {
      key: 'SELESAI',
      label: '3. Selesai',
      subtitle: 'Arsip Resmi Terkunci',
      count: dutyBooks.filter((b) => b.status === 'DIKUNCI' || b.status === 'DISETUJUI').length,
    },
  ];

  const filtered = dutyBooks.filter((b) => {
    const displayInfo = getDutyBookDisplayStatus(b.status);
    const matchStatus =
      statusFilter === 'SEMUA' ||
      statusFilter === b.status ||
      statusFilter === displayInfo.stage;

    const matchSearch =
      b.petugasName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.ruangName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tanggal.includes(searchQuery) ||
      (b.catatanPiket && b.catatanPiket.toLowerCase().includes(searchQuery.toLowerCase()));

    return (historyUser === 'all' || b.petugasId === (historyUser === 'me' ? currentUser?.id : historyUser)) && !history.range.error && b.tanggal >= history.range.start && b.tanggal <= history.range.end && matchStatus && matchSearch;
  });

  const historyPage = useHistoryPagination(filtered, [history.key, searchQuery, statusFilter, historyUser].join('|'));

  return (
    <div data-tour="duty-book-container" className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpenCheck className="w-6 h-6 text-[var(--theme-primary)]" />
            Buku Piket Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Isi kegiatan piket dan pantau catatan harian.</p>
        </div>

        <div className="page-actions flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setActiveDutyBook(null);
              setIsFormModalOpen(true);
            }}
          >
            + Buat Jurnal Baru
          </Button>
        </div>
      </div>

      {/* 3-Stage Pipeline Step Indicator */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {stages.map((stage) => {
          const isSelected = statusFilter === stage.key;
          return (
            <button
              key={stage.key}
              onClick={() => setStatusFilter(isSelected ? 'SEMUA' : stage.key)}
              className={`p-3 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer min-w-0 ${
                isSelected
                  ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] border-[var(--theme-primary)] shadow-md shadow-[var(--theme-ring)]'
                  : 'bg-white dark:bg-[var(--theme-card-bg)] border-slate-200 dark:border-[var(--theme-card-border)] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-subtle)]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-bold truncate">{stage.label}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {stage.count}
                </span>
              </div>
              <div className="text-[11px] opacity-80 mt-1 truncate">
                {stage.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tanggal, petugas, atau catatan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50/50 dark:bg-[var(--theme-input-bg)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
              />
            </div>

            <div className="app-filter-group flex items-center gap-2 w-full sm:w-auto justify-end">

              <label className="app-filter-field"><span>Status</span><select aria-label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-input-bg)] text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="DRAFT">1. Draft</option>
                <option value="TERKIRIM">2. Terkirim</option>
                <option value="SELESAI">3. Selesai</option>
              </select></label>
            </div>
          </div>
        </CardContent>
      </Card>

      <HistoryControls history={history} view={viewMode} onViewChange={setViewMode} user={historyUser} onUserChange={setHistoryUser} users={[...new Map([...schedules.map(s => ({ id: s.petugasId, name: s.petugasName })), ...dutyBooks.map(b => ({ id: b.petugasId, name: b.petugasName }))].filter(u => u.id && u.id !== currentUser?.id).map(u => [u.id, u])).values()].sort((a,b) => a.name.localeCompare(b.name))} />
      {historyError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{historyError}</p>}

      {viewMode === 'list' && <HistoryTable view="list"><Card><CardContent className="p-0"><table className="w-full text-left text-xs"><thead className="bg-[var(--theme-surface-subtle)]"><tr>{['Tanggal', 'Petugas / Ruang', 'Shift', 'Kesimpulan', 'Status', 'Aksi'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{historyPage.records.map(item => <tr key={item.id} className="border-t border-[var(--theme-card-border)]"><td className="p-3">{formatIndonesianDate(item.tanggal)}</td><td className="p-3 font-semibold">{item.petugasName}<div className="text-[11px] font-normal">{item.ruangName}</div></td><td className="p-3 whitespace-nowrap">{item.jamMulai}–{item.jamSelesai}</td><td className="p-3 min-w-40">{item.catatanPiket || '-'}</td><td className="p-3"><Badge variant={getDutyBookDisplayStatus(item.status).variant}>{getDutyBookDisplayStatus(item.status).label}</Badge></td><td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setPrintDutyBook(item); setIsPrintModalOpen(true); }}>Cetak</Button><Button size="sm" onClick={() => { setActiveDutyBook(item); setIsFormModalOpen(true); }}>{getDutyBookDisplayStatus(item.status).stage === 'SELESAI' && !isAdmin ? 'Lihat' : 'Buka / Edit'}</Button></div></td></tr>)}{!historyPage.total && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada buku piket untuk kriteria ini.</td></tr>}</tbody></table></CardContent></Card></HistoryTable>}

      {/* JURNAL LIST CARDS */}
      <div data-tour="my-history-section" className={viewMode === 'grid' ? 'history-card-grid' : 'hidden'}>
        {filtered.length > 0 ? (
          historyPage.records.map((item) => {
            const displayInfo = getDutyBookDisplayStatus(item.status);
            return (
              <Card key={item.id} hoverable className="transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {item.hari}, {formatIndonesianDate(item.tanggal)}
                      </span>
                      <Badge
                        variant={displayInfo.variant}
                        size="sm"
                        icon={displayInfo.stage === 'SELESAI' ? <Lock className="w-3 h-3" /> : undefined}
                      >
                        {displayInfo.label}
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-500 font-mono">
                      Shift: {item.jamMulai} - {item.jamSelesai} WIB
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Petugas Piket:
                      </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {item.petugasName} ({item.ruangName})
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Kesimpulan Piket:
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 truncate">
                        {item.catatanPiket || 'Belum ada catatan kesimpulan.'}
                      </p>
                    </div>
                  </div>

                  {/* Metadata Audit Trail */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {item.submittedBy && (
                      <span>
                        Terkirim: <strong>{item.submittedBy}</strong>
                      </span>
                    )}
                    {(item.lockedBy || item.approvedBy) && (
                      <span>
                        &bull; Disahkan: <strong>{item.lockedBy || item.approvedBy}</strong>
                      </span>
                    )}
                    {item.revisionReason && (
                      <span className="text-amber-600 dark:text-amber-400">
                        &bull; Catatan Revisi: <em>{item.revisionReason}</em>
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500" />}
                      onClick={() => {
                        setPrintDutyBook(item);
                        setIsPrintModalOpen(true);
                      }}
                    >
                      Pratinjau Cetak
                    </Button>
                    {mayEditOwnRecord(currentUser, item as unknown as Record<string, unknown>, 'petugasId') && <Button
                      variant="primary"
                      size="sm"
                      className="text-xs"
                      leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setActiveDutyBook(item);
                        setIsFormModalOpen(true);
                      }}
                    >
                      {displayInfo.stage === 'SELESAI' && !isAdmin ? 'Lihat Jurnal' : 'Buka / Edit Jurnal'}
                    </Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <BookOpenCheck className="w-12 h-12 mx-auto opacity-30" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Belum ada buku piket untuk kriteria ini
            </h4>
            <p className="text-xs">Klik tombol "+ Buat Jurnal Baru" untuk memulai catatan piket.</p>
          </div>
        )}
      </div>

      <HistoryPagination {...historyPage} />

      {/* DUTY BOOK FORM MODAL */}
      <DutyBookFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setActiveDutyBook(null);
        }}
        onSave={handleSaveDutyBook}
        onSubmitJournal={handleSubmitJournal}
        onStatusChange={handleStatusChange}
        onApproveAndComplete={handleApproveAndComplete}
        onRequestRevision={handleRequestRevision}
        onUnlock={handleUnlock}
        dutyBook={activeDutyBook}
        schedules={schedules}
      />

      {/* PRINT MODAL */}
      <DutyBookPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintDutyBook(null);
        }}
        dutyBook={printDutyBook}
        settings={settings}
      />
    </div>
  );
};
