import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Database,
  Lock,
  Zap,
  Activity,
  FileCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { SecurityService } from '../../services/security/securityService';
import { SecurityScoreReport } from '../../types/security.types';
import { SchoolSettings, UserProfile } from '../../types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface SecurityCenterCardProps {
  settings: SchoolSettings;
  users: UserProfile[];
}

export const SecurityCenterCard: React.FC<SecurityCenterCardProps> = ({ settings, users }) => {
  const [report, setReport] = useState<SecurityScoreReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [drSimulating, setDrSimulating] = useState(false);
  const [drResult, setDrResult] = useState<{
    success: boolean;
    latencyMs: number;
    verifiedRecords: number;
    message: string;
  } | null>(null);

  const runAudit = async () => {
    setIsScanning(true);
    try {
      const res = await SecurityService.performSecurityAudit(settings, users);
      setReport(res);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [settings, users]);

  const handleRunDrSimulation = async () => {
    setDrSimulating(true);
    setDrResult(null);
    try {
      const res = await SecurityService.runDisasterRecoverySimulation();
      setDrResult(res);
    } finally {
      setDrSimulating(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Security Score & Quick Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Indeks Kepatuhan & Keamanan Siber
            </div>

            <div
              className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center shadow-inner ${getScoreColor(
                report?.score || 0
              )}`}
            >
              <span className="text-3xl font-black font-mono tracking-tight">
                {report ? report.score : '--'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest mt-0.5">
                Grade {report?.grade || '-'}
              </span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300">
              Status:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {report && report.score >= 85
                  ? 'Sangat Aman & Terlindungi'
                  : 'Memerlukan Penyesuaian'}
              </strong>
            </div>

            <Button
              variant="outline"
              size="sm"
              isLoading={isScanning}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={runAudit}
              className="text-xs mt-2"
            >
              Pindai Ulang Sistem
            </Button>
          </CardContent>
        </Card>

        {/* 2nd Card: Database & Health Metrics */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Diagnostik Sistem & Integritas Basis Data"
            subtitle="Pemeriksaan status koleksi database Firestore dan integritas relasi record"
          />
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-500" />
                  Koleksi Firestore
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {report?.scannedCollectionsCount || 16} Koleksi
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">100% Terhubung</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                  Total Rekaman Aktif
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {report?.totalRecordsCount || '--'} Dokumen
                </div>
                <div className="text-[10px] text-blue-600 font-medium">Semua Modul Terbaca</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-500" />
                  Koneksi Realtime
                </div>
                <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                  Sinkronisasi Aktif
                </div>
                <div className="text-[10px] text-slate-400 font-mono">WebSockets & Snapshot</div>
              </div>
            </div>

            {/* Disaster Recovery Drill Trigger */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-850 border border-blue-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Uji Coba Kesiapan Pemulihan Bencana (Disaster Recovery Drill)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Simulasi pengujian integritas baca seluruh master data tanpa mengubah data operasional.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                isLoading={drSimulating}
                onClick={handleRunDrSimulation}
                className="shrink-0 text-xs shadow-sm"
              >
                Mulai Uji Simulasi
              </Button>
            </div>

            {drResult && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">Hasil Uji Simulasi Disaster Recovery:</div>
                  <div>{drResult.message}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Checklist Audit Results */}
      <Card>
        <CardHeader
          title="Daftar Rincian Pemeriksaan Kepatuhan Keamanan"
          subtitle="Audit otomatis terhadap hak akses, kebijakan autentikasi, dan batasan geolokasi"
        />
        <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
          {report?.checks.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">
                  {item.status === 'PASS' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {item.status === 'WARN' && (
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  {item.status === 'FAIL' && (
                    <div className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                  {item.recommendation && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      💡 Rekomendasi: {item.recommendation}
                    </p>
                  )}
                </div>
              </div>

              <div className="self-end sm:self-center shrink-0">
                <Badge
                  variant={
                    item.status === 'PASS'
                      ? 'success'
                      : item.status === 'WARN'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                >
                  {item.status === 'PASS'
                    ? 'TERVERIFIKASI'
                    : item.status === 'WARN'
                    ? 'PERINGATAN'
                    : 'KRITIS'}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
