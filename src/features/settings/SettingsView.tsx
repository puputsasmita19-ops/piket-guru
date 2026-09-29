import React, { useState, useEffect } from 'react';
import {
  Settings,
  School,
  MapPin,
  Database,
  History,
  Download,
  Upload,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Clock,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { RestoreConfirmModal } from './RestoreConfirmModal';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { BackupService, BackupPayload } from '../../services/backup/backupService';
import { LocationService } from '../../services/location/locationService';
import { ExportUtils } from '../../utils/exportUtils';
import { useAuth } from '../../contexts/AuthContext';
import { SchoolSettings, UserProfile } from '../../types';
import { AuditLogRecord } from '../../types/master.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

type SettingsTab = 'school' | 'backup' | 'audit';

export const SettingsView: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // School Form State
  const [schoolName, setSchoolName] = useState(DEFAULT_SCHOOL_SETTINGS.schoolName);
  const [npsn, setNpsn] = useState(DEFAULT_SCHOOL_SETTINGS.npsn);
  const [address, setAddress] = useState(DEFAULT_SCHOOL_SETTINGS.address);
  const [schoolLat, setSchoolLat] = useState(DEFAULT_SCHOOL_SETTINGS.schoolLat);
  const [schoolLng, setSchoolLng] = useState(DEFAULT_SCHOOL_SETTINGS.schoolLng);
  const [allowedRadiusMeters, setAllowedRadiusMeters] = useState(DEFAULT_SCHOOL_SETTINGS.allowedRadiusMeters);
  const [startHour, setStartHour] = useState(DEFAULT_SCHOOL_SETTINGS.workHours.start);
  const [endHour, setEndHour] = useState(DEFAULT_SCHOOL_SETTINGS.workHours.end);

  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);

  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restorePayload, setRestorePayload] = useState<BackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Audit Logs Filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('SEMUA');
  const [auditActionFilter, setAuditActionFilter] = useState('SEMUA');

  // Load Settings and Logs
  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) {
        setSettings(data);
        setSchoolName(data.schoolName);
        setNpsn(data.npsn);
        setAddress(data.address);
        setSchoolLat(data.schoolLat);
        setSchoolLng(data.schoolLng);
        setAllowedRadiusMeters(data.allowedRadiusMeters);
        setStartHour(data.workHours?.start || '06:30');
        setEndHour(data.workHours?.end || '15:30');
      }
    });

    const unsubLogs = FirestoreService.subscribeToCollection<AuditLogRecord>('auditLogs', (data) => {
      setAuditLogs(
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    });

    return () => unsubLogs();
  }, []);

  // --- SAVE SCHOOL PROFILE & GPS ---
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;

    setIsSavingSchool(true);
    try {
      const updated: SchoolSettings = {
        schoolName,
        npsn,
        address,
        schoolLat,
        schoolLng,
        allowedRadiusMeters,
        workHours: {
          start: startHour,
          end: endHour,
        },
      };

      await FirestoreService.setDocument('settings', 'school_config', updated);
      await FirestoreService.logAudit({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        action: 'UPDATE',
        module: 'SETTINGS',
        details: `Memperbarui konfigurasi sekolah & batas geofence (${allowedRadiusMeters}m)`,
      });

      setSaveSuccessBanner('Pengaturan profil sekolah & koordinat GPS berhasil disimpan!');
      setTimeout(() => setSaveSuccessBanner(null), 4000);
    } finally {
      setIsSavingSchool(false);
    }
  };

  // --- AUTO-DETECT CURRENT GPS ---
  const handleDetectCurrentLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const pos = await LocationService.getCurrentPosition();
      setSchoolLat(parseFloat(pos.latitude.toFixed(6)));
      setSchoolLng(parseFloat(pos.longitude.toFixed(6)));
      setSaveSuccessBanner(`Berhasil mendeteksi koordinat perangkat: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`);
      setTimeout(() => setSaveSuccessBanner(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal membaca koordinat GPS perangkat.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // --- BACKUP DOWNLOAD ---
  const handleDownloadBackup = async () => {
    if (!currentUser) return;
    setIsBackingUp(true);
    try {
      const backup = await BackupService.createFullBackup(currentUser);
      BackupService.downloadBackupFile(backup);
    } finally {
      setIsBackingUp(false);
    }
  };

  // --- RESTORE UPLOAD HANDLER ---
  const handleFileRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const validation = BackupService.validateBackupSchema(json);
        if (!validation.isValid) {
          setRestoreError(validation.error || 'Berkas cadangan tidak valid.');
          return;
        }
        setRestorePayload(json);
      } catch (err) {
        setRestoreError('Berkas bukan format JSON yang valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- CONFIRM RESTORE EXECUTE ---
  const handleExecuteRestore = async (payload: BackupPayload) => {
    if (!currentUser) return;
    const result = await BackupService.restoreFullBackup(payload, currentUser);
    setSaveSuccessBanner(`Pemulihan database berhasil! ${result.restoredCount} dokumen telah disinkronkan ke Firestore.`);
    setTimeout(() => setSaveSuccessBanner(null), 5000);
  };

  // --- EXPORT AUDIT LOG TO CSV ---
  const handleExportAuditCsv = () => {
    const headers = ['Waktu', 'Pengguna', 'Role', 'Aksi', 'Modul', 'Rincian Aktivitas', 'ID Rekaman'];
    const rows = filteredAuditLogs.map((log) => [
      log.timestamp,
      log.userName,
      log.role,
      log.action,
      log.module,
      log.details,
      log.recordId || '-',
    ]);

    ExportUtils.exportToCsv(`Audit_Logs_PiketGuru_${Date.now()}`, headers, rows);
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchMod = auditModuleFilter === 'SEMUA' || log.module === auditModuleFilter;
    const matchAct = auditActionFilter === 'SEMUA' || log.action === auditActionFilter;
    const matchSearch =
      log.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.module.toLowerCase().includes(auditSearch.toLowerCase());

    return matchMod && matchAct && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Pengaturan Sistem & Database
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi profil instansi, Geofence GPS presensi, arsip cadangan (backup & restore), dan jejak audit
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('school')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'school'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Profil & GPS
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Jejak Audit ({auditLogs.length})
          </button>
        </div>
      </div>

      {saveSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold">{saveSuccessBanner}</span>
        </div>
      )}

      {/* TAB 1: SCHOOL PROFILE & GEOFENCE */}
      {activeTab === 'school' && (
        <form onSubmit={handleSaveSchoolSettings} className="space-y-6">
          <Card>
            <CardHeader
              title="Informasi Profil & Identitas Sekolah"
              subtitle="Data resmi yang tercetak pada kop surat buku piket dan laporan resmi"
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nama Resmi Sekolah / Lembaga
                  </label>
                  <input
                    required
                    disabled={!isAdmin}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nomor Pokok Sekolah Nasional (NPSN)
                  </label>
                  <input
                    required
                    disabled={!isAdmin}
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Alamat Lengkap Sekolah
                </label>
                <input
                  required
                  disabled={!isAdmin}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Konfigurasi Geofencing GPS & Toleransi Radius Presensi"
              subtitle="Koordinat titik pusat sekolah dan batas toleransi jarak kehadiran guru piket"
              action={
                isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    isLoading={isDetectingLocation}
                    leftIcon={<MapPin className="w-3.5 h-3.5 text-rose-500" />}
                    onClick={handleDetectCurrentLocation}
                  >
                    Gunakan Lokasi GPS Saya Saat Ini
                  </Button>
                )
              }
            />
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!isAdmin}
                    value={schoolLat}
                    onChange={(e) => setSchoolLat(parseFloat(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Longitude Sekolah
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    disabled={!isAdmin}
                    value={schoolLng}
                    onChange={(e) => setSchoolLng(parseFloat(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Batas Toleransi Radius (Meter)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    required
                    disabled={!isAdmin}
                    value={allowedRadiusMeters}
                    onChange={(e) => setAllowedRadiusMeters(parseInt(e.target.value) || 50)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Work hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Jam Masuk Shift Pagi (WIB)
                  </label>
                  <input
                    type="time"
                    disabled={!isAdmin}
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Jam Selesai Shift Sore (WIB)
                  </label>
                  <input
                    type="time"
                    disabled={!isAdmin}
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingSchool}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Simpan Perubahan Pengaturan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}

      {/* TAB 2: BACKUP & RESTORE DATABASE */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Full Backup Download */}
          <Card>
            <CardHeader
              title="Cadangkan Seluruh Database (Backup JSON)"
              subtitle="Ekspor seluruh 11 koleksi Firestore ke satu berkas arsip terstruktur"
            />
            <CardContent className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                Berkas arsip JSON memuat seluruh koleksi: Pengguna, Guru, Staff, Ruangan, Jadwal, Presensi GPS, Jurnal Buku Piket, Insiden, Pengaturan, dan Riwayat Audit.
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto"
                  isLoading={isBackingUp}
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadBackup}
                >
                  Unduh Arsip Cadangan (.JSON)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Restore from Backup */}
          <Card>
            <CardHeader
              title="Pulihkan Database dari Cadangan (Restore)"
              subtitle="Impor berkas JSON cadangan resmi aplikasi untuk disinkronkan ke database"
            />
            <CardContent className="p-5 space-y-4">
              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                Pilih berkas cadangan berekstensi <code>.json</code> yang sebelumnya diunduh dari aplikasi ini.
              </div>

              {isAdmin ? (
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-xs cursor-pointer hover:opacity-90 transition-opacity shadow-sm">
                  <Upload className="w-4 h-4" />
                  <span>Pilih Berkas Cadangan (.JSON)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleFileRestoreUpload}
                  />
                </label>
              ) : (
                <p className="text-xs text-rose-600 font-semibold">
                  Hanya Administrator yang memiliki wewenang memulihkan database.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
                <div className="relative w-full lg:w-72">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Cari aktivitas, user, atau rincian..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
                  <select
                    value={auditModuleFilter}
                    onChange={(e) => setAuditModuleFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                  >
                    <option value="SEMUA">Semua Modul</option>
                    <option value="USERS">USERS</option>
                    <option value="SCHEDULES">SCHEDULES</option>
                    <option value="ATTENDANCE">ATTENDANCE</option>
                    <option value="DUTY_BOOK">DUTY_BOOK</option>
                    <option value="INCIDENTS">INCIDENTS</option>
                    <option value="REPORTS">REPORTS</option>
                    <option value="SETTINGS">SETTINGS</option>
                  </select>

                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
                  >
                    <option value="SEMUA">Semua Aksi</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                    <option value="EXPORT">EXPORT</option>
                    <option value="BACKUP">BACKUP</option>
                    <option value="RESTORE">RESTORE</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                    onClick={handleExportAuditCsv}
                  >
                    Ekspor CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={`Riwayat Log Audit Sistem (${filteredAuditLogs.length})`}
              subtitle="Pencatatan rekam jejak aktivitas pengguna demi akuntabilitas dan transparansi sistem"
            />
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-4">Waktu</th>
                    <th className="p-4">Pengguna</th>
                    <th className="p-4">Modul</th>
                    <th className="p-4">Aksi</th>
                    <th className="p-4">Rincian Perubahan / Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAuditLogs.slice(0, 50).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        {formatIndonesianDate(log.timestamp)} <span className="text-slate-400">{log.timestamp.split('T')[1]?.substring(0, 8)}</span>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div>{log.userName}</div>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">[{log.role}]</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px]">
                          {log.module}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            log.action === 'CREATE'
                              ? 'success'
                              : log.action === 'DELETE'
                              ? 'danger'
                              : log.action === 'UPDATE' || log.action === 'STATUS_CHANGE'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 max-w-md truncate">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      <RestoreConfirmModal
        isOpen={!!restorePayload}
        onClose={() => setRestorePayload(null)}
        backupData={restorePayload}
        onConfirmRestore={handleExecuteRestore}
      />
    </div>
  );
};
