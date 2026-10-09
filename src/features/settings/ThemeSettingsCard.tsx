import React from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  CheckCircle2,
  Sparkles,
  Layers,
  Layout,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useTheme, PastelTheme } from '../../contexts/ThemeContext';

export const ThemeSettingsCard: React.FC = () => {
  const {
    theme,
    setTheme,
    pastelTheme,
    setPastelTheme,
    isDark,
    pastelThemesList,
  } = useTheme();

  const currentThemeMeta = pastelThemesList.find((p) => p.id === pastelTheme) || pastelThemesList[0];

  return (
    <div className="space-y-6">
      {/* 1. Pastel Theme Palette Card */}
      <Card>
        <CardHeader
          title="Pilihan Tema Tampilan (Warna Pastel)"
          subtitle="Pilih skema warna pastel lembut sesuai kenyamanan visual Anda. Langsung diterapkan pada antarmuka aplikasi."
        />
        <CardContent className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastelThemesList.map((item) => {
              const isSelected = pastelTheme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPastelTheme(item.id)}
                  className={`group relative p-4.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-3.5 active:scale-[0.98] ${
                    isSelected
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-md'
                      : 'border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] hover:border-slate-300 dark:hover:border-[var(--theme-primary-border)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Swatch Previews */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[var(--theme-surface-subtle)] border border-slate-200/80 dark:border-[var(--theme-card-border)]">
                      {item.swatchColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-lg shadow-xs transition-transform group-hover:scale-105 border border-black/10"
                          style={{ backgroundColor: color }}
                          title={`Warna ${idx + 1}`}
                        />
                      ))}
                    </div>

                    {isSelected ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[var(--theme-primary-text)] bg-white dark:bg-[var(--theme-card-bg)] px-2 py-0.5 rounded-full shadow-xs border border-[var(--theme-primary-border)]">
                        <Check className="w-3.5 h-3.5 text-[var(--theme-primary)]" />
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300">
                        Pilih
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {item.name}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold text-slate-500 bg-slate-100 dark:bg-[var(--theme-surface-subtle)]">
                        {item.tagline}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Preview Showcase */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[var(--theme-card-bg)] border border-[var(--theme-primary-border)] shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-[var(--theme-card-border)] pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--theme-primary)]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Pratinjau Langsung Tema: {currentThemeMeta.name}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Mode: {isDark ? '🌙 Gelap' : '☀️ Terang'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Sample 1: Primary Action Button */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200/60 dark:border-[var(--theme-card-border)] flex flex-col justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-500">Tombol Aksi Utama</span>
                <button
                  type="button"
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-[var(--theme-primary-contrast,#ffffff)] bg-[var(--theme-primary)] shadow-sm shadow-[var(--theme-ring)] hover:opacity-95 transition-opacity"
                >
                  Simpan Perubahan
                </button>
              </div>

              {/* Sample 2: Soft Pastel Surface */}
              <div className="p-3 rounded-xl bg-[var(--theme-primary-light)] border border-[var(--theme-primary-border)] flex flex-col justify-between gap-2">
                <span className="text-[10px] font-semibold text-[var(--theme-primary-text)]">
                  Wadah Pastel & Badge
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-white dark:bg-[var(--theme-card-bg)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)] shadow-xs">
                    Piket Aktif
                  </span>
                  <span className="text-[11px] font-medium text-[var(--theme-primary-text)]">
                    Petugas Siaga
                  </span>
                </div>
              </div>

              {/* Sample 3: Navigation Item Indicator */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200/60 dark:border-[var(--theme-card-border)] flex flex-col justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-500">Navigasi Aktif</span>
                <div className="flex items-center justify-between p-1.5 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-primary-contrast,#ffffff)] text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    Menu Terpilih
                  </span>
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">100%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Light / Dark / System Mode Card */}
      <Card>
        <CardHeader
          title="Mode Kecerahan Tampilan"
          subtitle="Pilih mode terang, gelap, atau otomatis mengikuti preferensi perangkat Anda"
        />
        <CardContent className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Option 1: Light */}
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 active:scale-[0.98] ${
                theme === 'light'
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-md'
                  : 'border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] hover:border-slate-300 dark:hover:border-[var(--theme-primary-border)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Sun className="w-5 h-5" />
                </div>
                {theme === 'light' && (
                  <Badge variant="primary" size="sm">Aktif</Badge>
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Mode Terang (Light)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Latar belakang pastel bersih, kontras tinggi untuk penggunaan di ruangan terang.
                </p>
              </div>
            </button>

            {/* Option 2: Dark */}
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 active:scale-[0.98] ${
                theme === 'dark'
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-md'
                  : 'border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] hover:border-slate-300 dark:hover:border-[var(--theme-primary-border)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] flex items-center justify-center">
                  <Moon className="w-5 h-5" />
                </div>
                {theme === 'dark' && (
                  <Badge variant="primary" size="sm">Aktif</Badge>
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Mode Gelap (Dark)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Latar belakang gelap pekat beraksen pastel, nyaman untuk kondisi minim cahaya dan hemat baterai.
                </p>
              </div>
            </button>

            {/* Option 3: System */}
            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 active:scale-[0.98] ${
                theme === 'system'
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-light)] shadow-md'
                  : 'border-slate-200 dark:border-[var(--theme-card-border)] bg-white dark:bg-[var(--theme-card-bg)] hover:border-slate-300 dark:hover:border-[var(--theme-primary-border)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[var(--theme-surface-subtle)] text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <Monitor className="w-5 h-5" />
                </div>
                {theme === 'system' && (
                  <Badge variant="primary" size="sm">Aktif</Badge>
                )}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Mengikuti Sistem (Auto)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Otomatis menyesuaikan mode terang / gelap sesuai preferensi sistem operasi perangkat Anda.
                </p>
              </div>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border border-slate-200 dark:border-[var(--theme-card-border)] text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-2">
            <span>
              Status Tema Aktif: <strong>{currentThemeMeta.name}</strong> ({isDark ? '🌙 Mode Gelap' : '☀️ Mode Terang'})
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Preferensi tersimpan di perangkat lokal
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
