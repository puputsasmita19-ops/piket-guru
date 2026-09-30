import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useTheme } from '../../contexts/ThemeContext';

export const ThemeSettingsCard: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <Card>
      <CardHeader
        title="Preferensi Tema & Tampilan Antarmuka"
        subtitle="Pilih mode tampilan yang nyaman untuk perangkat desktop, tablet, maupun smartphone Anda"
      />
      <CardContent className="p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Option 1: Light */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
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
              <p className="text-xs text-slate-500 mt-1">
                Latar belakang putih bersih, kontras tinggi untuk penggunaan di ruangan terang.
              </p>
            </div>
          </button>

          {/* Option 2: Dark */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              theme === 'dark'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Moon className="w-5 h-5" />
              </div>
              {theme === 'dark' && (
                <Badge variant="primary" size="sm">Aktif</Badge>
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Mode Gelap (Dark)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Latar belakang gelap pekat (Slate 950), nyaman di mata untuk kondisi minim cahaya dan hemat baterai.
              </p>
            </div>
          </button>

          {/* Option 3: System */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              theme === 'system'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-md'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                <Monitor className="w-5 h-5" />
              </div>
              {theme === 'system' && (
                <Badge variant="primary" size="sm">Aktif</Badge>
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">Mengikuti Sistem (Auto)</h4>
              <p className="text-xs text-slate-500 mt-1">
                Otomatis menyesuaikan mode terang / gelap sesuai preferensi sistem operasi perangkat Anda.
              </p>
            </div>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
          <span>Status Tema Aktif Saat Ini: <strong>{isDark ? '🌙 Mode Gelap (Dark Mode)' : '☀️ Mode Terang (Light Mode)'}</strong></span>
          <span className="font-mono text-[11px] text-slate-400">Pilihan tersimpan otomatis di penyimpanan lokal</span>
        </div>
      </CardContent>
    </Card>
  );
};
