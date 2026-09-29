import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Search,
  Clock,
  MapPin,
  User,
  Edit2,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  CalendarRange,
  Layers,
  LayoutGrid,
  List,
  MessageSquare,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { WhatsAppModal } from '../../components/common/WhatsAppModal';
import { DAYS_LIST, DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { DayOfWeek, ScheduleItem, ScheduleStatus, SchoolSettings } from '../../types';
import { TeacherRecord, RoomRecord } from '../../types/master.types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { ScheduleService } from '../../services/firebase/scheduleService';
import { WhatsAppService } from '../../services/notifications/whatsappService';
import { ScheduleFormModal } from './ScheduleFormModal';
import { RecurringScheduleModal } from './RecurringScheduleModal';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrentDayName } from '../../utils/dateUtils';

export const SchedulePreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => {
    const today = getCurrentDayName() as DayOfWeek;
    return DAYS_LIST.includes(today) ? today : 'SENIN';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState<ScheduleItem | null>(null);

  // WhatsApp reminder modal
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    phone: string;
    message: string;
    title: string;
  }>({
    isOpen: false,
    phone: '',
    message: '',
    title: '',
  });

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSchedules = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', (data) => {
      setSchedules(data);
      setIsLoading(false);
    });

    const unsubTeachers = FirestoreService.subscribeToCollection<TeacherRecord>('teachers', (data) => {
      setTeachers(data);
    });

    const unsubRooms = FirestoreService.subscribeToCollection<RoomRecord>('rooms', (data) => {
      setRooms(data);
    });

    return () => {
      unsubSchedules();
      unsubTeachers();
      unsubRooms();
    };
  }, []);

  // Bootstrap seed if empty
  useEffect(() => {
    if (teachers.length > 0 && rooms.length > 0 && schedules.length === 0) {
      ScheduleService.bootstrapIfEmpty(teachers, rooms);
    }
  }, [teachers, rooms, schedules.length]);

  // Trigger WhatsApp Reminder
  const handleTriggerWaReminder = (schedule: ScheduleItem) => {
    const teacher = teachers.find((t) => t.id === schedule.petugasId || t.fullName === schedule.petugasName);
    const msg = WhatsAppService.getScheduleReminderMessage(schedule, settings.schoolName);
    setWaModalData({
      isOpen: true,
      phone: teacher?.phone || '',
      message: msg,
      title: `Kirim Pengingat Tugas Piket: ${schedule.petugasName}`,
    });
  };

  // Save / Update Schedule
  const handleSaveSchedule = async (scheduleData: ScheduleItem) => {
    await FirestoreService.setDocument('schedules', scheduleData.id, scheduleData);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: editingSchedule ? 'UPDATE' : 'CREATE',
      module: 'SCHEDULES',
      recordId: scheduleData.id,
      details: `${editingSchedule ? 'Memperbarui' : 'Menambahkan'} jadwal piket: ${scheduleData.petugasName} (${scheduleData.hari} di ${scheduleData.ruangName})`,
    });
  };

  // Generate Recurring Schedules
  const handleGenerateRecurring = async (newSchedules: ScheduleItem[]) => {
    for (const item of newSchedules) {
      await FirestoreService.setDocument('schedules', item.id, item);
    }
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'CREATE',
      module: 'SCHEDULES',
      details: `Menjalankan generator otomatis membuat ${newSchedules.length} alokasi jadwal piket mingguan.`,
    });
  };

  // Delete Schedule
  const handleDeleteSchedule = async () => {
    if (!deleteConfirmSchedule) return;
    await FirestoreService.deleteDocument('schedules', deleteConfirmSchedule.id);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Admin',
      role: currentUser?.role || 'ADMIN',
      action: 'DELETE',
      module: 'SCHEDULES',
      recordId: deleteConfirmSchedule.id,
      details: `Menghapus jadwal piket: ${deleteConfirmSchedule.petugasName} (${deleteConfirmSchedule.hari})`,
    });
    setDeleteConfirmSchedule(null);
  };

  // Update Status Quick Toggle
  const handleQuickStatusChange = async (schedule: ScheduleItem, newStatus: ScheduleStatus) => {
    const updated = { ...schedule, status: newStatus };
    await FirestoreService.setDocument('schedules', schedule.id, updated);
    await FirestoreService.logAudit({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.fullName || 'Petugas',
      role: currentUser?.role || 'GURU',
      action: 'STATUS_CHANGE',
      module: 'SCHEDULES',
      recordId: schedule.id,
      details: `Mengubah status jadwal ${schedule.petugasName} menjadi ${newStatus}`,
    });
  };

  // Filtered list
  const filtered = schedules.filter((s) => {
    const matchDay = s.hari === selectedDay;
    const matchStatus = statusFilter === 'SEMUA' || s.status === statusFilter;
    const matchSearch =
      s.petugasName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ruangName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.keterangan && s.keterangan.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchDay && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Jadwal Piket Guru & Staff
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Alokasi shift pengawasan, deteksi bentrok real-time, dan generator jadwal mingguan
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4 text-blue-500" />}
              onClick={() => setIsRecurringModalOpen(true)}
            >
              Generate Otomatis
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEditingSchedule(null);
                setIsFormModalOpen(true);
              }}
            >
              + Buat Jadwal
            </Button>
          </div>
        )}
      </div>

      {/* Filter Tabs by Day of Week */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {DAYS_LIST.map((day) => {
          const isToday = getCurrentDayName() === day;
          const count = schedules.filter((s) => s.hari === day).length;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{day}</span>
              {isToday && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                  HARI INI
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Status Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari guru, ruangan, atau catatan..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="TERJADWAL">TERJADWAL</option>
                <option value="BERJALAN">BERJALAN</option>
                <option value="SELESAI">SELESAI</option>
                <option value="DIGANTIKAN">DIGANTIKAN</option>
                <option value="DIBATALKAN">DIBATALKAN</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 shadow-xs text-blue-600' : 'text-slate-400'}`}
                  title="Tampilan Kartu"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-slate-800 shadow-xs text-blue-600' : 'text-slate-400'}`}
                  title="Tampilan Tabel"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCHEDULE VIEW: GRID */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <Card key={item.id} hoverable className="transition-all">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm shadow-inner flex-shrink-0">
                      {item.petugasName.charAt(0)}
                    </div>
                    <Badge
                      variant={
                        item.status === 'BERJALAN'
                          ? 'success'
                          : item.status === 'SELESAI'
                          ? 'info'
                          : item.status === 'DIGANTIKAN'
                          ? 'warning'
                          : item.status === 'DIBATALKAN'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {item.petugasName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{item.ruangName}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-mono">{item.jamMulai} - {item.jamSelesai} WIB</span>
                    </div>
                    {item.keterangan && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                        "{item.keterangan}"
                      </p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <select
                      value={item.status}
                      onChange={(e) => handleQuickStatusChange(item, e.target.value as ScheduleStatus)}
                      className="text-[11px] font-semibold p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                    >
                      <option value="TERJADWAL">TERJADWAL</option>
                      <option value="BERJALAN">BERJALAN</option>
                      <option value="SELESAI">SELESAI</option>
                      <option value="DIGANTIKAN">DIGANTIKAN</option>
                      <option value="DIBATALKAN">DIBATALKAN</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTriggerWaReminder(item)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer"
                        title="Kirim Notifikasi WA"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setEditingSchedule(item);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ubah Jadwal"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmSchedule(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            title="Hapus Jadwal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak ada jadwal piket pada hari {selectedDay}
              </h4>
              <p className="text-xs mt-1">
                Gunakan tombol "+ Buat Jadwal" atau "Generate Otomatis" untuk mengalokasikan guru piket.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* SCHEDULE VIEW: TABLE */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Guru / Petugas Piket</th>
                  <th className="p-4">Pos / Lokasi</th>
                  <th className="p-4">Waktu Shift</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Keterangan</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      {item.petugasName}
                    </td>
                    <td className="p-4 text-blue-600 dark:text-blue-400 font-medium">
                      {item.ruangName}
                    </td>
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300">
                      {item.jamMulai} - {item.jamSelesai} WIB
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={item.status === 'BERJALAN' ? 'success' : item.status === 'SELESAI' ? 'info' : 'neutral'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-500 italic max-w-xs truncate">
                      {item.keterangan || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleTriggerWaReminder(item)}
                          className="p-1 rounded text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="Kirim Pesan WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setEditingSchedule(item);
                                setIsFormModalOpen(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmSchedule(item)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* SCHEDULE FORM MODAL */}
      <ScheduleFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSchedule(null);
        }}
        onSave={handleSaveSchedule}
        editingSchedule={editingSchedule}
        teachers={teachers}
        rooms={rooms}
        allSchedules={schedules}
        defaultDay={selectedDay}
      />

      {/* RECURRING SCHEDULE GENERATOR MODAL */}
      <RecurringScheduleModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        onGenerate={handleGenerateRecurring}
        teachers={teachers}
        rooms={rooms}
      />

      {/* WHATSAPP REMINDER MODAL */}
      <WhatsAppModal
        isOpen={waModalData.isOpen}
        onClose={() => setWaModalData({ ...waModalData, isOpen: false })}
        title={waModalData.title}
        defaultPhone={waModalData.phone}
        defaultMessage={waModalData.message}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirmSchedule}
        onClose={() => setDeleteConfirmSchedule(null)}
        title="Konfirmasi Hapus Jadwal"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Jadwal Piket Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Petugas: <strong>{deleteConfirmSchedule?.petugasName}</strong> ({deleteConfirmSchedule?.hari} - {deleteConfirmSchedule?.ruangName})
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmSchedule(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteSchedule}>
              Ya, Hapus Jadwal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
