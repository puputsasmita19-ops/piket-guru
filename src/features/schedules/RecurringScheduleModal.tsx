import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';
import { DAYS_LIST } from '../../config/constants';
import { CalendarRange, Sparkles, CheckSquare, Square } from 'lucide-react';

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (newSchedules: ScheduleItem[]) => Promise<void>;
  teachers: TeacherRecord[];
  rooms: RoomRecord[];
}

export const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  teachers,
  rooms,
}) => {
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']);
  const [jamMulai, setJamMulai] = useState('06:30');
  const [jamSelesai, setJamSelesai] = useState('15:30');
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleGenerate = async () => {
    if (selectedDays.length === 0 || teachers.length === 0 || rooms.length === 0) return;

    setIsGenerating(true);
    const newSchedules: ScheduleItem[] = [];
    const todayISO = new Date().toISOString().split('T')[0];

    // Round-robin distribution of teachers to rooms across selected days
    let teacherIndex = 0;

    selectedDays.forEach((day) => {
      rooms.forEach((room) => {
        const teacher = teachers[teacherIndex % teachers.length];
        teacherIndex++;

        newSchedules.push({
          id: `sch-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          hari: day,
          tanggal: todayISO,
          jamMulai,
          jamSelesai,
          petugasId: teacher.id,
          petugasName: teacher.fullName,
          petugasRole: 'GURU',
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
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <span className="font-bold block">Alokasi Otomatis Guru ke Pos Piket</span>
            <p className="mt-0.5">
              Sistem akan mendistribusikan {teachers.length} guru secara merata ke {rooms.length} pos piket untuk hari-hari yang Anda pilih tanpa konflik waktu.
            </p>
          </div>
        </div>

        {/* Day selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-900 dark:text-white block">
            Pilih Hari Kerja Piket:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DAYS_LIST.map((day) => {
              const isSelected = selectedDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span>{day}</span>
                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-40" />}
                </button>
              );
            })}
          </div>
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
