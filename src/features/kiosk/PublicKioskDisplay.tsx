import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Radio,
  Maximize,
  Minimize,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Building,
  GraduationCap,
} from 'lucide-react';
import { ScheduleItem, SchoolSettings } from '../../types';
import { TeacherSubstitutionRecord } from '../../types/substitution.types';
import { StudentTardyRecord } from '../../types/studentTardy.types';
import { StudentPermitRecord } from '../../types/studentPermit.types';
import { VisitorRecord } from '../../types/visitor.types';
import { SchoolBellService } from '../../services/audio/bellService';
import { formatIndonesianDate, formatTime, getCurrentDayName } from '../../utils/dateUtils';

interface PublicKioskDisplayProps {
  onClose: () => void;
  settings: SchoolSettings;
  schedules: ScheduleItem[];
  substitutions: TeacherSubstitutionRecord[];
  tardiness: StudentTardyRecord[];
  permits: StudentPermitRecord[];
  visitors: VisitorRecord[];
}

export const PublicKioskDisplay: React.FC<PublicKioskDisplayProps> = ({
  onClose,
  settings,
  schedules,
  substitutions,
  tardiness,
  permits,
  visitors,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const todayName = getCurrentDayName();
  const todayISO = new Date().toISOString().split('T')[0];

  const todaySchedules = schedules.filter((s) => s.hari === todayName);
  const todaySubs = substitutions.filter((s) => s.tanggal === todayISO);
  const todayTardy = tardiness.filter((t) => t.tanggal === todayISO);
  const activePermits = permits.filter((p) => p.tanggal === todayISO && p.status === 'SEDANG_KELUAR');
  const activeVisitors = visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG');

  const totalSlides = 4;

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Slide Carousel timer (every 8 seconds)
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 8000);
    return () => clearInterval(slideTimer);
  }, [totalSlides]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* BACKGROUND AMBIENT GLOW */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BAR: SCHOOL HEADER & LIVE CLOCK */}
      <header className="relative z-10 px-8 py-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/20">
            P
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                {settings.schoolName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5">
                <Radio className="w-3 h-3 animate-pulse" /> LIVE TV DISPLAY
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Papan Informasi Publik Digital & Pusat Pemantauan Piket Sekolah
            </p>
          </div>
        </div>

        {/* RIGHT SIDE CLOCK & KIOSK CONTROLS */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-300">
              {formatIndonesianDate(currentTime)}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black text-blue-400 tracking-wider">
              {formatTime(currentTime)} <span className="text-xs text-slate-400">WIB</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!isMuted) SchoolBellService.playPeriodChangeBell();
                setIsMuted(!isMuted);
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title={isMuted ? 'Aktifkan Suara Bel' : 'Nonaktifkan Suara Bel'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
              title="Keluar Mode TV"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA: DYNAMIC SLIDES */}
      <main className="relative z-10 flex-1 p-8 flex flex-col justify-center">
        {/* SLIDE 0: GURU PIKET BERTUGAS HARI INI */}
        {currentSlide === 0 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    GURU & PETUGAS PIKET BERTUGAS HARI INI
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hari {todayName} • Terbagi pada pos-pos strategis kampus
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-800">
                SLIDE 1 / 4
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySchedules.length > 0 ? (
                todaySchedules.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex items-center gap-4 hover:border-blue-500 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-lg flex items-center justify-center border border-blue-500/30 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-base text-white truncate">
                        {item.petugasName}
                      </div>
                      <div className="text-xs text-blue-400 font-medium truncate">
                        📍 {item.ruangName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        ⏰ {item.jamMulai} - {item.jamSelesai} WIB
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-slate-500 font-medium">
                  Belum ada jadwal guru piket yang diatur untuk hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 1: GURU BERHALANGAN & GURU INVAL PENGGANTI */}
        {currentSlide === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    GURU BERHALANGAN & ALOKASI GURU INVAL (PENGGANTI)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Informasi kelas pengganti agar proses pembelajaran siswa tetap optimal
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950/60 px-3 py-1 rounded-xl border border-purple-800">
                SLIDE 2 / 4
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaySubs.length > 0 ? (
                todaySubs.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-rose-400 block">
                          Guru Berhalangan: {sub.guruBerhalanganName}
                        </span>
                        <div className="text-sm font-semibold text-slate-200">
                          {sub.mataPelajaran} • {sub.kelas} ({sub.jamPelajaran})
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-300">
                        {sub.alasan.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                      <span className="text-slate-400 block font-medium">Guru Pengganti / Inval:</span>
                      <div className="font-bold text-emerald-400 text-sm mt-0.5">
                        🧑‍🏫 {sub.guruPenggantiName || 'Dalam Koordinasi Tim Piket'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center text-slate-500 font-medium">
                  Seluruh guru mata pelajaran hadir lengkap pada hari ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 2: DAFTAR TAMU & PENGUNJUNG KAMPUS */}
        {currentSlide === 2 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    BUKU TAMU & KUNJUNGAN RESMI SEKOLAH
                  </h2>
                  <p className="text-xs text-slate-400">
                    Daftar tamu dinas, orang tua siswa, dan mitra yang sedang berkunjung
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800">
                SLIDE 3 / 4
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeVisitors.length > 0 ? (
                activeVisitors.map((vis) => (
                  <div
                    key={vis.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950 px-2 py-0.5 rounded">
                          {vis.nomorBadge}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          Tiba: {vis.jamMasuk} WIB
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white mt-1.5">{vis.namaTamu}</h4>
                      <p className="text-xs text-slate-400">{vis.instansiAsal}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      Bertemu: <strong className="text-white">{vis.tujuanBertemu}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center text-slate-500 font-medium">
                  Tidak ada tamu yang sedang aktif berada di area sekolah saat ini.
                </div>
              )}
            </div>
          </div>
        )}

        {/* SLIDE 3: KEDISIPLINAN & REKAP KAMPUS HARI INI */}
        {currentSlide === 3 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    RINGKASAN KEDISIPLINAN & KETERTIBAN KAMPUS
                  </h2>
                  <p className="text-xs text-slate-400">
                    Statistik kedatangan siswa, izin keluar gerbang, dan pembinaan karakter
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-800">
                SLIDE 4 / 4
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Terlambat Hari Ini
                </span>
                <div className="text-4xl font-black text-rose-400 font-mono">
                  {todayTardy.length}
                </div>
                <p className="text-[11px] text-slate-500">Menjalani Pembinaan Piket</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Siswa Izin di Luar (Gate Pass)
                </span>
                <div className="text-4xl font-black text-amber-400 font-mono">
                  {activePermits.length}
                </div>
                <p className="text-[11px] text-slate-500">Dispensasi & Surat Resmi</p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-2">
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                  Pos Piket Siaga Aktif
                </span>
                <div className="text-4xl font-black text-emerald-400 font-mono">
                  {todaySchedules.length}
                </div>
                <p className="text-[11px] text-slate-500">100% Tercover Petugas</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM RUNNING TICKER */}
      <footer className="relative z-10 bg-slate-900 border-t border-slate-800/80 px-8 py-3 flex items-center gap-4">
        <div className="px-3 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shrink-0 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> PENGUMUMAN
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee text-xs font-semibold text-slate-300">
            Selamat Datang di {settings.schoolName} • Harap seluruh tamu melapor dan mengenakan Visitor Badge di Pos Piket • Siswa yang meninggalkan area sekolah wajib membawa Surat Izin Resmi dari Guru Piket • Jaga selalu kebersihan dan ketertiban lingkungan belajar bersama.
          </div>
        </div>
      </footer>
    </div>
  );
};
