import React, { useState } from 'react';
import {
  Tv,
  Save,
  RotateCcw,
  Eye,
  Sliders,
  Megaphone,
  Monitor,
  Clock,
  Palette,
  Volume2,
  VolumeX,
  Radio,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Plus,
  Trash2,
  Check,
  ShieldCheck,
  Building,
  UserX,
  UserCheck,
  GraduationCap,
  Info,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  LobbyTvConfig,
  TvPanelId,
  ALL_TV_PANELS,
  DEFAULT_LOBBY_TV_CONFIG,
  sanitizeLobbyTvConfig,
  areLobbyTvConfigsEqual,
  stripHtml,
} from '../../types/lobbyTv.types';
import { SchoolSettings, ScheduleItem } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { AnnouncementRecord } from '../../types/announcement.types';
import { PublicKioskDisplay } from '../kiosk/PublicKioskDisplay';
import { getKioskTheme } from '../kiosk/kioskTheme';
import { PASTEL_THEMES } from '../../contexts/ThemeContext';
import { parseYouTubeVideoId } from '../kiosk/youtubeProfile';

interface LobbyTvSettingsCardProps {
  settings: SchoolSettings;
  isAdmin: boolean;
  onSaveTvSettings: (updatedTvConfig: LobbyTvConfig) => Promise<void>;
  schedules?: ScheduleItem[];
  substitutions?: TeacherSubstitutionRecord[];
  tardiness?: StudentTardyRecord[];
  permits?: StudentPermitRecord[];
  visitors?: VisitorRecord[];
  announcements?: AnnouncementRecord[];
}

export const LobbyTvSettingsCard: React.FC<LobbyTvSettingsCardProps> = ({
  settings,
  isAdmin,
  onSaveTvSettings,
  schedules = [],
  substitutions = [],
  tardiness = [],
  permits = [],
  visitors = [],
  announcements = [],
}) => {
  // Local working draft state (does NOT immediately alter live TV display until saved)
  const [draftConfig, setDraftConfig] = useState<LobbyTvConfig>(() =>
    sanitizeLobbyTvConfig(settings.lobbyTv)
  );

  // Sync draft whenever server settings update
  React.useEffect(() => {
    setDraftConfig(sanitizeLobbyTvConfig(settings.lobbyTv));
  }, [settings.lobbyTv]);

  // Track if current working draft diverges from persisted server configuration
  const selectedTvPalette = getKioskTheme(draftConfig);

  const hasUnsavedChanges = React.useMemo(() => {
    return !areLobbyTvConfigsEqual(draftConfig, settings.lobbyTv);
  }, [draftConfig, settings.lobbyTv]);

  const [newTickerInput, setNewTickerInput] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Panel reordering and toggle helper
  const handleTogglePanel = (panelId: TvPanelId) => {
    setDraftConfig((prev) => {
      const isCurrentlyEnabled = prev.enabledPanels.includes(panelId);
      if (isCurrentlyEnabled) {
        if (prev.enabledPanels.length <= 1) {
          setFeedback({
            tone: 'error',
            message: 'Minimal 1 panel informasi harus tetap aktif agar TV Lobi dapat menampilkan konten.',
          });
          return prev;
        }
        return {
          ...prev,
          enabledPanels: prev.enabledPanels.filter((id) => id !== panelId),
        };
      } else {
        return {
          ...prev,
          enabledPanels: [...prev.enabledPanels, panelId],
        };
      }
    });
  };

  const handleMovePanel = (index: number, direction: 'up' | 'down') => {
    setDraftConfig((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.enabledPanels.length) return prev;

      const newPanels = [...prev.enabledPanels];
      const temp = newPanels[index];
      newPanels[index] = newPanels[targetIndex];
      newPanels[targetIndex] = temp;

      return {
        ...prev,
        enabledPanels: newPanels,
      };
    });
  };

  // Ticker message helpers (plain text sanitized, strips HTML)
  const handleAddTickerMessage = () => {
    const text = stripHtml(newTickerInput);
    if (!text) return;
    setDraftConfig((prev) => ({
      ...prev,
      tickerMessages: [...prev.tickerMessages, text],
    }));
    setNewTickerInput('');
  };

  const handleRemoveTickerMessage = (index: number) => {
    setDraftConfig((prev) => ({
      ...prev,
      tickerMessages: prev.tickerMessages.filter((_, idx) => idx !== index),
    }));
  };

  // Reset to default configuration
  const handleResetToDefault = () => {
    if (window.confirm('Kembalikan konfigurasi TV Lobi ke pengaturan default sistem? Perubahan belum tersimpan sampai Anda menekan "Simpan Pengaturan TV".')) {
      setDraftConfig({ ...DEFAULT_LOBBY_TV_CONFIG });
      setFeedback({
        tone: 'info',
        message: 'Pengaturan TV dikembalikan ke nilai default pada form draft. Klik "Simpan Pengaturan TV" untuk menerapkan ke TV aktif.',
      });
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!isAdmin) {
      setFeedback({
        tone: 'error',
        message: 'Hanya pengguna dengan wewenang Administrator yang dapat mengubah konfigurasi TV Lobi.',
      });
      return;
    }

    if (draftConfig.profileVideoEnabled && draftConfig.profileVideoUrl?.trim() && !parseYouTubeVideoId(draftConfig.profileVideoUrl)) {
      setFeedback({ tone: 'error', message: 'Link video tidak valid. Gunakan URL HTTPS YouTube (watch, youtu.be, Shorts, atau live) yang berisi ID video.' });
      return;
    }

    if (draftConfig.enabledPanels.length === 0) {
      setFeedback({
        tone: 'error',
        message: 'Harap aktifkan minimal 1 panel informasi sebelum menyimpan.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback({ tone: 'info', message: 'Menyimpan konfigurasi TV Lobi ke server sekolah...' });

    try {
      await onSaveTvSettings(draftConfig);
      setFeedback({
        tone: 'success',
        message: 'Pengaturan TV Lobi berhasil disimpan di server. TV lobi yang sedang aktif akan langsung memperbarui tampilannya tanpa refresh manual.',
      });
    } catch (err: any) {
      setFeedback({
        tone: 'error',
        message: err?.message || 'Gagal menyimpan konfigurasi TV Lobi. Periksa koneksi Anda lalu coba kembali.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPanelIcon = (panelId: TvPanelId) => {
    switch (panelId) {
      case 'duty_teachers':
        return <ShieldCheck className="w-4 h-4 text-[var(--theme-primary)]" />;
      case 'substitutions':
        return <UserX className="w-4 h-4 text-purple-500" />;
      case 'visitors':
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case 'discipline':
        return <GraduationCap className="w-4 h-4 text-amber-500" />;
      case 'announcements':
        return <Megaphone className="w-4 h-4 text-cyan-500" />;
      case 'school_identity':
        return <Building className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Main Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[var(--theme-surface-subtle)] text-[var(--theme-primary)] flex items-center justify-center shrink-0">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              Pengaturan Mode TV Lobi (Kiosk Display)
              <Badge variant={draftConfig.enabled ? 'success' : 'neutral'} size="sm">
                {draftConfig.enabled ? 'Siaga Aktif' : 'Nonaktif'}
              </Badge>
              {hasUnsavedChanges && (
                <Badge variant="warning" size="sm" className="animate-pulse">
                  Draf Belum Disimpan
                </Badge>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Konfigurasi terpusat di server sekolah untuk layar monitor Smart TV di lobi, ruang guru, dan pos utama.
            </p>
          </div>
        </div>

        {/* Action Buttons: Simpan, Pratinjau, Reset */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            title="Kembalikan form ke nilai default aman"
          >
            Default
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            leftIcon={<Eye className="w-3.5 h-3.5 text-[var(--theme-primary)]" />}
            title="Buka pratinjau interaktif dengan pengaturan draf lokal tanpa mengubah TV aktif di lobi"
          >
            Pratinjau TV
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!isAdmin || isSaving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
            title="Simpan perubahan ke server dan sinkronkan ke seluruh TV aktif"
          >
            Simpan Pengaturan TV
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              : feedback.tone === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* 2. Rotasi & Animasi Carousel */}
      <Card>
        <CardHeader
          title="Animasi Transisi & Rotasi Layar"
          subtitle="Atur durasi pergantian panel dan transisi slide secara terpisah. Mode TV secara otomatis menghormati prefers-reduced-motion."
        />
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Pilihan Transisi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pilihan Efek Transisi:
              </label>
              <select
                value={draftConfig.transition}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    transition: e.target.value as any,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="slide">Geser Lembut (GPU / Transisi Dua Tahap)</option>
                <option value="fade">Fade (Memudar Halus)</option>
                <option value="none">Tanpa Animasi (Instan / Hemat Daya)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Animasi keluar dan masuk yang halus; pengaturan hemat gerak perangkat tetap dihormati.
              </p>
            </div>

            {/* Durasi Transisi */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Durasi Animasi Transisi:
              </label>
              <select
                value={draftConfig.transitionDurationMs}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    transitionDurationMs: Number(e.target.value),
                  }))
                }
                disabled={draftConfig.transition === 'none'}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white disabled:opacity-50"
              >
                <option value={300}>300 milidetik (Cepat)</option>
                <option value={500}>500 milidetik (Responsif)</option>
                <option value={800}>800 milidetik (Halus / Rekomendasi)</option>
                <option value={1200}>1.2 detik (Sangat Halus)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Kecepatan animasi bergerak atau memudar.
              </p>
            </div>

            {/* Interval Rotasi Panel */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Interval Pergantian Slide:
              </label>
              <select
                value={draftConfig.slideIntervalSec}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    slideIntervalSec: Number(e.target.value),
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value={5}>5 detik (Singkat)</option>
                <option value={8}>8 detik (Sedang)</option>
                <option value={10}>10 detik (Rekomendasi Lobi)</option>
                <option value={15}>15 detik (Cukup Waktu Membaca)</option>
                <option value={20}>20 detik (Tenang & Santai)</option>
                <option value={30}>30 detik (Lama per Slide)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Waktu jeda tayang sebelum berganti ke panel berikutnya.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Panel Reordering & Toggles */}
      <Card>
        <CardHeader
          title="Pemilih & Urutan Panel Informasi Publik"
          subtitle="Tentukan panel mana yang ditampilkan pada TV dan urutkan rotasi informasinya. Gunakan tombol panah untuk mengatur urutan."
        />
        <CardContent className="p-5 space-y-3">
          <div className="space-y-2">
            {draftConfig.enabledPanels.map((panelId, index) => {
              const meta = ALL_TV_PANELS.find((p) => p.id === panelId);
              if (!meta) return null;

              return (
                <div
                  key={panelId}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200 dark:border-[var(--theme-card-border)] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] text-xs font-mono font-bold flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                      #{index + 1}
                    </span>
                    <div className="p-1.5 rounded-lg bg-white dark:bg-[var(--theme-card-bg)] shrink-0">
                      {getPanelIcon(panelId)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {meta.label}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {/* Move Up, Move Down, Toggle Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMovePanel(index, 'up')}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-hover)] cursor-pointer"
                      title="Pindah Naik"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === draftConfig.enabledPanels.length - 1}
                      onClick={() => handleMovePanel(index, 'down')}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-[var(--theme-surface-hover)] cursor-pointer"
                      title="Pindah Turun"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePanel(panelId)}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title="Nonaktifkan panel ini dari rotasi TV"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* List of Disabled Panels (Can be enabled) */}
          {ALL_TV_PANELS.some((p) => !draftConfig.enabledPanels.includes(p.id)) && (
            <div className="pt-3 border-t border-slate-100 dark:border-[var(--theme-card-border)] space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Panel Yang Sedang Tidak Aktif:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_TV_PANELS.filter((p) => !draftConfig.enabledPanels.includes(p.id)).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleTogglePanel(p.id)}
                    className="p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-light)]/30 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getPanelIcon(p.id)}
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {p.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-[var(--theme-primary)] flex items-center gap-1 shrink-0">
                      <Plus className="w-3 h-3" /> Aktifkan
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Teks Berjalan (Running Ticker Pengumuman) */}
      <Card>
        <CardHeader
          title="Teks Berjalan & Pengumuman Bawah (Running Ticker)"
          subtitle="Pesan tata tertib dan imbauan penting yang tampil di bilah bawah layar. Bebas dari eksekusi kode HTML demi keamanan."
        />
        <CardContent className="p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200 dark:border-[var(--theme-card-border)]">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Aktifkan Ticker Pengumuman Bawah
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bila dimatikan atau pesan kosong, bilah pengumuman bawah tidak akan memakan area layar.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={draftConfig.tickerEnabled}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    tickerEnabled: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--theme-primary)]" />
            </label>
          </div>

          {draftConfig.tickerEnabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Mode Ticker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Gaya Tampilan Ticker:
                  </label>
                  <select
                    value={draftConfig.tickerMode}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        tickerMode: e.target.value as any,
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="marquee">Teks Berjalan Halus (Marquee)</option>
                    <option value="static">Pengumuman Statis Bergantian (Fade Jeda)</option>
                  </select>
                </div>

                {/* Kecepatan Ticker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Kecepatan Teks Berjalan:
                  </label>
                  <select
                    value={draftConfig.tickerSpeed}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        tickerSpeed: e.target.value as any,
                      }))
                    }
                    disabled={draftConfig.tickerMode === 'static'}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="slow">Lambat (Mudah Terbaca)</option>
                    <option value="normal">Normal (Standar TV Lobi)</option>
                    <option value="fast">Cepat</option>
                  </select>
                </div>

                {/* Ukuran Font Ticker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Ukuran Tulisan Ticker:
                  </label>
                  <select
                    value={draftConfig.tickerFontSize}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({
                        ...prev,
                        tickerFontSize: e.target.value as any,
                      }))
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
                  >
                    <option value="sm">Kecil (Kompak)</option>
                    <option value="md">Sedang (Rekomendasi 1080p)</option>
                    <option value="lg">Besar (Terbaca Jarak Jauh)</option>
                  </select>
                </div>
              </div>

              <p className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
                Mode berjalan sekarang menampilkan pesan langsung sejak diaktifkan dan menyambung terus tanpa jeda kosong. Label PENGUMUMAN tidak akan tertimpa teks.
              </p>

              {/* Message List Management */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Daftar Kalimat Pengumuman (Plain Text Sanitized):
                </label>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {draftConfig.tickerMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-[var(--theme-card-bg)] border border-slate-200 dark:border-[var(--theme-card-border)] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 truncate">
                          {msg}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTickerMessage(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                        title="Hapus pesan pengumuman ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {draftConfig.tickerMessages.length === 0 && (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                      Belum ada pesan teks berjalan. Masukkan pesan di bawah.
                    </div>
                  )}
                </div>

                {/* Add new message input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newTickerInput}
                    onChange={(e) => setNewTickerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTickerMessage();
                      }
                    }}
                    placeholder="Ketik kalimat pengumuman baru lalu tekan Tambah..."
                    className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTickerMessage}
                    leftIcon={<Plus className="w-3.5 h-3.5 text-[var(--theme-primary)]" />}
                    disabled={!newTickerInput.trim()}
                  >
                    Tambah
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Jam, Tanggal & Zona Waktu */}
      <Card>
        <CardHeader
          title="Jam & Tanggal Digital Realtime"
          subtitle="Sinkronisasi akurat waktu lokal sekolah dengan digit konsisten (tabular monospace) yang tidak bergeser."
        />
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Show Seconds */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tampilkan Detik:
              </label>
              <select
                value={draftConfig.showSeconds ? 'yes' : 'no'}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    showSeconds: e.target.value === 'yes',
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="yes">Ya (Contoh: 07:30:45)</option>
                <option value="no">Tidak (Contoh: 07:30)</option>
              </select>
            </div>

            {/* Time Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Format Jam:
              </label>
              <select
                value={draftConfig.timeFormat}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    timeFormat: e.target.value as any,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="24h">Format 24 Jam (00:00 - 23:59)</option>
                <option value="12h">Format 12 Jam (AM / PM)</option>
              </select>
            </div>

            {/* Show Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tampilkan Tanggal:
              </label>
              <select
                value={draftConfig.showDate ? 'yes' : 'no'}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    showDate: e.target.value === 'yes',
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="yes">Ya (Hari, Tanggal Bulan Tahun)</option>
                <option value="no">Sembunyikan Tanggal</option>
              </select>
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Zona Waktu Sekolah:
              </label>
              <select
                value={draftConfig.timezone}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    timezone: e.target.value,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="Asia/Jakarta">WIB (Jakarta / Sumatra / Jawa)</option>
                <option value="Asia/Makassar">WITA (Bali / Kalimantan / Sulawesi)</option>
                <option value="Asia/Jayapura">WIT (Maluku / Papua)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Desain Visual, Skala Kepadatan & Skema Warna Khusus TV */}
      <Card>
        <CardHeader
          title="Tampilan Visual, Kepadatan & Tema Khusus TV"
          subtitle="Preferensi visual TV lobi terpisah dari tema pengguna personal, memastikan rasio kontras maksimal di layar lebar."
        />
        <CardContent className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Density Scale */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Skala Tipografi & Jarak Pandang:
              </label>
              <select
                value={draftConfig.densityScale}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    densityScale: e.target.value as any,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="compact">Kompak (Monitor Meja 21"-27")</option>
                <option value="standard">Standar (Optimal TV 32"-55")</option>
                <option value="large">Besar / Jauh (TV 65"+ & Jarak &gt; 5 meter)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Ukuran huruf berubah sesuai pilihan. Daftar panjang akan otomatis berganti halaman agar semua informasi tetap terbaca.
              </p>
            </div>

            {/* Tema Warna TV */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Skema Warna Aksen TV:
              </label>
              <select
                value={draftConfig.theme}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    theme: e.target.value as any,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                {PASTEL_THEMES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.tagline})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                Warna aksen untuk jam, lencana, dan identitas TV. Mode terang/gelap dipilih secara terpisah di bawah.
              </p>
            </div>

            {/* Mode Kecerahan TV */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mode Kecerahan Layar TV:
              </label>
              <select
                value={draftConfig.colorMode}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    colorMode: e.target.value as any,
                  }))
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
              >
                <option value="dark">Mode Gelap (Rekomendasi Panel TV)</option>
                <option value="light">Mode Terang (Ruangan Terbuka Terang)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                Mode Terang mengubah latar dan kartu menjadi cerah; Mode Gelap menggunakan latar gelap. Pilihan berlaku pada semua panel TV.
              </p>
            </div>
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border p-3 flex items-center gap-3"
              style={{ backgroundColor: selectedTvPalette.background, borderColor: selectedTvPalette.border, color: selectedTvPalette.text }}
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center font-black shrink-0" style={{ backgroundColor: selectedTvPalette.soft, color: selectedTvPalette.accent }}>TV</span>
              <div className="min-w-0">
                <p className="text-xs font-bold">Pratinjau tema: {draftConfig.colorMode === 'light' ? 'Terang' : 'Gelap'} · {PASTEL_THEMES.find(t => t.id === draftConfig.theme)?.name || 'Default'}</p>
                <p className="text-[11px]" style={{ color: selectedTvPalette.muted }}>Perubahan tampak langsung di pratinjau. Klik Simpan untuk menerapkan ke TV Lobi.</p>
              </div>
            </div>
          </div>

          {/* Subtitle Header Customization */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Keterangan Subjudul Header TV Lobi:
            </label>
            <input
              type="text"
              value={draftConfig.customSubtitle || ''}
              onChange={(e) =>
                setDraftConfig((prev) => ({
                  ...prev,
                  customSubtitle: e.target.value,
                }))
              }
              placeholder="Pusat Informasi & Pemantauan Operasional Sekolah Terpadu"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Toggle Switches: Identitas, Indikator Koneksi, Bel Audio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="p-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-surface-subtle)] flex items-center justify-between gap-2 cursor-pointer">
              <div className="text-xs">
                <span className="font-bold block text-slate-900 dark:text-white">Identitas Sekolah</span>
                <span className="text-[10px] text-slate-500">Logo & nama resmi</span>
              </div>
              <input
                type="checkbox"
                checked={draftConfig.showSchoolIdentity}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    showSchoolIdentity: e.target.checked,
                  }))
                }
                className="rounded text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
              />
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-surface-subtle)] flex items-center justify-between gap-2 cursor-pointer">
              <div className="text-xs">
                <span className="font-bold block text-slate-900 dark:text-white">Status Koneksi</span>
                <span className="text-[10px] text-slate-500">Indikator live sync</span>
              </div>
              <input
                type="checkbox"
                checked={draftConfig.showConnectionStatus}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    showConnectionStatus: e.target.checked,
                  }))
                }
                className="rounded text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
              />
            </label>

            <label className="p-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-surface-subtle)] flex items-center justify-between gap-2 cursor-pointer">
              <div className="text-xs">
                <span className="font-bold block text-slate-900 dark:text-white">Suara Bel Otomatis</span>
                <span className="text-[10px] text-slate-500">Audio chime speaker</span>
              </div>
              <input
                type="checkbox"
                checked={draftConfig.allowSound}
                onChange={(e) =>
                  setDraftConfig((prev) => ({
                    ...prev,
                    allowSound: e.target.checked,
                  }))
                }
                className="rounded text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* R90-D: YouTube is a separate optional slide, the original R90-B layout is unchanged. */}
      <Card>
        <CardHeader
          title="Sematan Video Profil Sekolah (YouTube)"
          subtitle="Tambahkan satu slide video ke akhir rotasi TV Lobi tanpa mengubah tampilan slide yang sudah ada."
        />
        <CardContent className="p-5 space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] bg-slate-50 dark:bg-[var(--theme-surface-subtle)] p-3 cursor-pointer">
            <span className="flex items-center gap-3 min-w-0">
              <Monitor className="w-5 h-5 shrink-0 text-[var(--theme-primary)]" />
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Tampilkan Video Profil Sekolah</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Gunakan sebagai slide tersendiri atau sematan tetap ketika informasi berganti.</span>
              </span>
            </span>
            <input type="checkbox" checked={draftConfig.profileVideoEnabled !== false} onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoEnabled: e.target.checked }))} />
          </label>
          <div className="rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/25 p-4 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Sematkan video saat slide informasi berjalan</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400">Video tetap terlihat pada panel samping saat slide berganti. Slide video penuh otomatis dinonaktifkan agar tidak memutar dua video sekaligus.</span>
              </span>
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-sky-600" disabled={draftConfig.profileVideoEnabled === false} checked={Boolean(draftConfig.profileVideoPinned)} onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoPinned: e.target.checked }))}/>
            </label>
            {draftConfig.profileVideoPinned && draftConfig.profileVideoEnabled !== false && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Posisi video</label>
                <select value={draftConfig.profileVideoPinSide || 'right'} onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoPinSide: e.target.value as 'left' | 'right' }))} className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white">
                  <option value="right">Kanan (rekomendasi)</option>
                  <option value="left">Kiri</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ukuran sematan</label>
                <select value={draftConfig.profileVideoPinSize || 'small'} onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoPinSize: e.target.value as 'small' | 'medium' }))} className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white">
                  <option value="small">Kompak (hemat ruang)</option>
                  <option value="medium">Sedang (lebih jelas)</option>
                </select>
              </div>
            </div>}
            <p className="text-xs text-slate-600 dark:text-slate-400">Pemutar disematkan di samping informasi pada layar TV lebar. Pengaturan autoplay tetap berlaku; browser mungkin membatasi pemutaran otomatis.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL video YouTube</label>
            <input
              type="url"
              value={draftConfig.profileVideoUrl || ''}
              onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white"
            />
            {Boolean(draftConfig.profileVideoUrl?.trim()) && !parseYouTubeVideoId(draftConfig.profileVideoUrl) && (
              <p className="text-xs text-rose-600" role="alert">Masukkan link HTTPS YouTube yang valid, misalnya youtube.com/watch?v=... atau youtu.be/...</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">Video berasal langsung dari YouTube, bukan diunggah ke Firebase Storage. Streaming tetap menggunakan kuota internet perangkat TV.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Judul slide video</label>
              <input
                type="text"
                maxLength={100}
                value={draftConfig.profileVideoTitle || ''}
                onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoTitle: e.target.value }))}
                placeholder="Video Profil Sekolah"
                className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Subjudul / keterangan</label>
              <input
                type="text"
                maxLength={160}
                value={draftConfig.profileVideoSubtitle || ''}
                onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoSubtitle: e.target.value }))}
                placeholder="Profil resmi sekolah"
                className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-[var(--theme-card-border)] p-3 cursor-pointer">
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Putar otomatis (tanpa suara)</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Saat slide muncul, video dimuat dan diputar otomatis bila browser mengizinkan.</span>
              </span>
              <input type="checkbox" checked={draftConfig.profileVideoAutoplay !== false} onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoAutoplay: e.target.checked }))} />
            </label>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Durasi tampil slide video</label>
              <select
                value={draftConfig.profileVideoDurationSec ?? 90}
                onChange={e => setDraftConfig(prev => ({ ...prev, profileVideoDurationSec: Number(e.target.value) }))}
                className="w-full rounded-xl p-2.5 border border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-input-bg)] text-sm text-slate-900 dark:text-white"
              >
                <option value={30}>30 detik</option>
                <option value={60}>60 detik</option>
                <option value={90}>90 detik (default)</option>
                <option value={120}>2 menit</option>
                <option value={180}>3 menit</option>
                <option value={300}>5 menit</option>
                <option value={600}>10 menit</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">Durasi ini berlaku untuk mode slide video penuh. Pada mode sematan, pemutar tidak ikut berganti saat slide informasi berubah.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Interactive Preview with DRAFT settings (Doesn't touch live TV) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50">
          <PublicKioskDisplay
            onClose={() => setIsPreviewOpen(false)}
            settings={{
              ...settings,
              lobbyTv: draftConfig,
            }}
            schedules={schedules}
            substitutions={substitutions}
            tardiness={tardiness}
            permits={permits}
            visitors={visitors}
            announcements={announcements}
            isPreviewMode={true}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      )}
    </div>
  );
};
