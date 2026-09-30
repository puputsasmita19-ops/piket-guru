import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, ScheduleStatus } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { DAYS_LIST } from '../../config/constants';
import { AlertTriangle, Clock, MapPin, User, Calendar, Users, CheckSquare, Square } from 'lucide-react';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: ScheduleItem) => Promise<void>;
  onSaveMultiple?: (schedules: ScheduleItem[]) => Promise<void>;
  editingSchedule: ScheduleItem | null;
  teachers: TeacherRecord[];
  rooms: RoomRecord[];
  allSchedules: ScheduleItem[];
  defaultDay: DayOfWeek;
  initialMultiPerson?: boolean;
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveMultiple,
  editingSchedule,
  teachers,
  rooms,
  allSchedules,
  defaultDay,
  initialMultiPerson = false,
}) => {
  const [hari, setHari] = useState<DayOfWeek>(defaultDay);
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
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

  useEffect(() => {
    if (editingSchedule) {
      setIsMultiPerson(false);
      setHari(editingSchedule.hari);
      setTanggal(editingSchedule.tanggal);
      setJamMulai(editingSchedule.jamMulai);
      setJamSelesai(editingSchedule.jamSelesai);
      setPetugasId(editingSchedule.petugasId);
      setSelectedPetugasIds([editingSchedule.petugasId]);
      setRuangId(editingSchedule.ruangId);
      setStatus(editingSchedule.status);
      setKeterangan(editingSchedule.keterangan || '');
    } else {
      setIsMultiPerson(!!initialMultiPerson);
      setHari(defaultDay);
      setTanggal(new Date().toISOString().split('T')[0]);
      setJamMulai('06:30');
      setJamSelesai('15:30');
      setPetugasId(teachers[0]?.id || '');
      setSelectedPetugasIds(teachers[0]?.id ? [teachers[0].id] : []);
      setRuangId(rooms[0]?.id || '');
      setStatus('TERJADWAL');
      setKeterangan('');
    }
  }, [editingSchedule, defaultDay, teachers, rooms, isOpen, initialMultiPerson]);

  const toggleTeacherSelect = (id: string) => {
    if (selectedPetugasIds.includes(id)) {
      setSelectedPetugasIds(selectedPetugasIds.filter((tId) => tId !== id));
    } else {
      setSelectedPetugasIds([...selectedPetugasIds, id]);
    }
  };

  const handleSelectAllTeachers = () => {
    if (selectedPetugasIds.length === teachers.length) {
      setSelectedPetugasIds([]);
    } else {
      setSelectedPetugasIds(teachers.map((t) => t.id));
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
  }, [hari, tanggal, jamMulai, jamSelesai, petugasId, isMultiPerson, selectedPetugasIds, ruangId, editingSchedule, allSchedules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruangId) return;

    const room = rooms.find((r) => r.id === ruangId);
    setIsSubmitting(true);

    try {
      if (!editingSchedule && isMultiPerson) {
        if (selectedPetugasIds.length === 0) return;
        const schedulesToCreate: ScheduleItem[] = selectedPetugasIds.map((tId, idx) => {
          const teacher = teachers.find((t) => t.id === tId);
          return {
            id: `sch-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            hari,
            tanggal,
            jamMulai,
            jamSelesai,
            petugasId: tId,
            petugasName: teacher ? teacher.fullName : 'Petugas Guru',
            petugasRole: 'GURU',
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
        const teacher = teachers.find((t) => t.id === petugasId);
        const scheduleData: ScheduleItem = {
          id: editingSchedule ? editingSchedule.id : `sch-${Date.now()}`,
          hari,
          tanggal,
          jamMulai,
          jamSelesai,
          petugasId,
          petugasName: teacher ? teacher.fullName : 'Petugas Guru',
          petugasRole: 'GURU',
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Hari */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Hari Piket</label>
            <select
              value={hari}
              onChange={(e) => setHari(e.target.value as DayOfWeek)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              {DAYS_LIST.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Acuan</label>
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
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
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
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Multi-Petugas (Banyak Guru Sekaligus)
            </button>
          </div>
        )}

        {/* Petugas Picker (Single vs Multi) */}
        {!isMultiPerson ? (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>Pilih Guru / Petugas Piket</span>
            </label>
            <select
              value={petugasId}
              onChange={(e) => setPetugasId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} (NIP: {t.nip} • {t.mataPelajaran})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2 p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Pilih Guru Bertugas ({selectedPetugasIds.length} terpilih)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllTeachers}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {selectedPetugasIds.length === teachers.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
              {teachers.map((t) => {
                const isChecked = selectedPetugasIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleTeacherSelect(t.id)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-100/70 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{t.fullName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{t.mataPelajaran}</span>
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
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code} - {r.building})
              </option>
            ))}
          </select>
        </div>

        {/* Jam Mulai & Selesai */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              placeholder="Contoh: Fokus gerbang utama pagi hari"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {editingSchedule ? 'Perbarui Jadwal' : 'Simpan Jadwal Piket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
