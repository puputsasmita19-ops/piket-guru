import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, ScheduleStatus } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { DAYS_LIST } from '../../config/constants';
import { AlertTriangle, Clock, MapPin, User, Calendar } from 'lucide-react';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: ScheduleItem) => Promise<void>;
  editingSchedule: ScheduleItem | null;
  teachers: TeacherRecord[];
  rooms: RoomRecord[];
  allSchedules: ScheduleItem[];
  defaultDay: DayOfWeek;
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSchedule,
  teachers,
  rooms,
  allSchedules,
  defaultDay,
}) => {
  const [hari, setHari] = useState<DayOfWeek>(defaultDay);
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [jamMulai, setJamMulai] = useState<string>('06:30');
  const [jamSelesai, setJamSelesai] = useState<string>('15:30');
  const [petugasId, setPetugasId] = useState<string>('');
  const [ruangId, setRuangId] = useState<string>('');
  const [status, setStatus] = useState<ScheduleStatus>('TERJADWAL');
  const [keterangan, setKeterangan] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingSchedule) {
      setHari(editingSchedule.hari);
      setTanggal(editingSchedule.tanggal);
      setJamMulai(editingSchedule.jamMulai);
      setJamSelesai(editingSchedule.jamSelesai);
      setPetugasId(editingSchedule.petugasId);
      setRuangId(editingSchedule.ruangId);
      setStatus(editingSchedule.status);
      setKeterangan(editingSchedule.keterangan || '');
    } else {
      setHari(defaultDay);
      setTanggal(new Date().toISOString().split('T')[0]);
      setJamMulai('06:30');
      setJamSelesai('15:30');
      setPetugasId(teachers[0]?.id || '');
      setRuangId(rooms[0]?.id || '');
      setStatus('TERJADWAL');
      setKeterangan('');
    }
  }, [editingSchedule, defaultDay, teachers, rooms, isOpen]);

  // Live Conflict Checking
  useEffect(() => {
    if (!petugasId || !ruangId || !hari || !jamMulai || !jamSelesai) {
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
        petugasId,
        ruangId,
      },
      allSchedules
    );

    if (check.hasConflict) {
      setConflictWarning(check.reason || 'Terdeteksi bentrok jadwal pada jam/lokasi tersebut.');
    } else {
      setConflictWarning(null);
    }
  }, [hari, tanggal, jamMulai, jamSelesai, petugasId, ruangId, editingSchedule, allSchedules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petugasId || !ruangId) return;

    const teacher = teachers.find((t) => t.id === petugasId);
    const room = rooms.find((r) => r.id === ruangId);

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

    setIsSubmitting(true);
    try {
      await onSave(scheduleData);
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

        {/* Petugas Picker */}
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
