import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { SchoolSettings, DayOfWeek } from '../../types';
import {
  LessonPeriodItem,
  LessonPeriodConfig,
  ALL_DAYS_OF_WEEK,
  validateLessonPeriodConfig,
  timeToMinutes,
} from '../../types/period.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Save,
  RotateCcw,
  Eye,
  Check,
  X,
  ShieldCheck,
  Sparkles,
} from '../../components/icons';

interface LessonPeriodSettingsCardProps {
  settings: SchoolSettings;
  onUpdated: (newSettings: SchoolSettings) => void;
}

export const LessonPeriodSettingsCard: React.FC<LessonPeriodSettingsCardProps> = ({
  settings,
  onUpdated,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const todayIso = new Date().toISOString().split('T')[0];

  // Inisialisasi draft konfigurasi dari settings atau draft kosong
  const initialEffectiveDate =
    settings.lessonPeriodConfig?.effectiveDate || todayIso;

  const [effectiveDate, setEffectiveDate] = useState<string>(initialEffectiveDate);
  const [periods, setPeriods] = useState<LessonPeriodItem[]>(() => {
    if (settings.lessonPeriodConfig?.periods && settings.lessonPeriodConfig.periods.length > 0) {
      return [...settings.lessonPeriodConfig.periods];
    }
    return [];
  });

  // Filter hari untuk pratinjau / pengelolaan
  const [selectedDayFilter, setSelectedDayFilter] = useState<DayOfWeek | 'SEMUA'>('SEMUA');

  // Modal Tambah / Edit JP
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);

  // Form state di dalam Modal
  const [modalPeriodNumber, setModalPeriodNumber] = useState<number>(1);
  const [modalName, setModalName] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState<string>('07:15');
  const [modalEndTime, setModalEndTime] = useState<string>('08:00');
  const [modalDays, setModalDays] = useState<DayOfWeek[]>([
    'SENIN',
    'SELASA',
    'RABU',
    'KAMIS',
    'JUMAT',
  ]);
  const [modalIsActive, setModalIsActive] = useState<boolean>(true);
  const [modalNotes, setModalNotes] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Status simpan
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  // Validasi real-time
  const validationResult = useMemo(() => {
    return validateLessonPeriodConfig({
      effectiveDate,
      periods,
    });
  }, [effectiveDate, periods]);

  // Buka modal untuk tambah JP baru
  const handleOpenAddModal = () => {
    setEditingPeriodId(null);
    // Hitung nomor JP berikutnya berdasarkan JP yang sudah ada
    const nextNumber =
      periods.length > 0 ? Math.max(...periods.map((p) => p.periodNumber)) + 1 : 1;
    setModalPeriodNumber(nextNumber);
    setModalName(`JP ${nextNumber}`);

    // Estimasi jam mulai dan selesai berdasarkan JP terakhir
    if (periods.length > 0) {
      const lastPeriod = [...periods].sort((a, b) => a.periodNumber - b.periodNumber)[
        periods.length - 1
      ];
      setModalStartTime(lastPeriod.endTime);
      const [h, m] = lastPeriod.endTime.split(':').map(Number);
      const endTotal = h * 60 + m + 45; // default 45 menit
      const endH = String(Math.floor(endTotal / 60) % 24).padStart(2, '0');
      const endM = String(endTotal % 60).padStart(2, '0');
      setModalEndTime(`${endH}:${endM}`);
      setModalDays([...lastPeriod.days]);
    } else {
      setModalStartTime('07:15');
      setModalEndTime('08:00');
      setModalDays(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
    }

    setModalIsActive(true);
    setModalNotes('');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Buka modal untuk edit JP
  const handleOpenEditModal = (period: LessonPeriodItem) => {
    setEditingPeriodId(period.id);
    setModalPeriodNumber(period.periodNumber);
    setModalName(period.name || `JP ${period.periodNumber}`);
    setModalStartTime(period.startTime);
    setModalEndTime(period.endTime);
    setModalDays([...period.days]);
    setModalIsActive(period.isActive);
    setModalNotes(period.notes || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Toggle hari dalam modal
  const handleToggleModalDay = (day: DayOfWeek) => {
    setModalDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Select all weekdays (Senin - Jumat)
  const handleSelectWeekdays = () => {
    setModalDays(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
  };

  // Select Friday only
  const handleSelectFridayOnly = () => {
    setModalDays(['JUMAT']);
  };

  // Simpan item JP dari modal ke draft
  const handleSaveModalPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (modalPeriodNumber <= 0) {
      setModalError('Nomor JP harus bernilai lebih dari 0.');
      return;
    }

    if (!modalStartTime || !modalEndTime) {
      setModalError('Jam mulai dan jam selesai wajib diisi.');
      return;
    }

    const startMin = timeToMinutes(modalStartTime);
    const endMin = timeToMinutes(modalEndTime);

    if (endMin <= startMin) {
      setModalError(
        `Jam selesai (${modalEndTime}) harus lebih lambat dari jam mulai (${modalStartTime}).`
      );
      return;
    }

    if (modalDays.length === 0) {
      setModalError('Pilih minimal 1 hari berlaku untuk jam pelajaran ini.');
      return;
    }

    // Uji bentrok sementara pada draft
    const updatedDraft: LessonPeriodItem[] = editingPeriodId
      ? periods.map((p) =>
          p.id === editingPeriodId
            ? {
                ...p,
                periodNumber: modalPeriodNumber,
                name: modalName.trim() || `JP ${modalPeriodNumber}`,
                startTime: modalStartTime,
                endTime: modalEndTime,
                days: modalDays,
                isActive: modalIsActive,
                notes: modalNotes.trim(),
              }
            : p
        )
      : [
          ...periods,
          {
            id: `jp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            periodNumber: modalPeriodNumber,
            name: modalName.trim() || `JP ${modalPeriodNumber}`,
            startTime: modalStartTime,
            endTime: modalEndTime,
            days: modalDays,
            isActive: modalIsActive,
            notes: modalNotes.trim(),
          },
        ];

    // Periksa apakah ada bentrok pada hari yang dipilih
    const activeDraft = updatedDraft.filter((p) => p.isActive);
    for (const d of modalDays) {
      const dayPeriods = activeDraft.filter((p) => p.days.includes(d));

      // Duplikat nomor JP
      const duplicateNum = dayPeriods.filter((p) => p.periodNumber === modalPeriodNumber);
      if (duplicateNum.length > 1) {
        setModalError(
          `Nomor JP ${modalPeriodNumber} sudah digunakan pada hari ${d}. Pastikan nomor JP tidak ganda.`
        );
        return;
      }

      // Interval bentrok
      for (let i = 0; i < dayPeriods.length; i++) {
        for (let j = i + 1; j < dayPeriods.length; j++) {
          const p1 = dayPeriods[i];
          const p2 = dayPeriods[j];
          const s1 = timeToMinutes(p1.startTime);
          const e1 = timeToMinutes(p1.endTime);
          const s2 = timeToMinutes(p2.startTime);
          const e2 = timeToMinutes(p2.endTime);

          if (s1 < e2 && s2 < e1) {
            setModalError(
              `Interval waktu JP ${p1.periodNumber} (${p1.startTime}-${p1.endTime}) bertabrakan dengan JP ${p2.periodNumber} (${p2.startTime}-${p2.endTime}) pada hari ${d}.`
            );
            return;
          }
        }
      }
    }

    setPeriods(updatedDraft.sort((a, b) => a.periodNumber - b.periodNumber));
    setIsModalOpen(false);
  };

  // Toggle status aktif/nonaktif dari tabel
  const handleToggleActive = (id: string) => {
    setPeriods((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  // Hapus item JP dari draft
  const handleDeletePeriod = (id: string) => {
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  // Simpan ke Firestore
  const handleSaveToFirestore = async () => {
    if (!isAdmin) {
      setSaveStatus({
        type: 'error',
        message: 'Akses ditolak: Hanya akun Administrator yang berhak mengubah jam pelajaran.',
      });
      return;
    }

    if (!currentUser) return;

    if (!validationResult.isValid) {
      setSaveStatus({
        type: 'error',
        message: validationResult.errors[0] || 'Terdapat kesalahan pada jadwal jam pelajaran.',
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: 'idle', message: '' });

    try {
      const configPayload: LessonPeriodConfig = {
        effectiveDate,
        periods: periods.sort((a, b) => a.periodNumber - b.periodNumber),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      };

      const result = await SchoolSettingsService.savePeriodScheduleConfig(
        configPayload,
        currentUser.id
      );

      onUpdated(result.settings);
      setSaveStatus({
        type: 'success',
        message: 'Pengaturan jam pelajaran sekolah berhasil disimpan dan aktif sesuai tanggal berlaku!',
      });
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err?.message || 'Gagal menyimpan pengaturan jam pelajaran.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter periods untuk tampilan daftar
  const filteredPeriods = useMemo(() => {
    if (selectedDayFilter === 'SEMUA') {
      return [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
    }
    return periods
      .filter((p) => p.days && p.days.includes(selectedDayFilter))
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [periods, selectedDayFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Pengaturan Jam Pelajaran (JP) Sekolah</span>
              <Badge variant="primary" className="text-[10px]">
                Khusus Administrator
              </Badge>
            </div>
          }
          subtitle="Konfigurasi resmi jam pelajaran (JP), interval waktu antarhari (Senin-Kamis vs Jumat), tanggal mulai berlaku, dan pratinjau timeline jadwal."
        />

        <CardContent className="space-y-6">
          {/* NON-ADMIN RESTRICTION NOTICE */}
          {!isAdmin && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Akses Terbatas:</strong> Anda sedang melihat konfigurasi jam pelajaran dalam mode baca. Perubahan jadwal jam pelajaran hanya dapat dilakukan oleh akun dengan hak akses Administrator.
              </div>
            </div>
          )}

          {/* TANGGAL MULAI BERLAKU */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Tanggal Mulai Berlaku Jadwal *</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Perubahan konfigurasi jam pelajaran akan berlaku mulai tanggal ini. Riwayat lampau tetap menyimpan snapshot JP pada waktu kejadian.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  disabled={!isAdmin}
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="p-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* DAY FILTER TABS & ADD BUTTON */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('SEMUA')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedDayFilter === 'SEMUA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Semua Hari ({periods.length})
              </button>
              {ALL_DAYS_OF_WEEK.slice(0, 6).map(({ code, label }) => {
                const count = periods.filter((p) => p.days && p.days.includes(code)).length;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedDayFilter(code)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      selectedDayFilter === code
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenAddModal}
              >
                Tambah Jam Pelajaran (JP)
              </Button>
            )}
          </div>

          {/* TABLE OF PERIODS */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3.5 w-16 text-center">No. JP</th>
                    <th className="p-3.5">Nama & Interval Waktu</th>
                    <th className="p-3.5">Durasi</th>
                    <th className="p-3.5">Hari Berlaku</th>
                    <th className="p-3.5">Keterangan</th>
                    <th className="p-3.5 text-center">Status</th>
                    {isAdmin && <th className="p-3.5 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPeriods.length > 0 ? (
                    filteredPeriods.map((period) => {
                      const dur = timeToMinutes(period.endTime) - timeToMinutes(period.startTime);
                      return (
                        <tr
                          key={period.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                            !period.isActive ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center font-bold font-mono">
                            <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-flex items-center justify-center">
                              {period.periodNumber}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {period.name || `JP ${period.periodNumber}`}
                            </div>
                            <div className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {period.startTime} - {period.endTime} WIB
                            </div>
                          </td>

                          <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                            {dur > 0 ? `${dur} Menit` : '-'}
                          </td>

                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {period.days && period.days.length > 0 ? (
                                period.days.map((d) => (
                                  <span
                                    key={d}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      d === 'JUMAT'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">Belum diatur</span>
                              )}
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-500 max-w-xs truncate">
                            {period.notes || '-'}
                          </td>

                          <td className="p-3.5 text-center">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleToggleActive(period.id)}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                                  period.isActive
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                                title="Klik untuk mengubah status aktif/nonaktif"
                              >
                                {period.isActive ? 'Aktif' : 'Nonaktif'}
                              </button>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  period.isActive
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {period.isActive ? 'Aktif' : 'Nonaktif'}
                              </span>
                            )}
                          </td>

                          {isAdmin && (
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(period)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  title="Edit Jam Pelajaran"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePeriod(period.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  title="Hapus Jam Pelajaran"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={isAdmin ? 7 : 6}
                        className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs"
                      >
                        {periods.length === 0
                          ? 'Belum ada konfigurasi jam pelajaran (JP). Klik "+ Tambah Jam Pelajaran" untuk mulai menyusun jadwal sekolah.'
                          : `Tidak ada JP yang terdaftar untuk filter hari ${selectedDayFilter}.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* VISUAL TIMELINE PREVIEW BEFORE SAVE */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Pratinjau Jadwal Harian Sekolah
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {periods.filter((p) => p.isActive).length} JP Aktif Terdaftar
              </span>
            </div>

            {/* Timelines grouped by major schedules (Senin-Kamis vs Jumat) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timeline Senin - Kamis */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Jadwal Reguler (Senin - Kamis)
                  </span>
                  <Badge variant="neutral" className="text-[10px]">
                    {periods.filter((p) => p.isActive && p.days?.includes('SENIN')).length} JP
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  {periods
                    .filter((p) => p.isActive && p.days?.includes('SENIN'))
                    .sort((a, b) => a.periodNumber - b.periodNumber)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            JP {p.periodNumber}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                            {p.name || `Jam Ke-${p.periodNumber}`}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 font-semibold">
                          {p.startTime} - {p.endTime}
                        </span>
                      </div>
                    ))}
                  {periods.filter((p) => p.isActive && p.days?.includes('SENIN')).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-2 text-center">
                      Belum ada jadwal JP aktif untuk hari Senin - Kamis.
                    </p>
                  )}
                </div>
              </div>

              {/* Timeline Jumat */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Jadwal Khusus Hari Jumat
                  </span>
                  <Badge variant="info" className="text-[10px] text-purple-700 border-purple-300">
                    {periods.filter((p) => p.isActive && p.days?.includes('JUMAT')).length} JP
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1">
                  {periods
                    .filter((p) => p.isActive && p.days?.includes('JUMAT'))
                    .sort((a, b) => a.periodNumber - b.periodNumber)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                            JP {p.periodNumber}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[140px]">
                            {p.name || `Jam Ke-${p.periodNumber}`}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 font-semibold">
                          {p.startTime} - {p.endTime}
                        </span>
                      </div>
                    ))}
                  {periods.filter((p) => p.isActive && p.days?.includes('JUMAT')).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-2 text-center">
                      Belum ada jadwal JP aktif khusus hari Jumat.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VALIDATION WARNING BOX */}
          {!validationResult.isValid && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Konfigurasi belum valid (Perbaiki sebelum menyimpan):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                {validationResult.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SAVE FEEDBACK ALERT */}
          {saveStatus.type !== 'idle' && (
            <div
              className={`p-4 rounded-xl text-xs flex items-center gap-2.5 ${
                saveStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
              }`}
            >
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{saveStatus.message}</span>
            </div>
          )}

          {/* ACTION BUTTONS */}
          {isAdmin && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500">
                Pembaruan jam pelajaran akan langsung disinkronkan ke seluruh form guru inval dan sistem presensi.
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="md"
                  disabled={isSaving || !validationResult.isValid}
                  isLoading={isSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                  onClick={handleSaveToFirestore}
                >
                  Simpan Pengaturan Jam Pelajaran
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL TAMBAH / EDIT JP */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPeriodId ? `Edit Jam Pelajaran (JP ${modalPeriodNumber})` : 'Tambah Jam Pelajaran (JP)'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveModalPeriod} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nomor JP */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nomor JP *
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={modalPeriodNumber}
                onChange={(e) => setModalPeriodNumber(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>

            {/* Nama JP */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Label / Nama JP
              </label>
              <input
                type="text"
                placeholder={`Contoh: JP ${modalPeriodNumber}`}
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Jam Mulai & Jam Selesai */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Jam Mulai (WIB) *
              </label>
              <input
                type="time"
                required
                value={modalStartTime}
                onChange={(e) => setModalStartTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Jam Selesai (WIB) *
              </label>
              <input
                type="time"
                required
                value={modalEndTime}
                onChange={(e) => setModalEndTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* Durasi Info */}
          {modalStartTime && modalEndTime && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] flex items-center justify-between text-slate-600 dark:text-slate-400 font-mono">
              <span>Durasi Waktu:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {timeToMinutes(modalEndTime) - timeToMinutes(modalStartTime) > 0
                  ? `${timeToMinutes(modalEndTime) - timeToMinutes(modalStartTime)} Menit`
                  : 'Waktu Selesai Tidak Valid'}
              </span>
            </div>
          )}

          {/* Hari Berlaku */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Hari Berlaku *
              </label>
              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectWeekdays}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Senin-Jumat
                </button>
                <span>&bull;</span>
                <button
                  type="button"
                  onClick={handleSelectFridayOnly}
                  className="text-purple-600 hover:underline cursor-pointer"
                >
                  Jumat Saja
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ALL_DAYS_OF_WEEK.slice(0, 6).map(({ code, label }) => {
                const isSelected = modalDays.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleToggleModalDay(code)}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Aktif & Catatan */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Catatan / Keterangan Khusus
              </label>
              <input
                type="text"
                placeholder="Contoh: Khusus Upacara Bendera, Sholat Dhuha, dll."
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={modalIsActive}
                onChange={(e) => setModalIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jam Pelajaran Aktif (Dapat dipilih pada form guru inval)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingPeriodId ? 'Simpan Perubahan' : 'Tambahkan JP'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
