import { getEffectiveSchedulesOnDate } from '../../utils/scheduleUtils';
import { normalizeCommandCenterConfig } from '../../types/commandCenterConfig.types';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  Radio,
  Bell,
  Volume2,
  Siren,
  ShieldCheck,
  Users,
  AlertTriangle,
  UserCheck,
  Clock,
  DoorOpen,
  MapPin,
  Flame,
  PhoneCall,
  Sparkles,
} from '../../components/icons';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { CampusMapViewer } from './CampusMapViewer';
import { EmergencyBroadcastModal } from './EmergencyBroadcastModal';
import { SchoolBellService } from '../../services/audio/bellService';
import { where } from 'firebase/firestore';
import { FirestoreService } from '../../services/firebase/firestoreService';
import {
  ScheduleItem,
  AttendanceRecord,
  SchoolSettings,
} from '../../types';
import { VisitorRecord } from '../../types/visitor.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { IncidentRecord } from '../../types/incident.types';
import { DEFAULT_SCHOOL_SETTINGS } from '../../config/constants';
import { formatIndonesianDate, formatTime, getCurrentDayName, getTodayISODate } from '../../utils/dateUtils';

export const CommandCenterPreview: React.FC = () => {
  const { hasRole } = useAuth();
  const { navigateTo } = useNavigation();
  const isAdmin = hasRole('ADMIN');
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [permits, setPermits] = useState<StudentPermitRecord[]>([]);
  const [tardyList, setTardyList] = useState<StudentTardyRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);

  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [activeBellSound, setActiveBellSound] = useState<string | null>(null);

  const todayName = getCurrentDayName();
  const todayISO = getTodayISODate();

  useEffect(() => {
    const unsubSettings = FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', data => { if (data) setSettings(data); });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>(
      'attendance',
      setAttendance,
      undefined,
      [where('tanggal', '==', todayISO)]
    );
    const unsubVis = FirestoreService.subscribeToCollection<VisitorRecord>(
      'visitors',
      setVisitors,
      undefined,
      [where('status', '==', 'SEDANG_BERKUNJUNG')]
    );
    const unsubPmt = FirestoreService.subscribeToCollection<StudentPermitRecord>(
      'studentPermits',
      setPermits,
      undefined,
      [where('status', '==', 'SEDANG_KELUAR')]
    );
    const unsubTrd = FirestoreService.subscribeToCollection<StudentTardyRecord>(
      'studentTardiness',
      setTardyList,
      undefined,
      [where('tanggal', '==', todayISO)]
    );
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>(
      'incidents',
      setIncidents,
      undefined,
      [where('status', 'in', ['BARU', 'INVESTIGASI', 'PENANGANAN'])]
    );

    return () => {
      unsubSettings();
      unsubSched();
      unsubAtt();
      unsubVis();
      unsubPmt();
      unsubTrd();
      unsubInc();
    };
  }, []);

  const commandConfig = normalizeCommandCenterConfig(settings.commandCenterConfig);

  // Today's metrics
  const todaySchedules = getEffectiveSchedulesOnDate(schedules, todayISO);
  const activeVisitors = visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG');
  const activePermits = permits.filter((p) => p.status === 'SEDANG_KELUAR');
  const todayTardy = tardyList.filter((t) => t.tanggal === todayISO);
  const openIncidents = incidents.filter((i) => i.status !== 'SELESAI');

  // Trigger Bells with visual animation feedback
  const handlePlayBell = (type: 'MASUK' | 'GANTI_JAM' | 'ISTIRAHAT' | 'PULANG') => {
    setActiveBellSound(type);
    if (type === 'MASUK') SchoolBellService.playSchoolBell();
    if (type === 'GANTI_JAM') SchoolBellService.playPeriodChangeBell();
    if (type === 'ISTIRAHAT') SchoolBellService.playBreakBell();
    if (type === 'PULANG') SchoolBellService.playDismissalBell();
    setTimeout(() => setActiveBellSound(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION WITH LIVE RADAR HUD */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>PUSAT KOMANDO SIAGA PIKET • LIVE MONITORING</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {commandConfig.heading}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            {commandConfig.description}
          </p>
        </div>

        {/* Action Buttons: Emergency & Chimes */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && <Button type="button" size="sm" variant="outline" className="text-xs !text-white border-white/40 hover:bg-white/10" onClick={() => navigateTo('settings', 'bell')}>Edit Bel & Komando</Button>}
          <Button
            variant="danger"
            size="md"
            className="text-xs font-bold shadow-lg shadow-rose-900/30"
            leftIcon={<Siren className="w-4 h-4 animate-bounce" />}
            onClick={() => setIsEmergencyOpen(true)}
          >
            Siaga Darurat & Kontak
          </Button>
        </div>
      </div>

      {/* DIGITAL SCHOOL BELL CONTROLLER */}
      <Card>
        <CardHeader
          title="Lonceng Bel Sekolah Digital (Audio Synthesizer)"
          subtitle="Bel manual di perangkat ini; jadwal sesi dapat diedit admin melalui Pengaturan Sekolah."
          action={
            <div className="flex items-center gap-1.5 text-xs text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-semibold font-mono">
              <Volume2 className="w-4 h-4" />
              <span>Web Audio Chimes Ready</span>
            </div>
          }
        />
        <CardContent className="p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Jadwal bel yang tersimpan di Firebase bersifat referensi. Suara hanya diputar ketika tombol bel manual ditekan.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => handlePlayBell('MASUK')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                activeBellSound === 'MASUK'
                  ? 'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast,#ffffff)] border-[var(--theme-primary)] shadow-lg scale-105'
                  : 'bg-slate-50 dark:bg-[var(--theme-surface-subtle)] border-slate-200 dark:border-[var(--theme-card-border)] hover:border-[var(--theme-primary-border)]'
              }`}
            >
              <Bell className="w-5 h-5 text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] mb-1" />
              <div className="font-bold text-xs">{commandConfig.bellLabels.MASUK}</div>
              <div className="text-[10px] opacity-75">Westminster 4-Tone</div>
            </button>

            <button
              onClick={() => handlePlayBell('GANTI_JAM')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                activeBellSound === 'GANTI_JAM'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-lg scale-105'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-purple-500'
              }`}
            >
              <Clock className="w-5 h-5 text-purple-500 mb-1" />
              <div className="font-bold text-xs">{commandConfig.bellLabels.GANTI_JAM}</div>
              <div className="text-[10px] opacity-75">Double Ding-Dong</div>
            </button>

            <button
              onClick={() => handlePlayBell('ISTIRAHAT')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                activeBellSound === 'ISTIRAHAT'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-lg scale-105'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-amber-500'
              }`}
            >
              <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
              <div className="font-bold text-xs">{commandConfig.bellLabels.ISTIRAHAT}</div>
              <div className="text-[10px] opacity-75">Triple Harmony Chime</div>
            </button>

            <button
              onClick={() => handlePlayBell('PULANG')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                activeBellSound === 'PULANG'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg scale-105'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-emerald-500'
              }`}
            >
              <DoorOpen className="w-5 h-5 text-emerald-500 mb-1" />
              <div className="font-bold text-xs">{commandConfig.bellLabels.PULANG}</div>
              <div className="text-[10px] opacity-75">Full Dismissal Melody</div>
            </button>
          </div>
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Jadwal Bel Hari Ini (WIB)</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {commandConfig.scheduledBells.filter(item => item.isActive && item.days.includes(new Date(`${todayISO}T12:00:00Z`).getUTCDay())).length ?
                commandConfig.scheduledBells.filter(item => item.isActive && item.days.includes(new Date(`${todayISO}T12:00:00Z`).getUTCDay())).map(item =>
                  <div key={item.id} className="shrink-0 w-40 rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/70 dark:bg-slate-800/30">
                    <p className="text-sm font-bold tabular-nums">{item.time} WIB</p><p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.label}</p>
                  </div>) : <p className="text-xs text-slate-500">Tidak ada sesi bel aktif hari ini.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 OPERATIONAL GAUGES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Pos Siaga Terisi</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {todaySchedules.length} Pos
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">100% Tercover Hari Ini</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Tamu Aktif di Kampus</span>
            <div className="text-2xl font-extrabold text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] mt-1">
              {activeVisitors.length} Tamu
            </div>
            <div className="text-[11px] text-[var(--theme-primary)] dark:text-[var(--theme-primary-text)] font-medium mt-1">Lobi & Pos Keamanan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Siswa Izin di Luar</span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {activePermits.length} Siswa
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Dispensasi & Keluar</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 font-medium">Insiden Terbuka</span>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              {openIncidents.length} Kasus
            </div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">
              {openIncidents.length === 0 ? 'Situasi Aman Kondusif' : 'Perlu Penanganan'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* INTERACTIVE CAMPUS MAP */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <CampusMapViewer
            schedules={todaySchedules}
            attendance={attendance}
            visitors={visitors}
            incidents={incidents}
          />
        </CardContent>
      </Card>

      {/* EMERGENCY PROTOCOL MODAL */}
      <EmergencyBroadcastModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        settings={settings}
      />
    </div>
  );
};
