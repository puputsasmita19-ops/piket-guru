import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, SchoolSettings, UserProfile } from '../../types';
import { TeacherRecord, StaffRecord, RoomRecord } from '../../types/master.types';
import { DAYS_LIST } from '../../config/constants';
import { OfficerPicker } from './OfficerPicker';
import { buildOfficerCandidates, OfficerCandidate, scheduleSlotId } from '../../utils/scheduleUtils';
import { CalendarRange, Sparkles, CheckSquare, Square, AlertTriangle } from '../../components/icons';

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (newSchedules: ScheduleItem[]) => Promise<void>;
  users: UserProfile[];
  teachers?: TeacherRecord[];
  staff?: StaffRecord[];
  rooms: RoomRecord[];
  settings?: SchoolSettings;
}

export const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  users,
  teachers = [],
  staff = [],
  rooms,
  settings,
}) => {
  const candidates: OfficerCandidate[] = useMemo(() => {
    return buildOfficerCandidates(users, teachers, staff);
  }, [users, teachers, staff]);

  const activeDaysInSettings: DayOfWeek[] = useMemo(() => {
    if (settings?.workHours?.activeDays && settings.workHours.activeDays.length > 0) {
      return settings.workHours.activeDays;
    }
    return ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
  }, [settings]);

  const isSundayActiveInSettings = useMemo(() => {
    if (settings?.workHours?.dailySchedules?.['MINGGU']?.isActive !== undefined) {
      return settings.workHours.dailySchedules['MINGGU'].isActive;
    }
    return activeDaysInSettings.includes('MINGGU');
  }, [settings, activeDaysInSettings]);

  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
  const [jamMulai, setJamMulai] = useState('06:30');
  const [jamSelesai, setJamSelesai] = useState('15:30');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOfficers, setSelectedOfficers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const generating = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!isOpen) { initialized.current = false; return; }
    if (!initialized.current && candidates.length) {
      initialized.current = true;
      setSelectedOfficers(candidates.map(c => c.userId));
      setError('');
      const initDays = activeDaysInSettings.filter((d) => d !== 'MINGGU' || isSundayActiveInSettings);
      setSelectedDays(initDays.length > 0 ? initDays : ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
      setJamMulai(settings?.workHours?.start || '06:30');
      setJamSelesai(settings?.workHours?.end || '15:30');
    }
  }, [isOpen, settings, activeDaysInSettings, isSundayActiveInSettings, candidates]);

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleGenerate = async () => {
    if (generating.current) return;
    const chosen = candidates.filter(c => selectedOfficers.includes(c.userId));
    const activeRooms = rooms.filter(r => r.isActive !== false);
    setError('');
    if (!selectedDays.length || !chosen.length || !activeRooms.length) { setError('Pilih hari, petugas aktif, dan pos aktif.'); return; }
    if (jamMulai >= jamSelesai) { setError('Jam selesai harus setelah jam mulai.'); return; }
    if (chosen.length < activeRooms.length) { setError('Jumlah petugas harus mencukupi jumlah pos agar satu orang tidak bertugas di beberapa pos pada jam yang sama.'); return; }
    generating.current = true;

    setIsGenerating(true);
    const newSchedules: ScheduleItem[] = [];


    // Round-robin distribution of officer candidates to rooms across selected days
    let officerIndex = 0;

    selectedDays.forEach((day) => {
      activeRooms.forEach((room) => {
        const officer = chosen[officerIndex % chosen.length];
        officerIndex++;

        const item: ScheduleItem = {
          id: `sch-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          hari: day,
          tanggal: '',
          recurrence: 'WEEKLY',
          jamMulai,
          jamSelesai,
          petugasId: officer.userId, // strictly users.id
          petugasName: officer.fullName,
          petugasRole: officer.role,
          ruangId: room.id,
          ruangName: room.name,
          status: 'TERJADWAL',
          keterangan: 'Jadwal Rutin Mingguan',
        };
        item.id = scheduleSlotId(item);
        newSchedules.push(item);
      });
    });

    try {
      await onGenerate(newSchedules);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Jadwal belum tersimpan. Periksa koneksi lalu coba lagi.');
    } finally {
      generating.current = false;
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!generating.current) onClose(); }}
      title="Alokasi Jadwal Mingguan Otomatis"
      maxWidth="md"
    >
      <fieldset disabled={isGenerating} className="space-y-5 min-w-0">
        {error && <p role="alert" tabIndex={-1} className="text-sm rounded-xl p-3 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
        <OfficerPicker candidates={candidates} selected={selectedOfficers} onChange={setSelectedOfficers} multiple disabled={isGenerating} />
        <div className="p-3.5 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)] text-xs flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-[var(--theme-primary)] flex-shrink-0" />
          <div>
            <span className="font-bold block">Alokasi Otomatis Akun Petugas ke Pos Piket</span>
            <p className="mt-0.5">
              Sistem mendistribusikan {selectedOfficers.length} petugas terpilih ke pos aktif pada hari yang Anda pilih. Jadwal berulang setiap minggu sampai diubah atau dihapus. Untuk menugaskan beberapa petugas pada pos yang sama, gunakan Tambah Jadwal → Multi-petugas.
            </p>
          </div>
        </div>

        {candidates.length === 0 && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Belum ada akun petugas aktif. Daftarkan akun di Manajemen Pengguna.</span>
          </div>
        )}

        {rooms.length === 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Belum ada ruangan/pos. Tambahkan ruangan di Data Master &gt; Ruangan.</span>
          </div>
        )}

        {/* Day selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-900 dark:text-white block">
            Pilih Hari Kerja Piket:
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {DAYS_LIST.map((day) => {
              const isSunday = day === 'MINGGU';
              const isSundayDisabled = isSunday && !isSundayActiveInSettings;
              const isSelected = selectedDays.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isSundayDisabled}
                  onClick={() => toggleDay(day)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSundayDisabled
                      ? 'opacity-40 bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-400 cursor-not-allowed border-dashed'
                      : isSelected
                      ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)] border-[var(--theme-primary)] shadow-xs'
                      : 'bg-white dark:bg-[var(--theme-card-bg)] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[var(--theme-card-border)]'
                  }`}
                >
                  <span className="text-[11px]">{day}</span>
                  {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-40" />}
                </button>
              );
            })}
          </div>
          {!isSundayActiveInSettings && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              * Hari Minggu berstatus nonaktif di Pengaturan Sekolah. Aktifkan di menu Pengaturan jika ingin menjadwalkan hari Minggu.
            </p>
          )}
        </div>

        {/* Hours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jam Mulai</label>
            <input
              type="time"
              value={jamMulai}
              onChange={(e) => setJamMulai(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jam Selesai</label>
            <input
              type="time"
              value={jamSelesai}
              onChange={(e) => setJamSelesai(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" disabled={isGenerating} onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isGenerating}
            disabled={isGenerating || !selectedOfficers.length || !rooms.some(r => r.isActive !== false) || !selectedDays.length}
            onClick={handleGenerate}
            leftIcon={<CalendarRange className="w-4 h-4" />}
          >
            Generate Jadwal Mingguan
          </Button>
        </div>
      </fieldset>
    </Modal>
  );
};
