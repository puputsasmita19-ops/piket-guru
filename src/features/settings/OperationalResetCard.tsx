import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  OperationalResetService,
  OperationalCategoryKey,
  OPERATIONAL_CATEGORIES,
  OperationalResetPreviewManifest,
  OperationalResetExecutionResult,
} from '../../services/backup/operationalResetService';
import { BackupService, BackupPayload } from '../../services/backup/backupService';
import { UserProfile } from '../../types';
import {
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Calendar,
  Lock,
  Download,
  RefreshCw,
  Info,
  Clock,
  Sparkles,
  Server,
  Layers,
  ArrowRight,
  Eye,
  Camera,
  Check,
} from 'lucide-react';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface OperationalResetCardProps {
  currentUser: UserProfile;
  isAdmin: boolean;
  onRefreshData?: () => void;
}

export const OperationalResetCard: React.FC<OperationalResetCardProps> = ({
  currentUser,
  isAdmin,
  onRefreshData,
}) => {
  // Category selection (all unchecked by default)
  const [selectedCategories, setSelectedCategories] = useState<OperationalCategoryKey[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Preview Manifest state
  const [manifest, setManifest] = useState<OperationalResetPreviewManifest | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Execution & Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [backupPayload, setBackupPayload] = useState<BackupPayload | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Execution progress state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{
    current: number;
    total: number;
    collection: string;
  } | null>(null);
  const [executionResult, setExecutionResult] = useState<OperationalResetExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const toggleCategory = (key: OperationalCategoryKey) => {
    setSelectedCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    // Invalidate stale manifest when selection changes
    setManifest(null);
    setBackupPayload(null);
    setHasDownloadedBackup(false);
    setExecutionResult(null);
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(OPERATIONAL_CATEGORIES.map((c) => c.key));
    setManifest(null);
    setBackupPayload(null);
    setHasDownloadedBackup(false);
    setExecutionResult(null);
  };

  const handleClearAllCategories = () => {
    setSelectedCategories([]);
    setManifest(null);
    setBackupPayload(null);
    setHasDownloadedBackup(false);
    setExecutionResult(null);
  };

  // 1. INSPECT (Preview Data without modifying)
  const handleInspect = async () => {
    if (selectedCategories.length === 0) {
      setInspectError('Pilih setidaknya satu kategori data operasional untuk diperiksa.');
      return;
    }

    setIsInspecting(true);
    setInspectError(null);
    setExecutionResult(null);
    try {
      const result = await OperationalResetService.inspectOperationalData({
        selectedCategories,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        adminUser: currentUser,
      });
      setManifest(result);
      setBackupPayload(null);
      setHasDownloadedBackup(false);
    } catch (err: any) {
      console.error('Inspection error:', err);
      setInspectError(err?.message || 'Gagal memeriksa data operasional.');
    } finally {
      setIsInspecting(false);
    }
  };

  // 2. CREATE SAFETY BACKUP
  const handleCreateSafetyBackup = async () => {
    if (!manifest) return;
    setIsBackingUp(true);
    try {
      const payload = await OperationalResetService.createPreResetBackup(manifest, currentUser);
      setBackupPayload(payload);
      BackupService.downloadBackupFile(payload);
      setHasDownloadedBackup(true);
    } catch (err: any) {
      console.error('Safety backup error:', err);
      alert(`Gagal membuat berkas backup keselamatan: ${err?.message || 'Error'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // 3. EXECUTE RESET
  const handleExecuteReset = async () => {
    if (!manifest) return;
    if (adminPin.length !== 6) {
      setExecutionError('Masukkan 6-digit PIN Administrator untuk verifikasi autentikasi.');
      return;
    }
    if (typedConfirmation.trim() !== 'RESET DATA OPERASIONAL') {
      setExecutionError('Ketik tepat "RESET DATA OPERASIONAL" untuk konfirmasi.');
      return;
    }
    if (!hasDownloadedBackup) {
      setExecutionError('Anda wajib membuat dan mengunduh berkas backup keselamatan terlebih dahulu.');
      return;
    }

    setIsExecuting(true);
    setExecutionError(null);
    try {
      // Step A: Re-authenticate admin via secure backend API
      await OperationalResetService.verifyAdminReauthentication(currentUser, adminPin);

      // Step B: Staged chunk deletion
      const res = await OperationalResetService.executeOperationalReset({
        manifest,
        adminUser: currentUser,
        onProgress: (p) => setExecutionProgress(p),
      });

      setExecutionResult(res);
      setIsConfirmModalOpen(false);
      setManifest(null);
      setSelectedCategories([]);
      setAdminPin('');
      setTypedConfirmation('');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Execute reset error:', err);
      setExecutionError(err?.message || 'Terjadi kesalahan saat mengeksekusi reset data operasional.');
    } finally {
      setIsExecuting(false);
      setExecutionProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <Card className="border-rose-200/80 dark:border-rose-950/60 bg-gradient-to-br from-white via-rose-50/20 to-orange-50/20 dark:from-slate-900 dark:via-rose-950/10 dark:to-slate-900">
        <CardHeader
          title="Pemeliharaan: Reset Data Operasional Percobaan"
          subtitle="Membersihkan data pengujian (presensi, jurnal buku piket, siswa terlambat, izin gerbang, buku tamu) sebelum penggunaan resmi sekolah"
          action={
            <Badge variant="danger" className="text-xs">
              Fitur Khusus Administrator
            </Badge>
          }
        />
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* PROTECTED DATA BANNER */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
            <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Proteksi Absolut: Data Sistem & Konfigurasi Sekolah Tidak Akan Terhapus</span>
            </div>
            <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed text-[11px]">
              Sistem secara ketat melindungi data inti: seluruh akun admin, kredensial PIN/hash, master guru, siswa, kelas, jadwal piket, profil sekolah, Geofence GPS, penandatangan resmi, konfigurasi TV Lobi, dan aturan keamanan database.
            </p>
          </div>

          {/* STEP 1: CATEGORY SELECTION */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--theme-primary)]" />
                <span>1. Pilih Kategori Data Operasional yang Akan Dibersihkan</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearAllCategories}
                  className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                >
                  Lepas Semua
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {OPERATIONAL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => toggleCategory(cat.key)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-rose-300 bg-rose-50/70 dark:bg-rose-950/40 dark:border-rose-900 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                        {cat.label}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      {cat.description}
                    </p>
                    {cat.hasAttachments && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 font-semibold">
                        <Camera className="w-3 h-3" /> Memuat foto dokumentasi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: DATE RANGE FILTER (OPTIONAL) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Filter Rentang Tanggal Operasional (Opsional)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Kosongkan tanggal jika ingin memeriksa seluruh data pada kategori terpilih, atau tentukan rentang tanggal untuk menghapus periode uji coba tertentu saja.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dari Tanggal:
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setManifest(null);
                  }}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Sampai Tanggal:
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setManifest(null);
                  }}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {inspectError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{inspectError}</span>
            </div>
          )}

          {/* INSPECT BUTTON */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Eye className="w-4 h-4" />}
              isLoading={isInspecting}
              onClick={handleInspect}
            >
              Periksa Data (Pratinjau Aman)
            </Button>
            <span className="text-[11px] text-slate-500 italic">
              * Tombol ini murni membaca dan menghitung data tanpa menghapus apa pun dari database.
            </span>
          </div>

          {/* MANIFEST PREVIEW PANEL */}
          {manifest && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 text-white">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    <span>Manifest Pratinjau Terverifikasi</span>
                  </div>
                  <div className="text-base font-black">
                    Project Firebase: <span className="text-blue-400 font-mono">{manifest.projectId}</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    Database: <span className="font-mono text-emerald-400">{manifest.databaseId}</span> • Waktu Pratinjau: {new Date(manifest.generatedAt).toLocaleTimeString('id-ID')} WIB
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-2xl font-black text-rose-400">{manifest.totalRecordsToDelete}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Dokumen Terpilih</div>
                  </div>
                  {manifest.totalAttachmentsToClean > 0 && (
                    <div className="border-l border-slate-800 pl-4">
                      <div className="text-2xl font-black text-amber-400">{manifest.totalAttachmentsToClean}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Foto Dokumentasi</div>
                    </div>
                  )}
                </div>
              </div>

              {/* CONFLICT WARNINGS */}
              {manifest.conflictWarnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Catatan Keterhubungan Relasi Antar Data:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1">
                    {manifest.conflictWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CATEGORY BREAKDOWN TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Kategori Operasional</th>
                      <th className="p-3">Koleksi Firestore</th>
                      <th className="p-3 text-center">Data Terpilih / Total</th>
                      <th className="p-3">Rentang Tanggal</th>
                      <th className="p-3">Contoh Identitas Dokumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                    {manifest.categories
                      .filter((c) => c.totalSelected > 0)
                      .map((cat) => (
                        <tr key={cat.categoryKey} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {cat.label}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            {cat.collectionName}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className="text-rose-600 dark:text-rose-400">{cat.totalSelected}</span>
                            <span className="text-slate-400"> / {cat.totalFound}</span>
                          </td>
                          <td className="p-3 text-[11px]">
                            {cat.dateRange.min ? `${cat.dateRange.min} s/d ${cat.dateRange.max}` : '-'}
                          </td>
                          <td className="p-3 text-[11px] max-w-xs truncate">
                            {cat.sampleItems.length > 0
                              ? cat.sampleItems.map((s) => s.ringkasan).join('; ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* ACTION: PRE-RESET SAFETY BACKUP & PROCEED */}
              <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Langkah Keselamatan Wajib: Unduh Backup Sebelum Eksekusi</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Untuk menjamin data dapat dipulihkan kapan saja apabila terjadi kesalahan, Anda wajib mengunduh berkas arsip keselamatan database (.JSON) sebelum tombol konfirmasi reset dapat diakses.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={hasDownloadedBackup ? 'outline' : 'primary'}
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    isLoading={isBackingUp}
                    onClick={handleCreateSafetyBackup}
                  >
                    {hasDownloadedBackup ? 'Unduh Ulang Backup Keselamatan' : 'Unduh Backup Keselamatan (.JSON)'}
                  </Button>

                  {hasDownloadedBackup && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Backup keselamatan tersimpan.
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    Pastikan berkas backup tersimpan di komputer Anda sebelum melanjutkan.
                  </div>

                  <Button
                    variant="danger"
                    size="md"
                    disabled={!hasDownloadedBackup || manifest.totalRecordsToDelete === 0}
                    onClick={() => {
                      setExecutionError(null);
                      setAdminPin('');
                      setTypedConfirmation('');
                      setIsConfirmModalOpen(true);
                    }}
                  >
                    Lanjutkan ke Konfirmasi Reset
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* EXECUTION RESULT DISPLAY */}
          {executionResult && (
            <div className="mt-6 p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Reset Data Operasional Berhasil Dilaksanakan</span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Sebanyak <strong>{executionResult.totalDeleted} dokumen</strong> telah dibersihkan secara bertahap dari database Firestore. Seluruh akun pengguna, akun admin, jadwal, dan pengaturan sekolah tetap 100% aman dan utuh.
              </p>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                Rincian penghapusan: {JSON.stringify(executionResult.deletedPerCollection)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: FINAL ADMIN RE-AUTHENTICATION & CONFIRMATION */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          if (!isExecuting) setIsConfirmModalOpen(false);
        }}
        title="Konfirmasi Final: Reset Data Operasional"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Tindakan Permanen & Tidak Dapat Dibatalkan Otomatis</span>
            </div>
            <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
              Sebanyak <strong>{manifest?.totalRecordsToDelete} dokumen</strong> pada kategori terpilih akan dihapus dari project Firebase <strong>{manifest?.projectId}</strong>. Anda dapat mengembalikan data ini hanya melalui menu Pulihkan Database menggunakan berkas backup keselamatan yang baru saja diunduh.
            </p>
          </div>

          {/* ADMIN PIN RE-AUTHENTICATION */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-blue-500" />
              <span>Autentikasi Ulang: Masukkan PIN Administrator</span>
            </label>
            <input
              type="password"
              maxLength={6}
              disabled={isExecuting}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center font-mono tracking-widest text-sm font-bold"
            />
          </div>

          {/* TYPED CONFIRMATION */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Ketik konfirmasi: <span className="font-mono text-rose-600">RESET DATA OPERASIONAL</span>
            </label>
            <input
              type="text"
              disabled={isExecuting}
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder="RESET DATA OPERASIONAL"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-xs uppercase"
            />
          </div>

          {executionProgress && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-blue-900 dark:text-blue-200">
                <span>Sedang membersihkan: {executionProgress.collection}...</span>
                <span>
                  {executionProgress.current} / {executionProgress.total}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 transition-all duration-200"
                  style={{
                    width: `${Math.round((executionProgress.current / executionProgress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {executionError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{executionError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              disabled={isExecuting}
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isExecuting}
              disabled={
                adminPin.length !== 6 ||
                typedConfirmation.trim() !== 'RESET DATA OPERASIONAL'
              }
              onClick={handleExecuteReset}
            >
              Eksekusi Reset Sekarang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
