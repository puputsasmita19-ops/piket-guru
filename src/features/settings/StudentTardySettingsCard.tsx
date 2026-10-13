import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { SchoolSettings } from '../../types';
import { calculateStudentTardiness, calculateTardyViolationPoints } from '../../types/studentTardy.types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Clock,
  ShieldCheck,
  Save,
  AlertCircle,
  CheckCircle2,
  Info,
  Sliders,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface StudentTardySettingsCardProps {
  settings: SchoolSettings;
  onUpdated?: (newSettings: SchoolSettings) => void;
}

export const StudentTardySettingsCard: React.FC<StudentTardySettingsCardProps> = ({
  settings,
  onUpdated,
}) => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  // Existing or default tardy configuration
  const initialEntryLimit = settings?.studentTardyConfig?.entryLimit || '07:00';
  const initialTolerance = settings?.studentTardyConfig?.toleranceMinutes ?? 0;

  const [entryLimit, setEntryLimit] = useState(initialEntryLimit);
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(initialTolerance);
  const [simulatedTime, setSimulatedTime] = useState('07:15');

  const [isSaving, setIsSaving] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  // Keep form in sync if settings update externally
  React.useEffect(() => {
    if (settings?.studentTardyConfig) {
      setEntryLimit(settings.studentTardyConfig.entryLimit || '07:00');
      setToleranceMinutes(settings.studentTardyConfig.toleranceMinutes ?? 0);
    }
  }, [settings?.studentTardyConfig]);

  // Real-time calculation preview based on current form inputs
  const calculationPreview = useMemo(() => {
    return calculateStudentTardiness(simulatedTime, entryLimit, toleranceMinutes);
  }, [simulatedTime, entryLimit, toleranceMinutes]);

  const previewPoints = useMemo(() => {
    const mins = calculationPreview.minutesLate ?? 0;
    return calculateTardyViolationPoints(mins);
  }, [calculationPreview.minutesLate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentUser) {
      setStatusFeedback({
        tone: 'error',
        message: 'Akses ditolak: Hanya pengguna dengan peran Administrator yang berwenang menyimpan konfigurasi ini.',
      });
      return;
    }

    // Validate format
    const cleanLimit = entryLimit.trim();
    if (!/^[0-2][0-9]:[0-5][0-9]$/.test(cleanLimit)) {
      setStatusFeedback({
        tone: 'error',
        message: 'Format batas jam masuk harus valid (HH:mm, contoh 07:00).',
      });
      return;
    }

    if (isNaN(toleranceMinutes) || toleranceMinutes < 0 || toleranceMinutes > 120) {
      setStatusFeedback({
        tone: 'error',
        message: 'Toleransi keterlambatan harus berupa angka bulat antara 0 sampai 120 menit.',
      });
      return;
    }

    setIsSaving(true);
    setStatusFeedback(null);

    try {
      const res = await SchoolSettingsService.saveStudentTardyConfig(
        {
          entryLimit: cleanLimit,
          toleranceMinutes: Math.floor(toleranceMinutes),
        },
        currentUser.id
      );

      if (res.settings) {
        onUpdated?.(res.settings);
      }

      setStatusFeedback({
        tone: 'success',
        message: 'Pengaturan Keterlambatan Siswa berhasil disimpan di server. Aturan ini akan diterapkan pada pencatatan keterlambatan baru.',
      });
    } catch (err: any) {
      setStatusFeedback({
        tone: 'error',
        message: err?.message || 'Gagal menyimpan pengaturan keterlambatan siswa ke server.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader
        title="Pengaturan Keterlambatan Siswa (Gerbang Sekolah)"
        subtitle="Konfigurasi batas waktu kedatangan, toleransi gerbang pagi, dan simulasi penghitungan selisih menit (Khusus Administrator)"
      />
      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Notice Info: Separate from Teacher Work Hours */}
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Ketentuan & Isolasi Pengaturan:</span>
            <p className="text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
              Pengaturan ini berlaku <strong>eksklusif untuk pencatatan siswa di pos gerbang</strong> dan <strong>tidak mengubah</strong> jam kerja presensi guru piket. Perubahan hanya berlaku untuk pencatatan baru; riwayat lama mempertahankan snapshot aturan saat kejadian.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Inputs Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Batas Jam Masuk Siswa */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[var(--theme-primary)]" />
                <span>Batas Jam Masuk Siswa (WIB) *</span>
              </label>
              <input
                type="time"
                required
                disabled={!isAdmin || isSaving}
                value={entryLimit}
                onChange={(e) => setEntryLimit(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none"
              />
              <span className="text-[11px] text-slate-500 block">
                Bel masuk sekolah atau batas gerbang ditutup (contoh: 07:00).
              </span>
            </div>

            {/* Toleransi Keterlambatan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-500" />
                <span>Toleransi Keterlambatan (Menit) *</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={120}
                  required
                  disabled={!isAdmin || isSaving}
                  value={toleranceMinutes}
                  onChange={(e) => setToleranceMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full p-2.5 pr-16 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--theme-primary)] focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                  Menit
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block">
                Jika diisi 0, kedatangan setelah batas langsung dihitung terlambat.
              </span>
            </div>
          </div>

          {/* Interactive Simulation & Calculation Preview (Requirement 3) */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Pratinjau Contoh Perhitungan Keterlambatan</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Uji Jam Tiba:</span>
                <input
                  type="time"
                  value={simulatedTime}
                  onChange={(e) => setSimulatedTime(e.target.value)}
                  className="p-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Live Calculation Result Card */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                calculationPreview.isLate
                  ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="space-y-0.5">
                <span className="font-bold block">
                  Simulasi Tiba Pukul {simulatedTime || '--:--'} WIB:
                </span>
                <span className="text-[11px] opacity-90">
                  Batas: {entryLimit} WIB &bull; Toleransi: {toleranceMinutes} Menit &bull; Status: {calculationPreview.displayText}
                </span>
              </div>
              <div className="text-right sm:shrink-0 font-mono">
                <div className="text-base sm:text-lg font-extrabold">
                  {calculationPreview.minutesLate !== null ? `${calculationPreview.minutesLate} Menit` : 'Belum Terhitung'}
                </div>
                {calculationPreview.isLate && (
                  <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    +{previewPoints} Poin Pelanggaran
                  </div>
                )}
              </div>
            </div>

            {/* Explanatory breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">Kasus 1: Tepat Waktu</span>
                <p>Tiba sebelum atau tepat {entryLimit} &rarr; 0 menit (Tepat Waktu, 0 poin).</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">Kasus 2: Masa Toleransi</span>
                <p>
                  {toleranceMinutes > 0
                    ? `Tiba antara ${entryLimit} s/d batas toleransi &rarr; 0 menit (Dalam batas toleransi).`
                    : 'Toleransi 0 menit: tidak ada kompensasi keterlambatan.'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">Kasus 3: Terlambat</span>
                <p>
                  {toleranceMinutes > 0
                    ? `Melebihi ${toleranceMinutes} menit &rarr; selisih penuh dihitung sebagai durasi keterlambatan.`
                    : 'Melebihi jam batas &rarr; selisih dihitung langsung sebagai menit keterlambatan.'}
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Status Banner */}
          {statusFeedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                statusFeedback.tone === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              {statusFeedback.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusFeedback.message}</span>
            </div>
          )}

          {/* Save Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 font-medium">
              {isAdmin ? 'Hak akses Administrator terverifikasi.' : 'Perubahan dinonaktifkan untuk non-admin.'}
            </span>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              disabled={!isAdmin || isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Simpan Pengaturan Keterlambatan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
