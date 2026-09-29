import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { CampusMapViewer } from './CampusMapViewer';
import { EmergencyBroadcastModal } from './EmergencyBroadcastModal';
import { SchoolBellService } from '../../services/audio/bellService';
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
import { formatIndonesianDate, formatTime, getCurrentDayName } from '../../utils/dateUtils';

export const CommandCenterPreview: React.FC = () => {
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
  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    FirestoreService.getById<SchoolSettings>('settings', 'school_config').then((data) => {
      if (data) setSettings(data);
    });

    const unsubSched = FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules);
    const unsubAtt = FirestoreService.subscribeToCollection<AttendanceRecord>('attendance', setAttendance);
    const unsubVis = FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors);
    const unsubPmt = FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setPermits);
    const unsubTrd = FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setTardyList);
    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>('incidents', setIncidents);

    return () => {
      unsubSched();
      unsubAtt();
      unsubVis();
      unsubPmt();
      unsubTrd();
      unsubInc();
    };
  }, []);

  // Today's metrics
  const todaySchedules = schedules.filter((s) => s.hari === todayName);
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
            Pusat Pengawasan Real-Time & Peta Kampus
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Integrasi monitoring pos piket, sebaran guru siaga, lonceng bel sekolah digital, dan panggilan darurat terpadu.
          </p>
        </div>

        {/* Action Buttons: Emergency & Chimes */}
        <div className="flex flex-wrap items-center gap-2.5">
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
          subtitle="Aktivasi suara bel otomatis tanpa memerlukan perangkat audio eksternal"
          action={
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold font-mono">
              <Volume2 className="w-4 h-4" />
              <span>Web Audio Chimes Ready</span>
            </div>
          }
        />
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => handlePlayBell('MASUK')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                activeBellSound === 'MASUK'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-blue-500'
              }`}
            >
              <Bell className="w-5 h-5 text-blue-500 mb-1" />
              <div className="font-bold text-xs">Bel Masuk Pagi</div>
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
              <div className="font-bold text-xs">Bel Ganti Jam Mapel</div>
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
              <div className="font-bold text-xs">Bel Jam Istirahat</div>
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
              <div className="font-bold text-xs">Bel Pulang Sekolah</div>
              <div className="text-[10px] opacity-75">Full Dismissal Melody</div>
            </button>
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
            <div className="text-2xl font-extrabold text-blue-600 mt-1">
              {activeVisitors.length} Tamu
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Lobi & Pos Keamanan</div>
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
            onSelectPost={(postName) => {
              alert(`Informasi Pos Piket: ${postName}\nSeluruh petugas pos terkoordinasi secara real-time.`);
            }}
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
