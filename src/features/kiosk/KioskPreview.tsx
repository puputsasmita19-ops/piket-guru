import { useMinuteClock } from '../../hooks/useMinuteClock';
import { appLogo } from '../../utils/reportBranding';
import { useWibToday } from '../../hooks/useWibToday';
import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { Megaphone } from '../../components/icons';
import React, { useState, useEffect } from 'react';
import {
  Tv,
  Maximize,
  Radio,
  Play,
  Volume2,
  Calendar,
  Clock,
  ShieldCheck,
  Building,
  Monitor,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ContextualHelp } from '../../components/common/Tooltip';
import { PublicKioskDisplay } from './PublicKioskDisplay';
import { sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';
import { getKioskTheme } from './kioskTheme';
import { where } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { AnnouncementRecord } from '../../types/announcement.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getTodayISODate } from '../../utils/dateUtils';

export const KioskPreview: React.FC = () => {
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [tardiness, setTardiness] = useState<StudentTardyRecord[]>([]);
  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  const todayISO = useWibToday();
  const previewTime = useMinuteClock();
  const kioskConfig = sanitizeLobbyTvConfig(settings.lobbyTv);
  const miniTheme = getKioskTheme(kioskConfig);
  const miniVars = {
    '--kiosk-accent': miniTheme.accent,
    '--kiosk-accent-ink': miniTheme.accentInk,
    '--kiosk-bg': miniTheme.background,
    '--kiosk-card': miniTheme.card,
    '--kiosk-text': miniTheme.text,
    '--kiosk-muted': miniTheme.muted,
    '--kiosk-border': miniTheme.border,
  } as React.CSSProperties;

  useEffect(() => {
    // Realtime subscription to authoritative school configuration
    // Ensures any active TV display immediately receives updates saved by admins without manual refresh
    const unsubSettings = FirestoreService.subscribeToDocument<SchoolSettings>(
      'settings',
      'school_config',
      (data) => {
        if (data) setSettings(data);
      }
    );

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubSub = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>(
      'substitutions',
      setSubstitutions,
      undefined,
      [where('tanggal', '==', todayISO)]
    );
    const unsubTrd = FirestoreService.subscribeToCollection<StudentTardyRecord>(
      'studentTardiness',
      setTardiness,
      undefined,
      [where('tanggal', '==', todayISO)]
    );
    const unsubPmt = FirestoreService.subscribeToCollection<StudentPermitRecord>(
      'studentPermits',
      setPermits,
      undefined,
      [where('status', '==', 'SEDANG_KELUAR')]
    );
    const unsubVis = FirestoreService.subscribeToCollection<VisitorRecord>(
      'visitors',
      setVisitors,
      undefined,
      [where('status', '==', 'SEDANG_BERKUNJUNG')]
    );
    const unsubAnnounce = FirestoreService.subscribeToCollection<AnnouncementRecord>(
      'announcements',
      setAnnouncements,
      undefined,
      [where('isActive', '==', true)]
    );

    return () => {
      unsubSettings();
      unsubSched();
      unsubSub();
      unsubTrd();
      unsubPmt();
      unsubVis();
      unsubAnnounce();
    };
  }, [todayISO]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Tv className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Mode TV Informasi Publik (Kiosk Display)</span>
            <ContextualHelp
              title="Mode TV Lobi (Kiosk)"
              content="Tampilan layar TV Lobi sekolah yang menyajikan jadwal piket, bel sekolah, pengumuman, dan status kehadiran secara otomatis."
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Lihat informasi sekolah dalam tampilan TV lobi.</p>
        </div>

        <Button
          variant="primary"
          size="md"
          className="page-actions shadow-lg shadow-blue-600/30"
          leftIcon={<Maximize className="w-4 h-4" />}
          onClick={() => setIsKioskOpen(true)}
        >
          Buka Mode TV Layar Penuh
        </Button>
      </div>

      {/* FEATURE CARDS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
              <Tv className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Optimasi Smart TV 1080p / 4K
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Desain kontras tinggi dengan tipografi proporsional untuk keterbacaan optimal dari jarak jauh di lobi sekolah.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Rotasi Carousel Otomatis
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Informasi berganti sesuai jeda admin. Daftar panjang dibagi ke beberapa halaman agar tulisan tetap besar dan terbaca.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" strokeWidth={1.7} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Running Ticker Pengumuman
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Teks berjalan di bagian bawah layar untuk menyampaikan pesan tata tertib dan imbauan penting sekolah.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MINI LIVE PREVIEW CONTAINER */}
      <Card>
        <CardHeader
          title="Ringkasan TV Lobi"
          subtitle="Buka layar penuh untuk informasi berhuruf besar dan halaman bergilir sesuai pengaturan admin."
          action={
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Maximize className="w-3.5 h-3.5" />}
              onClick={() => setIsKioskOpen(true)}
              className="shadow-sm"
            >
              Buka Layar Penuh
            </Button>
          }
        />
        <CardContent className="p-6">
          <div
            onClick={() => setIsKioskOpen(true)}
            className="relative w-full min-h-[330px] sm:aspect-[16/9] sm:max-h-[440px] rounded-3xl overflow-hidden bg-[var(--kiosk-bg)] text-[var(--kiosk-text)] border-4 border-[var(--kiosk-border)] shadow-2xl p-6 flex flex-col justify-between cursor-pointer group hover:border-[var(--kiosk-accent)] transition-colors"
            style={miniVars} data-kiosk-mode={miniTheme.mode} data-kiosk-theme={kioskConfig.theme}
          >
            {/* Ergonomic Fullscreen Launch Pill (Positioned in Corner, not blocking center) */}
            <div className="absolute bottom-4 right-4 z-20">
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--kiosk-accent)] text-[var(--kiosk-accent-ink)] font-bold text-xs shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-transform group-hover:scale-105 border border-[var(--kiosk-border)]">
                <Maximize className="w-3.5 h-3.5" /> Buka TV Layar Penuh
              </div>
            </div>

            {/* PREVIEW TOP BAR */}
            <div className="flex items-center justify-between border-b border-[var(--kiosk-border)] pb-3">
              <div className="flex items-center gap-3">
                <img src={appLogo(settings)} alt="Logo aplikasi" className="w-11 h-11 rounded-xl bg-white p-1 object-contain"/>
                <div>
                  <h5 className="font-bold text-base text-[var(--kiosk-text)] uppercase">{settings.schoolName}</h5>
                  <span className="text-[10px] text-emerald-400">● LIVE KIOSK DISPLAY</span>
                </div>
              </div>
              <div className="text-right font-mono text-lg text-[var(--kiosk-accent)] font-bold">
                {formatTime(new Date(previewTime))}
              </div>
            </div>

            {/* PREVIEW BODY */}
            <div className="grid grid-cols-3 gap-2 my-5">
              <div className="p-3 rounded-xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center">
                <span className="text-xs text-[var(--kiosk-muted)]">Guru Piket</span>
                <div className="text-3xl font-bold text-[var(--kiosk-text)] mt-1">{getEffectiveSchedulesOnDate(schedules, todayISO).length}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center">
                <span className="text-xs text-[var(--kiosk-muted)]">Guru Inval</span>
                <div className="text-3xl font-bold text-[var(--kiosk-accent)] mt-1">{substitutions.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--kiosk-card)] border border-[var(--kiosk-border)] text-center">
                <span className="text-xs text-[var(--kiosk-muted)]">Tamu Aktif</span>
                <div className="text-3xl font-bold text-[var(--kiosk-accent)] mt-1">{visitors.filter(row => row.status === 'SEDANG_BERKUNJUNG').length}</div>
              </div>
            </div>

            {/* PREVIEW BOTTOM TICKER */}
            <div className="text-[10px] text-[var(--kiosk-muted)] bg-[var(--kiosk-card)] px-3 py-1.5 rounded-lg truncate border border-[var(--kiosk-border)]">
              <Megaphone className="w-3.5 h-3.5 mr-1" /> Selamat Datang di {settings.schoolName} • Harap seluruh tamu mengenakan tanda pengenal resmi di pos piket...
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FULL-SCREEN KIOSK MODAL COMPONENT */}
      {isKioskOpen && (
        <PublicKioskDisplay
          onClose={() => setIsKioskOpen(false)}
          settings={settings}
          schedules={schedules}
          substitutions={substitutions}
          tardiness={tardiness}
          permits={permits}
          visitors={visitors}
          announcements={announcements}
        />
      )}
    </div>
  );
};
