import React, { useState, useEffect } from 'react';
import {
  Tv,
  Maximize,
  Radio,
  Play,
  Volume2,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  Building,
  Monitor,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { PublicKioskDisplay } from './PublicKioskDisplay';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';

export const KioskPreview: React.FC = () => {
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [substitutions, setSubstitutions] = useState<TeacherSubstitutionRecord[]>([]);
  const [tardiness, setTardiness] = useState<StudentTardyRecord[]>([]);
  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);

  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubSub = FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', setSubstitutions);
    const unsubTrd = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setTardiness);
    const unsubPmt = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setPermits);
    const unsubVis = FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors);

    return () => {
      unsubSched();
      unsubSub();
      unsubTrd();
      unsubPmt();
      unsubVis();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Tv className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Mode TV Informasi Publik (Kiosk Display)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tampilan layar penuh dinamis untuk Smart TV lobi sekolah, ruang guru, dan pos gerbang utama
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          className="shadow-lg shadow-blue-600/30"
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
              Berganti slide otomatis setiap 8 detik mencakup guru piket, guru inval, buku tamu, dan statistik kedisiplinan.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
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
          title="Pratinjau Langsung Tampilan TV Lobi (Interactive Preview)"
          subtitle="Tekan tombol 'Buka Layar Penuh' di bilah atas atau sudut monitor untuk proyektor / TV"
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
            className="relative w-full aspect-[16/9] max-h-[400px] rounded-3xl overflow-hidden bg-slate-950 border-4 border-slate-800 shadow-2xl p-6 flex flex-col justify-between cursor-pointer group hover:border-blue-600/50 transition-colors"
          >
            {/* Ergonomic Fullscreen Launch Pill (Positioned in Corner, not blocking center) */}
            <div className="absolute bottom-4 right-4 z-20">
              <div className="px-3.5 py-1.5 rounded-xl bg-blue-600/95 hover:bg-blue-500 text-white font-bold text-xs shadow-xl backdrop-blur-md flex items-center gap-1.5 transition-transform group-hover:scale-105 border border-blue-400/40">
                <Maximize className="w-3.5 h-3.5" /> Buka TV Layar Penuh
              </div>
            </div>

            {/* PREVIEW TOP BAR */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  P
                </div>
                <div>
                  <h5 className="font-bold text-xs text-white uppercase">{settings.schoolName}</h5>
                  <span className="text-[10px] text-emerald-400">● LIVE KIOSK DISPLAY</span>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-blue-400 font-bold">
                {formatTime(new Date())} WIB
              </div>
            </div>

            {/* PREVIEW BODY */}
            <div className="grid grid-cols-3 gap-3 my-auto">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400">Guru Piket</span>
                <div className="text-lg font-bold text-white mt-0.5">{schedules.length} Pos</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400">Guru Inval</span>
                <div className="text-lg font-bold text-purple-400 mt-0.5">{substitutions.length} Kelas</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400">Tamu Kampus</span>
                <div className="text-lg font-bold text-blue-400 mt-0.5">{visitors.length} Tamu</div>
              </div>
            </div>

            {/* PREVIEW BOTTOM TICKER */}
            <div className="text-[10px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg truncate border border-slate-800">
              📢 Selamat Datang di {settings.schoolName} • Harap seluruh tamu mengenakan tanda pengenal resmi di pos piket...
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
        />
      )}
    </div>
  );
};
