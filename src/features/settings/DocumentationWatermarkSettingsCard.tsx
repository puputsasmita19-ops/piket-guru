import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  DocumentationWatermarkConfig,
  DEFAULT_DOCUMENTATION_WATERMARK_CONFIG,
  WatermarkFontSize,
  WatermarkPanelStyle,
} from '../../types/watermark.types';
import { SchoolSettings } from '../../types';
import { SchoolSettingsService } from '../../services/firebase/schoolSettingsService';
import { generateSampleWatermarkPreview } from '../../services/watermark/watermarkService';
import {
  ShieldAlert,
  Camera,
  CheckCircle2,
  RotateCcw,
  Save,
  Image,
  Eye,
  Type,
  Palette,
  AlertCircle,
  FileText,
  UserCheck,
  GraduationCap,
} from 'lucide-react';

interface DocumentationWatermarkSettingsCardProps {
  settings: SchoolSettings;
  isAdmin: boolean;
  userId: string;
  onSettingsUpdated: (updated: SchoolSettings) => void;
}

export const DocumentationWatermarkSettingsCard: React.FC<DocumentationWatermarkSettingsCardProps> = ({
  settings,
  isAdmin,
  userId,
  onSettingsUpdated,
}) => {
  const [config, setConfig] = useState<DocumentationWatermarkConfig>(() => {
    return settings.documentationWatermark || DEFAULT_DOCUMENTATION_WATERMARK_CONFIG;
  });

  const [previewImage, setPreviewImage] = useState<string>('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Sync state if props settings change
  useEffect(() => {
    if (settings.documentationWatermark) {
      setConfig(settings.documentationWatermark);
    }
  }, [settings.documentationWatermark]);

  // Generate live sample preview whenever config changes
  useEffect(() => {
    let isCancelled = false;
    const updatePreview = async () => {
      setIsGeneratingPreview(true);
      try {
        const previewUrl = await generateSampleWatermarkPreview(config, settings.schoolName);
        if (!isCancelled) {
          setPreviewImage(previewUrl);
        }
      } catch (err) {
        console.warn('Failed to generate watermark sample preview:', err);
      } finally {
        if (!isCancelled) setIsGeneratingPreview(false);
      }
    };

    updatePreview();
    return () => {
      isCancelled = true;
    };
  }, [config, settings.schoolName]);

  const handleSave = async () => {
    if (!isAdmin || isSaving) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const updatedConfig: DocumentationWatermarkConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
      };

      const updatedSettings: SchoolSettings = {
        ...settings,
        documentationWatermark: updatedConfig,
      };

      const result = await SchoolSettingsService.saveProfile(updatedSettings, userId);
      onSettingsUpdated(result.settings);
      setSaveStatus({
        tone: 'success',
        message: 'Pengaturan watermark dokumentasi berhasil disimpan dan disinkronkan ke seluruh modul!',
      });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err: any) {
      setSaveStatus({
        tone: 'error',
        message: err?.message || 'Gagal menyimpan pengaturan watermark. Periksa koneksi Anda.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    setConfig(DEFAULT_DOCUMENTATION_WATERMARK_CONFIG);
    setSaveStatus({
      tone: 'success',
      message: 'Pengaturan dikembalikan ke standar awal. Klik "Simpan Perubahan" untuk menerapkan.',
    });
    setTimeout(() => setSaveStatus(null), 4000);
  };

  return (
    <Card id="settings-watermark-section">
      <CardHeader
        title="Watermark Dokumentasi Foto"
        subtitle="Konfigurasi stempel panel bawah resmi untuk foto pada Laporan Kejadian, Siswa Terlambat, dan Buku Tamu"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefault}
              disabled={!isAdmin || isSaving}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Kembalikan Default
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              disabled={!isAdmin}
              leftIcon={<Save className="w-3.5 h-3.5" />}
              className="text-xs font-bold shadow-md"
            >
              Simpan Watermark
            </Button>
          </div>
        }
      />

      <CardContent className="p-5 sm:p-6 space-y-6">
        {saveStatus && (
          <div
            role="alert"
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              saveStatus.tone === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            {saveStatus.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{saveStatus.message}</span>
          </div>
        )}

        {/* Global Styling & Visual Appearance */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Palette className="w-4 h-4 text-[var(--theme-primary)]" />
            <span>Tampilan & Tipografi Panel Watermark</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Show School Logo */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Logo Sekolah:
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={config.showSchoolLogo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, showSchoolLogo: e.target.checked }))}
                  className="rounded text-[var(--theme-primary)] focus:ring-0"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Tampilkan Simbol / Logo Sekolah
                </span>
              </label>
            </div>

            {/* Font Size Selection */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Ukuran Teks Watermark:
              </label>
              <select
                disabled={!isAdmin}
                value={config.fontSize}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, fontSize: e.target.value as WatermarkFontSize }))
                }
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                <option value="small">Kecil (Ringkas & Rapat)</option>
                <option value="medium">Sedang (Standar Terbaca)</option>
                <option value="large">Besar (Kontras Tinggi)</option>
              </select>
            </div>

            {/* Panel Style */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Gaya Tampilan Panel Bawah:
              </label>
              <select
                disabled={!isAdmin}
                value={config.panelStyle}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, panelStyle: e.target.value as WatermarkPanelStyle }))
                }
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                <option value="dark_solid">Hitam Pekat Solid (#090D16)</option>
                <option value="navy_accent">Biru Dongker Malam (#0F172A)</option>
                <option value="dark_subtle">Abu Gelap Elegan (#1E293B)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3 Modules Setting Cards */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Konfigurasi Per Modul Dokumentasi:</span>
            <span className="text-[11px] font-normal text-slate-500">
              Presensi GPS wajib berwatermark koordinat nyata
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Modul Laporan Kejadian */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Laporan Kejadian
                    </h4>
                    <span className="text-[10px] text-slate-500">Insiden & Sarpras</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={config.modules.incidents.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          incidents: { ...prev.modules.incidents, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-primary)]"></div>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.incidents.enabled}
                    checked={config.modules.incidents.showOfficerName}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          incidents: { ...prev.modules.incidents, showOfficerName: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Nama Petugas Pencatat</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.incidents.enabled}
                    checked={config.modules.incidents.showCompactIdentity}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          incidents: { ...prev.modules.incidents, showCompactIdentity: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Kategori & Lokasi Kejadian</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.incidents.enabled}
                    checked={config.modules.incidents.showEventDate}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          incidents: { ...prev.modules.incidents, showEventDate: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Tanggal Kejadian Asli</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.incidents.enabled}
                    checked={config.modules.incidents.showGpsIfAvailable}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          incidents: { ...prev.modules.incidents, showGpsIfAvailable: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>GPS (Hanya jika nyata tersedia)</span>
                </label>
              </div>
            </div>

            {/* 2. Modul Siswa Terlambat */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Siswa Terlambat
                    </h4>
                    <span className="text-[10px] text-slate-500">Pos Gerbang Masuk</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={config.modules.studentTardy.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          studentTardy: { ...prev.modules.studentTardy, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-primary)]"></div>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.studentTardy.enabled}
                    checked={config.modules.studentTardy.showOfficerName}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          studentTardy: { ...prev.modules.studentTardy, showOfficerName: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Nama Guru / Petugas Piket</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.studentTardy.enabled}
                    checked={config.modules.studentTardy.showCompactIdentity}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          studentTardy: { ...prev.modules.studentTardy, showCompactIdentity: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Nama Siswa & Kelas Saja (Tanpa No HP/PIN)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.studentTardy.enabled}
                    checked={config.modules.studentTardy.showEventDate}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          studentTardy: { ...prev.modules.studentTardy, showEventDate: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Tanggal & Jam Tiba Siswa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.studentTardy.enabled}
                    checked={config.modules.studentTardy.showGpsIfAvailable}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          studentTardy: { ...prev.modules.studentTardy, showGpsIfAvailable: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>GPS (Hanya jika nyata tersedia)</span>
                </label>
              </div>
            </div>

            {/* 3. Modul Buku Tamu Digital */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Buku Tamu Digital
                    </h4>
                    <span className="text-[10px] text-slate-500">Lobi / Pos Depan</span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={config.modules.visitors.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          visitors: { ...prev.modules.visitors, enabled: e.target.checked },
                        },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--theme-primary)]"></div>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.visitors.enabled}
                    checked={config.modules.visitors.showOfficerName}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          visitors: { ...prev.modules.visitors, showOfficerName: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Nama Petugas Penerima</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.visitors.enabled}
                    checked={config.modules.visitors.showCompactIdentity}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          visitors: { ...prev.modules.visitors, showCompactIdentity: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Nama Tamu & Instansi Asal</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.visitors.enabled}
                    checked={config.modules.visitors.showEventDate}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          visitors: { ...prev.modules.visitors, showEventDate: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>Tanggal & Jam Kunjungan</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isAdmin || !config.modules.visitors.enabled}
                    checked={config.modules.visitors.showGpsIfAvailable}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        modules: {
                          ...prev.modules,
                          visitors: { ...prev.modules.visitors, showGpsIfAvailable: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-[var(--theme-primary)]"
                  />
                  <span>GPS (Hanya jika nyata tersedia)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Sample Watermark Preview */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
              <span>Pratinjau Hasil Watermark Nyata (Live Canvas Preview)</span>
            </span>
            <Badge variant="info">Otomatis Terkompresi Aman</Badge>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center p-2 min-h-[220px]">
            {isGeneratingPreview && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-10 text-white text-xs">
                Memperbarui pratinjau...
              </div>
            )}
            {previewImage ? (
              <img
                src={previewImage}
                alt="Pratinjau Watermark"
                className="max-h-[360px] w-auto max-w-full rounded-xl object-contain shadow-lg"
              />
            ) : (
              <div className="text-xs text-slate-500">Memuat contoh pratinjau...</div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Watermark menyatu ke dalam file gambar foto (bukan sekadar overlay HTML), berformat JPEG dengan kompresi progresif (~150–280 KB), dan tidak memotong objek foto.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
