import React, { useState, useEffect } from 'react';
import {
  BookOpenCheck,
  Plus,
  Search,
  Filter,
  Lock,
  Unlock,
  CheckCircle2,
  FileCheck2,
  Printer,
  Edit2,
  Clock,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { DutyBookFormModal } from './DutyBookFormModal';
import { DutyBookPrintModal } from './DutyBookPrintModal';
import { DutyBookRecord } from '../../types/dutyBook.types';
import { DutyBookStatus, ScheduleItem, SchoolSettings } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { DutyBookService } from '../../services/firebase/dutyBookService';
import { useAuth } from '../../contexts/AuthContext';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, getCurrentDayName } from '../../utils/dateUtils';

export const DutyBookPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [dutyBooks, setDutyBooks] = useState<DutyBookRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [activeDutyBook, setActiveDutyBook] = useState<DutyBookRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDutyBook, setPrintDutyBook] = useState<DutyBookRecord | null>(null);

  const todayISO = new Date().toISOString().split('T')[0];

  // Load subscriptions
  useEffect(() => {
    DutyBookService.bootstrapIfEmpty().then(() => {
      setIsLoading(false);
    });

    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubBooks = FirestoreService.subscribeToCollection<DutyBookRecord>('dutyBooks', (data) => {
      setDutyBooks(
        data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      );
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
    });

    return () => {
      unsubBooks();
      unsubSched();
    };
  }, []);

  const todayDutyBook = dutyBooks.find((b) => b.tanggal === todayISO);

  // Save / Update
  const handleSaveDutyBook = async (record: DutyBookRecord) => {
    if (!currentUser) return;
    await DutyBookService.saveDutyBook(record, currentUser);
  };

  // Advance Status
  const handleStatusChange = async (
    record: DutyBookRecord,
    newStatus: DutyBookStatus,
    note?: string
  ) => {
    if (!currentUser) return;
    await DutyBookService.updateWorkflowStatus(record, newStatus, currentUser, note);
  };

  // Unlock
  const handleUnlock = async (record: DutyBookRecord, reason: string) => {
    if (!currentUser) return;
    await DutyBookService.unlockDutyBook(record, currentUser, reason);
  };

  // Status Pipeline Data
  const stages: Array<{ status: DutyBookStatus; label: string; count: number }> = [
    { status: 'DRAFT', label: '1. Draft', count: dutyBooks.filter((b) => b.status === 'DRAFT').length },
    { status: 'DIAJUKAN', label: '2. Diajukan', count: dutyBooks.filter((b) => b.status === 'DIAJUKAN').length },
    { status: 'DIVERIFIKASI', label: '3. Diverifikasi', count: dutyBooks.filter((b) => b.status === 'DIVERIFIKASI').length },
    { status: 'DISETUJUI', label: '4. Disetujui', count: dutyBooks.filter((b) => b.status === 'DISETUJUI').length },
    { status: 'DIKUNCI', label: '5. Dikunci', count: dutyBooks.filter((b) => b.status === 'DIKUNCI').length },
  ];

  const filtered = dutyBooks.filter((b) => {
    const matchStatus = statusFilter === 'SEMUA' || b.status === statusFilter;
    const matchSearch =
      b.petugasName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.ruangName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tanggal.includes(searchQuery) ||
      (b.catatanPiket && b.catatanPiket.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpenCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Buku Piket Digital
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Jurnal rekapitulasi harian situasi sekolah, ketertiban KBM, dan alur verifikasi resmi
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Status Pipeline Step Indicator */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {stages.map((stage) => {
          const isSelected = statusFilter === stage.status;
          return (
            <button
              key={stage.status}
              onClick={() => setStatusFilter(isSelected ? 'SEMUA' : stage.status)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{stage.label}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {stage.count}
                </span>
              </div>
              <div className="text-[10px] opacity-80 mt-1">
                {stage.status === 'DIKUNCI' ? 'Arsip Permanen' : 'Proses Verifikasi'}
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
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="DRAFT">DRAFT</option>
                <option value="DIAJUKAN">DIAJUKAN</option>
                <option value="DIVERIFIKASI">DIVERIFIKASI</option>
                <option value="DISETUJUI">DISETUJUI</option>
                <option value="DIKUNCI">DIKUNCI</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* JURNAL LIST CARDS */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <Card key={item.id} hoverable className="transition-all">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.hari}, {formatIndonesianDate(item.tanggal)}
                    </span>
                    <Badge
                      variant={
                        item.status === 'DIKUNCI'
                          ? 'neutral'
                          : item.status === 'DISETUJUI'
                          ? 'success'
                          : item.status === 'DIVERIFIKASI'
                          ? 'info'
                          : item.status === 'DIAJUKAN'
                          ? 'warning'
                          : 'primary'
                      }
                      size="sm"
                      icon={item.status === 'DIKUNCI' ? <Lock className="w-3 h-3" /> : undefined}
                    >
                      {item.status}
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

                {/* Verification Meta Tracker */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {item.submittedBy && <span>Diajukan: <strong>{item.submittedBy.split(' ')[0]}</strong></span>}
                  {item.verifiedBy && <span>• Diverifikasi: <strong>{item.verifiedBy.split(' ')[0]}</strong></span>}
                  {item.approvedBy && <span>• Disetujui: <strong>{item.approvedBy.split(' ')[0]}</strong></span>}
                  {item.lockedBy && <span>• Dikunci: <strong>{item.lockedBy.split(' ')[0]}</strong></span>}
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
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setActiveDutyBook(item);
                      setIsFormModalOpen(true);
                    }}
                  >
                    {item.status === 'DIKUNCI' && !isAdmin ? 'Lihat Jurnal' : 'Buka / Edit Jurnal'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
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

      {/* DUTY BOOK FORM MODAL */}
      <DutyBookFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setActiveDutyBook(null);
        }}
        onSave={handleSaveDutyBook}
        onStatusChange={handleStatusChange}
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
