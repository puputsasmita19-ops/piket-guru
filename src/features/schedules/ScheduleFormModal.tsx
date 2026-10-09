import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, ScheduleStatus, SchoolSettings, UserProfile } from '../../types';
import { TeacherRecord, StaffRecord, RoomRecord } from '../../types/master.types';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { DAYS_LIST } from '../../config/constants';
import { getTodayISODate } from '../../utils/dateUtils';
import {
  getShiftHoursForDay,
  buildOfficerCandidates,
  OfficerCandidate,
} from '../../utils/scheduleUtils';
import {
  AlertTriangle,
  Clock,
  MapPin,
  User,
  Calendar,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  SlidersHorizontal,
} from 'lucide-react';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: ScheduleItem) => Promise<void>;
  onSaveMultiple?: (schedules: ScheduleItem[]) => Promise<void>;
  editingSchedule: ScheduleItem | null;
  users: UserProfile[];
  teachers?: TeacherRecord[];
  staff?: StaffRecord[];
  rooms: RoomRecord[];
  allSchedules: ScheduleItem[];
  defaultDay: DayOfWeek;
  settings?: SchoolSettings;
  isLoadingData?: boolean;
  initialMultiPerson?: boolean;
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveMultiple,
  editingSchedule,
  users,
  teachers = [],
  staff = [],
  rooms,
  allSchedules,
  defaultDay,
  settings,
  isLoadingData = false,
  initialMultiPerson = false,
}) => {
  // Build active officer candidates strictly using users.id as identity
  const candidates: OfficerCandidate[] = useMemo(() => {
    return buildOfficerCandidates(users, teachers, staff);
  }, [users, teachers, staff]);

  // Active days and shift settings
  const activeDays: DayOfWeek[] = useMemo(() => {
    if (settings?.workHours?.activeDays && settings.workHours.activeDays.length > 0) {
      return settings.workHours.activeDays;
    }
    return ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  }, [settings]);

  const isSundayActiveInSettings = useMemo(() => {
    if (settings?.workHours?.dailySchedules?.['MINGGU']?.isActive !== undefined) {
      return settings.workHours.dailySchedules['MINGGU'].isActive;
    }
    return activeDays.includes('MINGGU');
  }, [settings, activeDays]);

  // Form State
  const [hari, setHari] = useState<DayOfWeek>(defaultDay);
  const [tanggal, setTanggal] = useState<string>(getTodayISODate());
  const [jamMulai, setJamMulai] = useState<string>('06:30');
  const [jamSelesai, setJamSelesai] = useState<string>('15:30');
  const [petugasId, setPetugasId] = useState<string>('');
  const [isMultiPerson, setIsMultiPerson] = useState<boolean>(initialMultiPerson);
  const [selectedPetugasIds, setSelectedPetugasIds] = useState<string[]>([]);
  const [ruangId, setRuangId] = useState<string>('');
  const [status, setStatus] = useState<ScheduleStatus>('TERJADWAL');
  const [keterangan, setKeterangan] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ tone: 'info' | 'error' | 'success'; message: string } | null>(null);

  // Resolved shift hours for the current selected day in settings
  const currentDayShift = useMemo(() => {
    return getShiftHoursForDay(hari, settings);
  }, [hari, settings]);

  // Track initial load to prevent background Firestore updates from clearing typed user inputs
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
      return;
    }

    if (editingSchedule) {
      setIsMultiPerson(false);
      setHari(editingSchedule.hari);
      setTanggal(editingSchedule.tanggal || getTodayISODate());
      setJamMulai(editingSchedule.jamMulai);
      setJamSelesai(editingSchedule.jamSelesai);
      setPetugasId(editingSchedule.petugasId);
      setSelectedPetugasIds([editingSchedule.petugasId]);
      setRuangId(editingSchedule.ruangId);
      setStatus(editingSchedule.status);
      setKeterangan(editingSchedule.keterangan || '');
      hasInitializedRef.current = true;
    } else {
      setIsMultiPerson(!!initialMultiPerson);
      // Determine initial day based on active days in settings
      const initialDay = activeDays.includes(defaultDay) ? defaultDay : (activeDays[0] || 'SENIN');
      const shift = getShiftHoursForDay(initialDay, settings);

      setHari(initialDay);
      setTanggal(getTodayISODate());
      setJamMulai(shift.start);
      setJamSelesai(shift.end);

      const firstUserId = candidates[0]?.userId || '';
      setPetugasId(firstUserId);
      setSelectedPetugasIds(firstUserId ? [firstUserId] : []);
      setRuangId(rooms[0]?.id || '');
      setStatus('TERJADWAL');
      setKeterangan('');
      hasInitializedRef.current = true;
    }
  }, [isOpen, editingSchedule?.id]);

  // When day changes: safely update default start/end hours if creating a new schedule
  const handleDayChange = (newDay: DayOfWeek) => {
    setHari(newDay);
    if (!editingSchedule) {
      const shift = getShiftHoursForDay(newDay, settings);
      setJamMulai(shift.start);
      setJamSelesai(shift.end);
    }
  };

  // Explicit action for admin to apply current school settings shift hours to an existing schedule
  const handleApplySchoolSettingsShift = async () => {
    try {
      const latest = await FirestoreService.getById<SchoolSettings>('settings', 'school_config');
      const shift = getShiftHoursForDay(hari, latest || settings);
      setJamMulai(shift.start);
      setJamSelesai(shift.end);
      setModalFeedback({
        tone: 'info',
        message: `Jam tugas diisi dengan jam sekolah terbaru (${shift.start} - ${shift.end} WIB). Nilai ini baru mengisi formulir; tekan "Perbarui Jadwal" di bawah untuk menyimpan perubahan.`,
      });
    } catch {
      setJamMulai(currentDayShift.start);
      setJamSelesai(currentDayShift.end);
      setModalFeedback({
        tone: 'info',
        message: `Jam tugas diisi dari konfigurasi shift (${currentDayShift.start} - ${currentDayShift.end} WIB). Tekan "Perbarui Jadwal" di bawah untuk menyimpan.`,
      });
    }
  };

  const togglePetugasSelect = (userId: string) => {
    if (selectedPetugasIds.includes(userId)) {
      setSelectedPetugasIds(selectedPetugasIds.filter((id) => id !== userId));
    } else {
      setSelectedPetugasIds([...selectedPetugasIds, userId]);
    }
  };

  const handleSelectAllPetugas = () => {
    if (selectedPetugasIds.length === candidates.length) {
      setSelectedPetugasIds([]);
    } else {
      setSelectedPetugasIds(candidates.map((c) => c.userId));
    }
  };

  // Live Conflict Checking
  useEffect(() => {
    if ((!isMultiPerson && !petugasId) || !ruangId || !hari || !jamMulai || !jamSelesai) {
      setConflictWarning(null);
      return;
    }

    const checkId = isMultiPerson ? (selectedPetugasIds[0] || '') : petugasId;
    if (!checkId) {
      setConflictWarning(null);
      return;
    }

    const check = ScheduleService.checkConflict(
      {
        id: editingSchedule?.id,
        hari,
        tanggal,
        jamMulai,
        jamSelesai,
        petugasId: checkId,
        ruangId,
      },
      allSchedules
    );

    if (check.hasConflict) {
      setConflictWarning(check.reason || 'Terdeteksi bentrok jadwal pada jam/lokasi tersebut.');
    } else {
      setConflictWarning(null);
    }
  }, [
    hari,
    tanggal,
    jamMulai,
    jamSelesai,
    petugasId,
    isMultiPerson,
    selectedPetugasIds,
    ruangId,
    editingSchedule,
    allSchedules,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruangId) return;

    const room = rooms.find((r) => r.id === ruangId);
    setIsSubmitting(true);

    try {
      if (!editingSchedule && isMultiPerson) {
        if (selectedPetugasIds.length === 0) return;

        const schedulesToCreate: ScheduleItem[] = selectedPetugasIds.map((uId, idx) => {
          const officer = candidates.find((c) => c.userId === uId);
          return {
            id: `sch-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            hari,
            tanggal,
            jamMulai,
            jamSelesai,
            petugasId: uId, // strictly users.id
            petugasName: officer ? officer.fullName : 'Petugas Guru',
            petugasRole: officer ? officer.role : 'GURU',
            ruangId,
            ruangName: room ? room.name : 'Pos Piket',
            status,
            keterangan: keterangan || 'Jadwal Penugasan Bersama',
          };
        });

        if (onSaveMultiple) {
          await onSaveMultiple(schedulesToCreate);
        } else {
          for (const s of schedulesToCreate) {
            await onSave(s);
          }
        }
      } else {
        if (!petugasId) return;

        const officer = candidates.find((c) => c.userId === petugasId);
        const scheduleData: ScheduleItem = {
          id: editingSchedule ? editingSchedule.id : `sch-${Date.now()}`,
          hari,
          tanggal,
          jamMulai,
          jamSelesai,
          petugasId, // strictly users.id
          petugasName: officer ? officer.fullName : editingSchedule?.petugasName || 'Petugas Guru',
          petugasRole: officer ? officer.role : editingSchedule?.petugasRole || 'GURU',
          ruangId,
          ruangName: room ? room.name : 'Pos Piket',
          status,
          keterangan,
        };
        await onSave(scheduleData);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSchedule ? 'Ubah Jadwal Piket' : 'Tambah Jadwal Piket Baru'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Conflict Warning Box */}
        {conflictWarning && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Peringatan Bentrok Jadwal!</span>
              <p className="mt-0.5">{conflictWarning}</p>
            </div>
          </div>
        )}

        {/* Loading / Empty Officer or Room warning */}
        {isLoadingData && (
          <div className="p-3 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)] text-xs flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Memuat data akun petugas dan ruangan pos piket...</span>
          </div>
        )}

        {!isLoadingData && candidates.length === 0 && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Belum Ada Akun Petugas Aktif</span>
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
              Sistem tidak menemukan akun pengguna aktif dengan role piket (Guru, Tendik, Satpam, Admin). Silakan daftarkan akun baru melalui menu <strong>Manajemen Pengguna</strong>.
            </p>
          </div>
        )}

        {!isLoadingData && rooms.length === 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Belum Ada Data Pos Piket / Ruangan</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Silakan tambahkan data pos piket terlebih dahulu melalui menu <strong>Data Master &gt; Ruangan</strong>.
            </p>
          </div>
        )}

        {/* Hari & Tanggal Acuan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Hari */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hari Piket
              </label>
              {!currentDayShift.isActive && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  (Non-aktif di Pengaturan)
                </span>
              )}
            </div>
            <select
              value={hari}
              onChange={(e) => handleDayChange(e.target.value as DayOfWeek)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              {DAYS_LIST.map((d) => {
                const isSunday = d === 'MINGGU';
                const isDayActive = isSunday
                  ? isSundayActiveInSettings
                  : (settings?.workHours?.dailySchedules?.[d]?.isActive ?? activeDays.includes(d));

                return (
                  <option key={d} value={d} disabled={isSunday && !isSundayActiveInSettings}>
                    {d} {isSunday && !isSundayActiveInSettings ? '(Non-aktif di Pengaturan)' : (!isDayActive ? '(Libur Shift)' : '')}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tanggal Acuan */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tanggal Acuan (Asia/Jakarta)
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
        </div>

        {/* Mode Selector for New Schedule */}
        {!editingSchedule && (
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setIsMultiPerson(false)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isMultiPerson
                  ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Satu Petugas
            </button>
            <button
              type="button"
              onClick={() => setIsMultiPerson(true)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isMultiPerson
                  ? 'bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Multi-Petugas (Banyak Akun Sekaligus)
            </button>
          </div>
        )}

        {/* Petugas Picker (Single vs Multi) */}
        {!isMultiPerson ? (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
              <span>Pilih Akun Petugas Piket (users.id)</span>
            </label>
            <select
              value={petugasId}
              onChange={(e) => setPetugasId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-medium"
            >
              {candidates.length === 0 ? (
                <option value="">-- Tidak ada akun petugas aktif --</option>
              ) : (
                candidates.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.displayLabel}
                  </option>
                ))
              )}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              * Petugas dipilih dari akun pengguna aktif. ID akun ({petugasId || 'users.id'}) tersimpan untuk otorisasi presensi mandiri dan dashboard guru.
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-3 rounded-xl border border-[var(--theme-primary-border)] bg-[var(--theme-primary-light)]/40 dark:bg-[var(--theme-primary-light)]/15">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--theme-primary)]" />
                <span>Pilih Akun Petugas ({selectedPetugasIds.length} terpilih)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllPetugas}
                className="text-[11px] font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] hover:underline cursor-pointer"
              >
                {selectedPetugasIds.length === candidates.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-[var(--theme-card-border)]">
              {candidates.map((c) => {
                const isChecked = selectedPetugasIds.includes(c.userId);
                return (
                  <div
                    key={c.userId}
                    onClick={() => togglePetugasSelect(c.userId)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] font-semibold border border-[var(--theme-primary-border)]'
                        : 'hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-subtle)] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[var(--theme-primary)] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{c.fullName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                      {c.loginId || c.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ruangan / Pos Picker */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            <span>Alokasi Pos / Area Pengawasan</span>
          </label>
          <select
            value={ruangId}
            onChange={(e) => setRuangId(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs font-medium"
          >
            {rooms.length === 0 ? (
              <option value="">-- Belum ada data pos/ruangan --</option>
            ) : (
              rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code} - {r.building})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Jam Mulai & Selesai */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
              <span>Jam Tugas Shift ({hari})</span>
            </label>
            {editingSchedule && (
              <button
                type="button"
                onClick={handleApplySchoolSettingsShift}
                className="text-[10px] font-bold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] hover:underline cursor-pointer flex items-center gap-1"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Terapkan Pengaturan Shift ({currentDayShift.start} - {currentDayShift.end})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">Jam Mulai</label>
              <input
                type="time"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">Jam Selesai</label>
              <input
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Status & Keterangan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ScheduleStatus)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="TERJADWAL">TERJADWAL</option>
              <option value="BERJALAN">BERJALAN</option>
              <option value="SELESAI">SELESAI</option>
              <option value="DIGANTIKAN">DIGANTIKAN</option>
              <option value="DIBATALKAN">DIBATALKAN</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catatan / Keterangan Tugas</label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Fokus gerbang utama pagi hari & penerimaan tamu"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={candidates.length === 0 || rooms.length === 0}
          >
            {editingSchedule ? 'Perbarui Jadwal' : 'Simpan Jadwal Piket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
