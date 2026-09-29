import React from 'react';
import { ScheduleItem, AttendanceRecord } from '../../types';
import { VisitorRecord } from '../../types/visitor.types';
import { IncidentRecord } from '../../types/incident.types';
import { Badge } from '../../components/common/Badge';
import {
  MapPin,
  ShieldCheck,
  Users,
  AlertTriangle,
  UserCheck,
  Building,
  Radio,
  DoorOpen,
} from 'lucide-react';

interface CampusMapViewerProps {
  schedules: ScheduleItem[];
  attendance: AttendanceRecord[];
  visitors: VisitorRecord[];
  incidents: IncidentRecord[];
  onSelectPost: (postName: string) => void;
}

export const CampusMapViewer: React.FC<CampusMapViewerProps> = ({
  schedules,
  attendance,
  visitors,
  incidents,
  onSelectPost,
}) => {
  const posts = [
    {
      id: 'post-1',
      name: 'Pos Gerbang Utama & Satpam',
      code: 'POS-01',
      x: '15%',
      y: '70%',
      type: 'SECURITY',
      desc: 'Pemeriksaan tamu masuk, presensi siswa terlambat & izin gerbang',
    },
    {
      id: 'post-2',
      name: 'Lobi & Ruang Piket Utama (Gedung A)',
      code: 'POS-02',
      x: '38%',
      y: '35%',
      type: 'MAIN_DUTY',
      desc: 'Pusat koordinasi jurnal piket, buku tamu & penerimaan surat',
    },
    {
      id: 'post-3',
      name: 'Koridor Kelas & Gedung B',
      code: 'POS-03',
      x: '68%',
      y: '28%',
      type: 'CLASSROOMS',
      desc: 'Pengawasan ketertiban kelas, KBM & monitoring guru inval',
    },
    {
      id: 'post-4',
      name: 'Perpustakaan, Lab & UKS (Gedung C)',
      code: 'POS-04',
      x: '82%',
      y: '65%',
      type: 'FACILITIES',
      desc: 'Penanganan siswa sakit di UKS & pembinaan literasi disiplin',
    },
    {
      id: 'post-5',
      name: 'Area Lapangan & Kantin Sekolah',
      code: 'POS-05',
      x: '45%',
      y: '78%',
      type: 'OUTDOOR',
      desc: 'Pengawasan jam istirahat, kebersihan lingkungan & kantin',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>Peta Interaktif Sebaran Pos & Titik Pengawasan Kampus</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Pos Aktif (Terisi)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Lobi / Tamu
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Observasi
          </span>
        </div>
      </div>

      {/* INTERACTIVE MAP CONTAINER */}
      <div className="relative w-full aspect-[16/9] min-h-[380px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl p-4 select-none">
        {/* CAMPUS SCHEMATIC GRID BACKGROUND */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #3b82f6 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* ROADWAYS & PATHWAY CONNECTORS */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 stroke-blue-400 stroke-dasharray-[4_4]">
          <line x1="15%" y1="70%" x2="45%" y2="78%" strokeWidth="2" />
          <line x1="15%" y1="70%" x2="38%" y2="35%" strokeWidth="2" />
          <line x1="38%" y1="35%" x2="68%" y2="28%" strokeWidth="2" />
          <line x1="68%" y1="28%" x2="82%" y2="65%" strokeWidth="2" />
          <line x1="45%" y1="78%" x2="82%" y2="65%" strokeWidth="2" />
        </svg>

        {/* CAMPUS ZONES */}
        <div className="absolute top-4 left-4 text-[10px] font-mono text-slate-400 bg-slate-800/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
          <Building className="w-3.5 h-3.5 text-blue-400" />
          <span>DENAH KAMPUS SEKOLAH TERPADU</span>
        </div>

        {/* POST NODES */}
        {posts.map((post) => {
          const assignedSchedules = schedules.filter((s) => s.ruangName.toLowerCase().includes(post.name.toLowerCase().split(' ')[0]) || s.ruangName.includes(post.code));
          const hasDuty = assignedSchedules.length > 0;
          const activeVisitorsInZone = visitors.filter((v) => v.status === 'SEDANG_BERKUNJUNG');

          return (
            <div
              key={post.id}
              style={{ left: post.x, top: post.y }}
              onClick={() => onSelectPost(post.name)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            >
              {/* Pulse Ring */}
              <div className="absolute -inset-2 bg-blue-500/20 rounded-full animate-ping pointer-events-none group-hover:bg-emerald-500/30" />

              {/* Node Card */}
              <div className="relative bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 text-white p-2.5 sm:p-3 rounded-2xl border border-slate-700 hover:border-emerald-500 transition-all shadow-xl max-w-[170px] sm:max-w-[200px]">
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <span className="text-[10px] font-mono font-bold text-blue-400">
                    {post.code}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" />
                </div>

                <h5 className="font-bold text-[11px] leading-tight text-slate-100 truncate">
                  {post.name}
                </h5>

                <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-400" />
                    <span>{hasDuty ? `${assignedSchedules.length} Petugas` : 'Pos Siaga'}</span>
                  </div>
                  {post.type === 'SECURITY' && (
                    <div className="text-[9px] text-amber-400 font-medium">
                      {activeVisitorsInZone.length} Tamu di Sekolah
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
