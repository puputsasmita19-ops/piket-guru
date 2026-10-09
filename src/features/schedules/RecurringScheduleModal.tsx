import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, SchoolSettings, UserProfile } from '../../types';
import { TeacherRecord, StaffRecord, RoomRecord } from '../../types/master.types';
import { DAYS_LIST } from '../../config/constants';
import { getTodayISODate } from '../../utils/dateUtils';
import { buildOfficerCandidates, OfficerCandidate } from '../../utils/scheduleUtils';
import { CalendarRange, Sparkles, CheckSquare, Square, AlertTriangle } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      const initDays = activeDaysInSettings.filter((d) => d !== 'MINGGU' || isSundayActiveInSettings);
      setSelectedDays(initDays.length > 0 ? initDays : ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
      setJamMulai(settings?.workHours?.start || '06:30');
      setJamSelesai(settings?.workHours?.end || '15:30');
    }
  }, [isOpen, settings, activeDaysInSettings, isSundayActiveInSettings]);

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleGenerate = async () => {
    if (selectedDays.length === 0 || candidates.length === 0 || rooms.length === 0) return;

    setIsGenerating(true);
    const newSchedules: ScheduleItem[] = [];
    const todayISO = getTodayISODate();

    // Round-robin distribution of officer candidates to rooms across selected days
    let officerIndex = 0;

    selectedDays.forEach((day) => {
      rooms.forEach((room) => {
        const officer = candidates[officerIndex % candidates.length];
        officerIndex++;

        newSchedules.push({
          id: `sch-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          hari: day,
          tanggal: todayISO,
          jamMulai,
          jamSelesai,
          petugasId: officer.userId, // strictly users.id
          petugasName: officer.fullName,
          petugasRole: officer.role,
          ruangId: room.id,
          ruangName: room.name,
          status: 'TERJADWAL',
          keterangan: 'Jadwal Rutin Mingguan',
        });
      });
    });

    try {
      await onGenerate(newSchedules);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generator Jadwal Piket Otomatis (Recurring)"
      maxWidth="md"
    >
      <div className="space-y-5">
        <div className="p-3.5 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)] text-xs flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-[var(--theme-primary)] flex-shrink-0" />
          <div>
            <span className="font-bold block">Alokasi Otomatis Akun Petugas ke Pos Piket</span>
            <p className="mt-0.5">
              Sistem akan mendistribusikan {candidates.length} akun petugas aktif secara merata ke {rooms.length} pos piket untuk hari-hari yang Anda pilih. ID akun tersimpan secara atomik untuk presensi.
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
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isGenerating}
            disabled={candidates.length === 0 || rooms.length === 0 || selectedDays.length === 0}
            onClick={handleGenerate}
            leftIcon={<CalendarRange className="w-4 h-4" />}
          >
            Generate Jadwal Mingguan
          </Button>
        </div>
      </div>
    </Modal>
  );
};
