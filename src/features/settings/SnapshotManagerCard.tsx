import React, { useState, useEffect } from 'react';
import {
  Database,
  Camera,
  RotateCcw,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  FileCode,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AdminPinPromptModal } from './AdminPinPromptModal';
import { SnapshotService } from '../../services/backup/snapshotService';
import { BackupService } from '../../services/backup/backupService';
import { CloudSnapshotRecord } from '../../types/security.types';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const SnapshotManagerCard: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [snapshots, setSnapshots] = useState<CloudSnapshotRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');

  // Target for rollback
  const [targetSnapshot, setTargetSnapshot] = useState<CloudSnapshotRecord | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Status banner
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const data = await SnapshotService.getAllSnapshots();
      setSnapshots(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) return;
    setIsCreating(true);
    try {
      const snap = await SnapshotService.createSnapshot(snapshotName, currentUser);
      setCreateModalOpen(false);
      setSnapshotName('');
      setStatusMessage(`Snapshot "${snap.name}" (${snap.totalRecords} dokumen) berhasil dibuat!`);
      await loadSnapshots();
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInitiateRollback = (snap: CloudSnapshotRecord) => {
    setTargetSnapshot(snap);
    setIsPinModalOpen(true);
  };

  const handleExecuteRollback = async () => {
    if (!targetSnapshot || !currentUser || !isAdmin) return;
    setIsRestoring(true);
    try {
      const result = await SnapshotService.restoreSnapshot(targetSnapshot, currentUser);
      setStatusMessage(
        `Rollback berhasil! ${result.restoredCount} dokumen telah dipulihkan dari snapshot "${targetSnapshot.name}".`
      );
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (e: any) {
      setStatusMessage(`Gagal memulihkan snapshot: ${e.message}`);
    } finally {
      setIsRestoring(false);
      setTargetSnapshot(null);
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!currentUser || !isAdmin) return;
    await SnapshotService.deleteSnapshot(snapshotId, currentUser);
    setStatusMessage('Snapshot berhasil dihapus.');
    await loadSnapshots();
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDownloadSnapshotPayload = (snap: CloudSnapshotRecord) => {
    if (snap.dataPayload) {
      BackupService.downloadBackupFile(snap.dataPayload);
    }
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{statusMessage}</span>
        </div>
      )}

      {/* Snapshot Header Card */}
      <Card>
        <CardHeader
          title="Snapshot Basis Data & Point-in-Time Disaster Recovery"
          subtitle="Pembuatan titik pemulihan instan untuk melindungi seluruh 17 modul operasional dari kesalahan manusia atau kerusakan data"
          action={
            isAdmin && (
              <Button
                variant="primary"
                size="sm"
                className="text-xs"
                leftIcon={<Camera className="w-4 h-4" />}
                onClick={() => {
                  setSnapshotName(`Snapshot Manual - ${new Date().toLocaleDateString('id-ID')}`);
                  setCreateModalOpen(true);
                }}
              >
                + Buat Snapshot Sekarang
              </Button>
            )
          }
        />
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 text-xs leading-relaxed flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Keunggulan Snapshot Cloud:</span> Setiap snapshot menyimpan salinan utuh seluruh koleksi (Pengguna, Jadwal, Presensi, Buku Piket, Insiden, Keterlambatan, Izin, Tamu, dsb) lengkap dengan hash SHA untuk verifikasi integritas berkas.
            </div>
          </div>

          {/* Snapshots Table */}
          {snapshots.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Belum Ada Snapshot Tersimpan
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Klik tombol "Buat Snapshot Sekarang" untuk mengamankan kondisi database saat ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        {snap.name}
                      </span>
                      <Badge variant="primary" size="sm">
                        {snap.totalRecords} Dokumen
                      </Badge>
                      <span className="font-mono text-[10px] text-slate-400">
                        {snap.hashFingerprint}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 sm:gap-4">
                      <span>Waktu: {formatIndonesianDate(snap.timestamp)}</span>
                      <span>• Ukuran: {Math.round(snap.sizeBytes / 1024)} KB</span>
                      <span>• Oleh: {snap.createdByName}</span>
                    </div>

                    {/* Breakdown preview tags */}
                    <div className="flex flex-wrap gap-1 pt-1 text-[10px] font-mono text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Presensi: {snap.collectionsSummary?.attendance || 0}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Buku Piket: {snap.collectionsSummary?.dutyBooks || 0}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Terlambat: {snap.collectionsSummary?.studentTardiness || 0}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Izin: {snap.collectionsSummary?.studentPermits || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {snap.dataPayload && (
                      <button
                        onClick={() => handleDownloadSnapshotPayload(snap)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                        title="Unduh Berkas JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          className="text-xs"
                          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          onClick={() => handleInitiateRollback(snap)}
                        >
                          Rollback
                        </Button>
                        <button
                          onClick={() => handleDeleteSnapshot(snap.id)}
                          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 transition cursor-pointer"
                          title="Hapus Snapshot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE SNAPSHOT MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Buat Snapshot Basis Data Baru"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateSnapshot} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Label Snapshot
            </label>
            <input
              required
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="Contoh: Snapshot Sebelum Ujian Semester"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold"
            />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Snapshot akan mengunci seluruh record dari 17 koleksi saat ini ke dalam basis data cloud untuk kesiapan pemulihan darurat seketika.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isCreating}
              leftIcon={<Camera className="w-4 h-4" />}
            >
              Buat Snapshot Sekarang
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADMIN PIN VERIFICATION BEFORE ROLLBACK */}
      <AdminPinPromptModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setTargetSnapshot(null);
        }}
        title="Otorisasi Rollback Database"
        description={`Anda akan mengembalikan seluruh basis data ke kondisi snapshot "${targetSnapshot?.name}". Seluruh perubahan setelah snapshot ini dibuat akan ditimpa.`}
        onSuccess={handleExecuteRollback}
      />
    </div>
  );
};
