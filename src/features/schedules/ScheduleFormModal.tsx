import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DialogForm } from '../../components/common/DialogForm';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ScheduleItem, DayOfWeek, SchoolSettings, UserProfile } from '../../types';
import { TeacherRecord, StaffRecord, RoomRecord } from '../../types/master.types';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { DAYS_LIST } from '../../config/constants';
import { getTodayISODate, getCurrentDayName } from '../../utils/dateUtils';
import { buildOfficerCandidates, getShiftHoursForDay, getScheduleRecurrence, scheduleSlotId } from '../../utils/scheduleUtils';
import { OfficerPicker } from './OfficerPicker';

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
const fieldClass = 'w-full min-h-11 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({ isOpen, onClose, onSave, onSaveMultiple, editingSchedule, users, teachers = [], staff = [], rooms, allSchedules, defaultDay, settings, isLoadingData = false, initialMultiPerson = false }) => {
  const candidates = useMemo(() => buildOfficerCandidates(users, teachers, staff), [users, teachers, staff]);
  const activeRooms = rooms.filter(r => r.isActive !== false);
  const [days, setDays] = useState<DayOfWeek[]>([defaultDay]);
  const [tanggal, setTanggal] = useState(getTodayISODate());
  const [recurrence, setRecurrence] = useState<'WEEKLY' | 'ONCE'>('WEEKLY');
  const [jamMulai, setJamMulai] = useState('06:30');
  const [jamSelesai, setJamSelesai] = useState('15:30');
  const [isMultiPerson, setIsMultiPerson] = useState(initialMultiPerson);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ruangId, setRuangId] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const initialized = useRef('');
  const editId = editingSchedule?.id || 'new';
  useEffect(() => {
    if (!isOpen) { initialized.current = ''; return; }
    if (initialized.current === editId) return;
    initialized.current = editId;
    const day = editingSchedule?.hari || (getShiftHoursForDay(defaultDay, settings).isActive ? defaultDay : DAYS_LIST.find(d => getShiftHoursForDay(d, settings).isActive) || defaultDay);
    const shift = getShiftHoursForDay(day, settings);
    setDays([day]); setTanggal(editingSchedule?.tanggal || getTodayISODate());
    setRecurrence(getScheduleRecurrence(editingSchedule || {}));
    setJamMulai(editingSchedule?.jamMulai || shift.start); setJamSelesai(editingSchedule?.jamSelesai || shift.end);
    setSelectedIds(editingSchedule ? [editingSchedule.petugasId] : []);
    setRuangId(editingSchedule?.ruangId || '');
    setKeterangan(editingSchedule?.keterangan || ''); setIsMultiPerson(!editingSchedule && initialMultiPerson);
    setError(''); setInfo('');
  }, [isOpen, editId, defaultDay, settings, editingSchedule, initialMultiPerson]);

  const effectiveDays = recurrence === 'ONCE' ? [getCurrentDayName(`${tanggal}T12:00:00+07:00`)] : days;
  const drafts = useMemo<ScheduleItem[]>(() => effectiveDays.flatMap(hari => selectedIds.map(petugasId => {
    const officer = candidates.find(c => c.userId === petugasId);
    const room = rooms.find(r => r.id === ruangId);
    const item: ScheduleItem = { ...(editingSchedule || {}), id: editingSchedule?.id || '', hari,
      recurrence, tanggal: recurrence === 'ONCE' ? tanggal : '', jamMulai, jamSelesai, petugasId,
      petugasName: officer?.fullName || editingSchedule?.petugasName || '', petugasRole: officer?.role || editingSchedule?.petugasRole || 'GURU',
      ruangId, ruangName: room?.name || '', status: 'TERJADWAL', keterangan };
    if (!editingSchedule) item.id = scheduleSlotId(item);
    return item;
  })), [effectiveDays.join(','), selectedIds, candidates, rooms, ruangId, recurrence, tanggal, jamMulai, jamSelesai, keterangan, editingSchedule]);
  const conflicts = drafts.filter(s => s.status !== 'DIBATALKAN').map(s => ScheduleService.checkConflict(s, allSchedules)).filter(c => c.hasConflict);
  const changeDay = (day: DayOfWeek) => {
    setDays(prev => editingSchedule ? [day] : prev.includes(day) ? prev.filter(d => d !== day) : DAYS_LIST.filter(d => d === day || prev.includes(d)));
    if (!editingSchedule && days.length <= 1) {
      const shift = getShiftHoursForDay(day, settings); setJamMulai(shift.start); setJamSelesai(shift.end);
    }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (editingSchedule?.status === 'DIBATALKAN') {
      setError('Jadwal dibatalkan. Aktifkan kembali dari daftar jadwal sebelum mengedit.');
      return;
    }
    setError(''); setInfo('');
    if (!drafts.length) { setError('Pilih minimal satu hari dan satu petugas.'); return; }
    if (!activeRooms.some(r => r.id === ruangId)) { setError('Pilih pos piket yang masih aktif.'); return; }
    if (selectedIds.some(id => !candidates.some(c => c.userId === id))) { setError('Ada petugas yang sudah tidak aktif. Pilih kembali petugas.'); return; }
    if (jamMulai >= jamSelesai) { setError('Jam selesai harus setelah jam mulai.'); return; }
    if (recurrence === 'ONCE' && !tanggal) { setError('Tanggal jadwal wajib diisi.'); return; }
    if (conflicts.length) { setError(conflicts[0].reason || 'Jadwal petugas bentrok.'); return; }
    submitting.current = true; setBusy(true);
    try {
      if (!editingSchedule && onSaveMultiple) await onSaveMultiple(drafts);
      else if (drafts.length === 1) await onSave(drafts[0]);
      else throw new Error('Penyimpanan beberapa jadwal belum tersedia. Buka kembali menu Jadwal.');
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Jadwal belum tersimpan. Periksa koneksi lalu coba lagi.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const applyShift = async () => {
    setInfo('');
    try {
      const latest = await FirestoreService.getByIdStrict<SchoolSettings>('settings', 'school_config');
      const shift = getShiftHoursForDay(effectiveDays[0] || defaultDay, latest || settings);
      setJamMulai(shift.start); setJamSelesai(shift.end);
      setInfo('Jam sekolah terbaru sudah diisi. Simpan jadwal untuk menerapkannya.');
    } catch { setError('Pengaturan jam terbaru belum dapat dibaca. Periksa koneksi lalu coba lagi.'); }
  };
  const close = () => { if (!submitting.current) onClose(); };
  return <Modal isOpen={isOpen} onClose={close} title={editingSchedule ? 'Ubah Jadwal Piket' : 'Tambah Jadwal Piket'} maxWidth="lg">
    <DialogForm onSubmit={submit} className="space-y-4" actions={<div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={close}>Batal</Button><Button type="submit" size="sm" isLoading={busy} disabled={busy || isLoadingData || !drafts.length || !ruangId}>{editingSchedule ? 'Perbarui Jadwal' : `Simpan ${drafts.length || ''} Jadwal`}</Button></div>}>
      {error && <p role="alert" tabIndex={-1} className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-sm">{error}</p>}
      {info && <p role="status" className="text-sm p-3 bg-[var(--theme-primary-light)] rounded-xl">{info}</p>}
      <fieldset disabled={busy} className="space-y-4 min-w-0">
        <label className="block space-y-1 text-xs font-semibold">Pengulangan jadwal<select aria-label="Pengulangan jadwal" value={recurrence} onChange={e => setRecurrence(e.target.value as 'WEEKLY' | 'ONCE')} className={fieldClass}><option value="WEEKLY">Berulang setiap minggu</option><option value="ONCE">Sekali pada tanggal tertentu</option></select></label>
        {recurrence === 'WEEKLY' ? <fieldset className="space-y-2"><legend className="text-xs font-semibold mb-2">Hari piket {editingSchedule ? '' : '(boleh lebih dari satu)'}</legend><div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{DAYS_LIST.map(day => <label key={day} className="min-h-11 flex items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"><input aria-label={`Hari ${day}`} type={editingSchedule ? 'radio' : 'checkbox'} name="duty-days" disabled={day === 'MINGGU' && !getShiftHoursForDay(day, settings).isActive && !days.includes(day)} checked={days.includes(day)} onChange={() => changeDay(day)} />{day}</label>)}</div><p className="text-xs text-slate-500 dark:text-slate-400">Berlaku setiap minggu sampai diubah, dibatalkan, atau dihapus. Tidak perlu membuat jadwal baru setiap Senin.</p>{effectiveDays.some(d => !getShiftHoursForDay(d, settings).isActive) && <p className="text-xs text-amber-700 dark:text-amber-300">Ada hari di luar hari kerja sekolah. Jadwal ini tetap menjadi penugasan khusus pada hari tersebut.</p>}</fieldset> : <label className="block space-y-1 text-xs font-semibold">Tanggal tugas<input aria-label="Tanggal tugas" type="date" required value={tanggal} onChange={e => setTanggal(e.target.value)} className={fieldClass} /><span className="text-xs text-slate-500">Hari: {effectiveDays[0]}. Tidak berulang pada minggu berikutnya.</span></label>}
        {!editingSchedule && <div className="flex flex-wrap gap-2" role="group" aria-label="Mode petugas"><Button type="button" size="sm" variant={!isMultiPerson ? 'primary' : 'outline'} onClick={() => { setIsMultiPerson(false); setSelectedIds(ids => ids.slice(0, 1)); }}>Satu petugas</Button><Button type="button" size="sm" variant={isMultiPerson ? 'primary' : 'outline'} onClick={() => setIsMultiPerson(true)}>Multi-petugas</Button></div>}
        {isLoadingData && <p role="status" className="text-xs text-slate-500">Memuat data jadwal…</p>}
        <OfficerPicker candidates={candidates} selected={selectedIds} onChange={setSelectedIds} multiple={isMultiPerson} disabled={busy} />
        <label className="block space-y-1 text-xs font-semibold">Pos / area pengawasan<select aria-label="Pos piket" value={ruangId} required onChange={e => setRuangId(e.target.value)} className={fieldClass}><option value="">Pilih pos piket</option>{activeRooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        {!activeRooms.length && <p className="text-sm text-amber-700 dark:text-amber-300">Belum ada pos aktif. Tambahkan melalui Data Master → Ruangan.</p>}
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-xs font-semibold">Jam mulai<input aria-label="Jam mulai" type="time" required value={jamMulai} onChange={e => setJamMulai(e.target.value)} className={fieldClass} /></label><label className="space-y-1 text-xs font-semibold">Jam selesai<input aria-label="Jam selesai" type="time" required value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} className={fieldClass} /></label></div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Jam di atas berlaku untuk semua hari dan petugas yang dipilih. Gunakan formulir terpisah bila jam tugas berbeda.</p>
        <button type="button" onClick={applyShift} className="min-h-9 text-xs underline underline-offset-2">Gunakan jam sekolah terbaru ({effectiveDays[0] || defaultDay})</button>
        <p className="text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Status tugas otomatis mengikuti presensi masuk/pulang. Gunakan tombol <strong>Berhalangan</strong> atau <strong>Batalkan</strong> pada Jadwal Piket untuk kondisi khusus.</p>
        <label className="block space-y-1 text-xs font-semibold">Catatan tugas<input aria-label="Catatan tugas" value={keterangan} onChange={e => setKeterangan(e.target.value)} className={fieldClass} placeholder="Opsional" /></label>
        {conflicts.length > 0 && <p className="text-sm text-amber-800 dark:text-amber-200">{conflicts[0].reason}</p>}
        <p role="status" className="text-sm font-medium">{selectedIds.length} petugas × {effectiveDays.length} hari = {drafts.length} jadwal. Beberapa petugas dapat menempati pos yang sama.</p>
        {editingSchedule && <p className="text-xs text-slate-500">Perubahan ini hanya memperbarui satu jadwal. Gunakan Tambah Jadwal untuk menugaskan guru yang sama pada hari lain.</p>}
      </fieldset>
    </DialogForm>
  </Modal>;
};
