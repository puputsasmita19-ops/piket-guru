import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  KeyRound,
  Lock,
  FileText,
  Calendar,
  User,
  Copy,
  Check,
  Activity,
  Layers,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AuditLogPrintModal } from './AuditLogPrintModal';
import { AuditLogRecord, AuditLogAction, AuditLogModule } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { ExportUtils } from '../../utils/exportUtils';
import { formatIndonesianDate, formatTime } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import {
  AUDIT_MODULE_REGISTRY,
  AUDIT_ACTION_REGISTRY,
  AUDIT_STATUS_REGISTRY,
  normalizeAuditStatus,
  getAuditModuleLabel,
  getAuditActionLabel,
  getAuditStatusMeta,
} from '../../services/audit/auditEventRegistry';

interface AuditForensicViewerProps {
  logs: AuditLogRecord[];
  settings: SchoolSettings;
}

export const AuditForensicViewer: React.FC<AuditForensicViewerProps> = ({ logs, settings }) => {
  const { currentUser, hasRole } = useAuth();
  const isAuthorized = hasRole('ADMIN', 'KEPALA_SEKOLAH');

  // Filter States
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [moduleFilter, setModuleFilter] = useState('SEMUA');
  const [actionFilter, setActionFilter] = useState('SEMUA');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | 'SUCCESS' | 'FAILED' | 'BLOCKED'>('SEMUA');

  // Modals & Inspection State
  const [inspectingLog, setInspectingLog] = useState<AuditLogRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [activeInspectTab, setActiveInspectTab] = useState<'details' | 'metadata' | 'raw'>('details');

  // Reset all filters in one click
  const handleResetFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setModuleFilter('SEMUA');
    setActionFilter('SEMUA');
    setStatusFilter('SEMUA');
  };

  const isFilterActive =
    search.trim() !== '' ||
    startDate !== '' ||
    endDate !== '' ||
    moduleFilter !== 'SEMUA' ||
    actionFilter !== 'SEMUA' ||
    statusFilter !== 'SEMUA';

  // Multi-criteria Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Module Filter
      if (moduleFilter !== 'SEMUA' && log.module !== moduleFilter) {
        return false;
      }

      // 2. Action Filter
      if (actionFilter !== 'SEMUA' && log.action !== actionFilter) {
        return false;
      }

      // 3. Status Filter (normalizing legacy/alias statuses)
      const normalizedStatus = normalizeAuditStatus(log.status);
      if (statusFilter !== 'SEMUA' && normalizedStatus !== statusFilter) {
        return false;
      }

      // 4. Date Range Filter
      if (startDate || endDate) {
        const logDateStr = log.timestamp.split('T')[0];
        if (startDate && logDateStr < startDate) return false;
        if (endDate && logDateStr > endDate) return false;
      }

      // 5. Text Search (matches actor name, loginId, role, details, target, module, action, status)
      if (search.trim()) {
        const q = search.toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const loginId = (log.loginId || '').toLowerCase();
        const role = (log.role || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const target = (log.target || '').toLowerCase();
        const recordId = (log.recordId || '').toLowerCase();
        const modName = getAuditModuleLabel(log.module).toLowerCase();
        const actName = getAuditActionLabel(log.action).toLowerCase();
        const statusMeta = getAuditStatusMeta(log.status);
        const statusLabel = statusMeta.label.toLowerCase();

        const match =
          userName.includes(q) ||
          loginId.includes(q) ||
          role.includes(q) ||
          details.includes(q) ||
          target.includes(q) ||
          recordId.includes(q) ||
          modName.includes(q) ||
          actName.includes(q) ||
          statusLabel.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [logs, moduleFilter, actionFilter, statusFilter, startDate, endDate, search]);

  // Forensic Summary Metrics derived from filtered logs
  const metrics = useMemo(() => {
    let successCount = 0;
    let failedCount = 0;
    let blockedCount = 0;
    let minDateStr = '';
    let maxDateStr = '';

    for (const log of filteredLogs) {
      const st = normalizeAuditStatus(log.status);
      if (st === 'SUCCESS') successCount++;
      else if (st === 'FAILED') failedCount++;
      else if (st === 'BLOCKED') blockedCount++;

      if (log.timestamp) {
        const d = log.timestamp.split('T')[0];
        if (!minDateStr || d < minDateStr) minDateStr = d;
        if (!maxDateStr || d > maxDateStr) maxDateStr = d;
      }
    }

    let timeRangeText = 'Seluruh Riwayat Log';
    if (startDate && endDate) {
      timeRangeText = `${formatIndonesianDate(startDate)} s.d. ${formatIndonesianDate(endDate)}`;
    } else if (startDate) {
      timeRangeText = `Mulai ${formatIndonesianDate(startDate)}`;
    } else if (endDate) {
      timeRangeText = `Sampai ${formatIndonesianDate(endDate)}`;
    } else if (minDateStr && maxDateStr) {
      timeRangeText =
        minDateStr === maxDateStr
          ? formatIndonesianDate(minDateStr)
          : `${formatIndonesianDate(minDateStr)} — ${formatIndonesianDate(maxDateStr)}`;
    }

    return {
      total: filteredLogs.length,
      successCount,
      failedCount,
      blockedCount,
      timeRangeText,
    };
  }, [filteredLogs, startDate, endDate]);

  // Export to CSV with full forensic data & metadata
  const handleExportCsv = () => {
    const headers = [
      'Waktu Server (ISO)',
      'Tanggal (WIB)',
      'Jam (WIB)',
      'Status Hasil',
      'Pengguna / Aktor',
      'Peran (Role)',
      'ID Login',
      'User ID',
      'Modul / Fitur',
      'Jenis Aksi',
      'Target / Subjek Data',
      'ID Rekaman Terkait',
      'Rincian Aktivitas',
      'Alamat IP',
      'Perangkat / User Agent',
      'ID Log Audit',
      'Metadata JSON',
    ];

    const rows = filteredLogs.map((log) => {
      const dateWib = log.timestamp ? formatIndonesianDate(log.timestamp) : '-';
      const timeWib = log.timestamp ? formatTime(log.timestamp) : '-';
      const statusMeta = getAuditStatusMeta(log.status);

      return [
        log.timestamp,
        dateWib,
        timeWib,
        statusMeta.label,
        log.userName,
        log.role,
        log.loginId || '-',
        log.userId,
        getAuditModuleLabel(log.module),
        getAuditActionLabel(log.action),
        log.target || log.recordId || '-',
        log.recordId || '-',
        log.details,
        log.ipAddress || '-',
        log.userAgent || '-',
        log.id,
        log.metadata ? JSON.stringify(log.metadata) : '-',
      ];
    });

    ExportUtils.exportToCsv(`Audit_Forensik_${settings.schoolName || 'Sekolah'}_${Date.now()}`, headers, rows);
  };

  const handleCopyRawJson = (data: any) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        setCopiedRaw(true);
        setTimeout(() => setCopiedRaw(false), 2500);
      });
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status?: string | null) => {
    const meta = getAuditStatusMeta(status);
    if (meta.id === 'SUCCESS') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Berhasil</span>
        </span>
      );
    }
    if (meta.id === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Gagal</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
        <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Ditolak</span>
      </span>
    );
  };

  // Helper for Action Badge
  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge variant="success" size="sm">CREATE</Badge>;
      case 'DELETE':
        return <Badge variant="danger" size="sm">DELETE</Badge>;
      case 'UPDATE':
        return <Badge variant="warning" size="sm">UPDATE</Badge>;
      case 'STATUS_CHANGE':
        return <Badge variant="warning" size="sm">STATUS_CHANGE</Badge>;
      case 'LOGIN':
        return <Badge variant="info" size="sm">LOGIN</Badge>;
      case 'LOGOUT':
        return <Badge variant="neutral" size="sm">LOGOUT</Badge>;
      case 'ATTENDANCE':
        return <Badge variant="success" size="sm">PRESENSI</Badge>;
      case 'EMERGENCY':
        return (
          <Badge variant="danger" size="sm" icon={<Flame className="w-3 h-3" />}>
            EMERGENCY
          </Badge>
        );
      case 'SECURITY':
        return (
          <Badge variant="danger" size="sm" icon={<KeyRound className="w-3 h-3" />}>
            SECURITY
          </Badge>
        );
      case 'BACKUP':
      case 'RESTORE':
        return <Badge variant="primary" size="sm">{action}</Badge>;
      default:
        return <Badge variant="info" size="sm">{action}</Badge>;
    }
  };

  // Role restriction screen
  if (!isAuthorized) {
    return (
      <Card className="max-w-2xl mx-auto my-8 border-rose-200 dark:border-rose-900/50">
        <CardContent className="p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Akses Ditolak: Hak Akses Tidak Mencukupi
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              Menu <strong>Jejak Audit Forensik & Rekam Jejak Sistem</strong> dilindungi secara ketat dan hanya dapat diakses oleh peran <strong>Administrator</strong> atau <strong>Kepala Sekolah</strong>.
            </p>
          </div>
          <div className="pt-2">
            <span className="text-[11px] font-mono text-slate-400">
              Peran Akun Anda: [{currentUser?.role || 'TAMU'}]
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. FORENSIC SUMMARY METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold">
            <span>Total Log Sesuai Filter</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-[11px] text-slate-400">dari {logs.length}</span>
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {metrics.timeRangeText}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span>Berhasil Diproses</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              {metrics.successCount}
            </span>
            {metrics.total > 0 && (
              <span className="text-[11px] font-mono text-emerald-600/80">
                ({Math.round((metrics.successCount / metrics.total) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            Aksi valid & tervalidasi
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs font-semibold">
            <span>Gagal Diproses</span>
            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
              {metrics.failedCount}
            </span>
            {metrics.total > 0 && (
              <span className="text-[11px] font-mono text-rose-600/80">
                ({Math.round((metrics.failedCount / metrics.total) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80">
            Salah PIN, format / jaringan
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs font-semibold">
            <span>Ditolak / Dibatasi</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400">
              {metrics.blockedCount}
            </span>
            {metrics.total > 0 && (
              <span className="text-[11px] font-mono text-amber-600/80">
                ({Math.round((metrics.blockedCount / metrics.total) * 100)}%)
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            Hak akses, akun kunci/nonaktif
          </div>
        </div>
      </div>

      {/* 2. ADVANCED MULTI-CRITERIA FILTER BAR */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari aktor, ID Login, target, rincian aktivitas, modul, status..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Action buttons: Print & CSV Export */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => setIsPrintModalOpen(true)}
              >
                Cetak Dokumen
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportCsv}
              >
                Ekspor CSV ({filteredLogs.length})
              </Button>
            </div>
          </div>

          {/* Secondary filter row: Dates, Module, Action, Status, Reset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
            {/* Date Range: Start */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Dari Tanggal</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
            </div>

            {/* Date Range: End */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Sampai Tanggal</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
              />
            </div>

            {/* Module Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Modul / Fitur</span>
              </label>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Modul ({logs.length})</option>
                {Object.values(AUDIT_MODULE_REGISTRY).map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.label} ({mod.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-slate-400" />
                <span>Jenis Aksi</span>
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Aksi</option>
                {Object.values(AUDIT_ACTION_REGISTRY).map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.label} ({act.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Result Status Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <span>Status Hasil</span>
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="SUCCESS">✅ Berhasil (Success)</option>
                <option value="FAILED">❌ Gagal (Failed)</option>
                <option value="BLOCKED">⚠️ Ditolak / Dibatasi (Blocked)</option>
              </select>
            </div>
          </div>

          {/* Filter Status & One-Click Reset Button */}
          {isFilterActive && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <div className="flex items-center gap-2 text-slate-500">
                <Filter className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  Menampilkan <strong>{filteredLogs.length}</strong> rekaman sesuai filter aktif
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Seluruh Filter</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. MAIN FORENSIC AUDIT TABLE */}
      <Card>
        <CardHeader
          title={`Jejak Audit Forensik & Rekam Jejak Sistem (${filteredLogs.length} Log)`}
          subtitle="Pencatatan real-time terhadap seluruh login PIN/Google, transaksi operasional, hak akses, dan aksi sistem"
        />
        <CardContent className="p-0">
          <div className="max-h-[640px] overflow-y-auto overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold shadow-xs">
                <tr>
                  <th className="p-3.5 w-36 whitespace-nowrap">Waktu Kejadian</th>
                  <th className="p-3.5 whitespace-nowrap text-center">Status</th>
                  <th className="p-3.5 whitespace-nowrap">Modul & Fitur</th>
                  <th className="p-3.5 whitespace-nowrap">Aksi</th>
                  <th className="p-3.5 whitespace-nowrap">Aktor / Pengguna</th>
                  <th className="p-3.5 whitespace-nowrap">Target / Subjek</th>
                  <th className="p-3.5 whitespace-nowrap min-w-[240px]">Rincian Aktivitas</th>
                  <th className="p-3.5 text-center w-20 whitespace-nowrap">Investigasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-sm text-slate-600 dark:text-slate-300">
                        Tidak ada log audit yang sesuai
                      </div>
                      <p className="text-xs max-w-sm mx-auto text-slate-400">
                        Tidak ditemukan aktivitas log yang cocok dengan kriteria filter saat ini. Coba bersihkan filter pencarian.
                      </p>
                      {isFilterActive && (
                        <div className="pt-2">
                          <Button variant="outline" size="sm" onClick={handleResetFilters}>
                            Bersihkan Filter
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.slice(0, 150).map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Waktu */}
                      <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatIndonesianDate(log.timestamp)}
                        </div>
                        <span className="text-slate-400">
                          {formatTime(log.timestamp)} WIB
                        </span>
                      </td>

                      {/* Status Hasil */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(log.status)}
                      </td>

                      {/* Modul */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300"
                          title={log.module}
                        >
                          {getAuditModuleLabel(log.module)}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="p-3.5 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>

                      {/* Aktor / Pengguna */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{log.userName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">[{log.role}]</span>
                          {log.loginId && <span>• ID: {log.loginId}</span>}
                        </div>
                      </td>

                      {/* Target / Subjek */}
                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                        {log.target || log.recordId || '-'}
                      </td>

                      {/* Rincian Aktivitas */}
                      <td className="p-3.5 text-slate-700 dark:text-slate-300 leading-snug">
                        <div className="max-w-md sm:max-w-lg line-clamp-2" title={log.details}>
                          {log.details}
                        </div>
                      </td>

                      {/* Tombol Investigasi */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingLog(log);
                            setActiveInspectTab('details');
                          }}
                          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer mx-auto"
                          title="Buka Investigasi Lengkap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 150 && (
            <div className="p-3 text-center text-slate-400 text-[11px] bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              Menampilkan 150 rekaman pertama dari <strong>{filteredLogs.length}</strong> log. Gunakan filter untuk mempersempit hasil atau lakukan Ekspor CSV untuk mengunduh seluruh rekaman.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. STRUCTURED FORENSIC INVESTIGATION DETAIL MODAL */}
      {inspectingLog && (
        <Modal
          isOpen={!!inspectingLog}
          onClose={() => setInspectingLog(null)}
          title={`Detail Investigasi Forensik Log #${inspectingLog.id}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Top Highlight Header Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                {renderStatusBadge(inspectingLog.status)}
                {renderActionBadge(inspectingLog.action)}
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200">
                  {getAuditModuleLabel(inspectingLog.module)}
                </span>
              </div>
              <div className="font-mono text-slate-500 text-[11px] text-right">
                <div>{formatIndonesianDate(inspectingLog.timestamp)}</div>
                <div className="text-slate-400">{formatTime(inspectingLog.timestamp)} WIB</div>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveInspectTab('details')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                  activeInspectTab === 'details'
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Informasi & Konteks
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectTab('metadata')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer flex items-center gap-1 ${
                  activeInspectTab === 'metadata'
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Metadata Forensik</span>
                {inspectingLog.metadata && Object.keys(inspectingLog.metadata).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveInspectTab('raw')}
                className={`px-3 py-1.5 rounded-xl font-bold transition text-xs cursor-pointer ${
                  activeInspectTab === 'raw'
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Bukti Mentah (Raw JSON)
              </button>
            </div>

            {/* TAB 1: DETAILS & CONTEXT */}
            {activeInspectTab === 'details' && (
              <div className="space-y-4">
                {/* Full Details Box */}
                <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-1">
                  <div className="text-[11px] font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Deskripsi Aktivitas Lengkap:</span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {inspectingLog.details}
                  </p>
                </div>

                {/* Section 1: Identitas Aktor */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-500" />
                    <span>Identitas Pelaksana (Aktor)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Nama Lengkap</div>
                      <div className="font-bold text-slate-900 dark:text-white">{inspectingLog.userName}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Peran (Role)</div>
                      <div className="font-bold font-mono text-blue-600 dark:text-blue-400">
                        {inspectingLog.role}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">ID Login Pengguna</div>
                      <div className="font-mono">{inspectingLog.loginId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">User ID (UID Firebase)</div>
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {inspectingLog.userId}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Alamat IP Aktor</div>
                      <div className="font-mono text-slate-700 dark:text-slate-300">
                        {inspectingLog.ipAddress || 'Internal / Cloud Run'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Perangkat / User Agent</div>
                      <div className="font-mono text-[10px] text-slate-500 truncate" title={inspectingLog.userAgent}>
                        {inspectingLog.userAgent || '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Konteks Aksi & Sasaran Data */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span>Objek & Sasaran Tindakan</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400 text-[11px]">Modul Terkait</div>
                      <div className="font-semibold">{getAuditModuleLabel(inspectingLog.module)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Jenis Tindakan</div>
                      <div className="font-semibold">{getAuditActionLabel(inspectingLog.action)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Target / Subjek Data</div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {inspectingLog.target || inspectingLog.recordId || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">ID Rekaman Dokumen</div>
                      <div className="font-mono text-slate-600 dark:text-slate-400">
                        {inspectingLog.recordId || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STRUCTURED METADATA */}
            {activeInspectTab === 'metadata' && (
              <div className="space-y-3">
                {inspectingLog.metadata && Object.keys(inspectingLog.metadata).length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-slate-500 text-[11px]">
                      Metadata operasional tambahan yang terekam saat tindakan diproses:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {Object.entries(inspectingLog.metadata).map(([key, val]) => (
                        <div
                          key={key}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs"
                        >
                          <div className="text-slate-400 text-[10px] uppercase font-bold">{key}</div>
                          <div className="mt-1 font-semibold text-slate-800 dark:text-slate-200 break-words">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl space-y-1">
                    <p className="font-semibold">Tidak Ada Metadata Khusus</p>
                    <p className="text-[11px]">Aksi ini tidak menyertakan payload parameter tambahan.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RAW JSON EVIDENCE */}
            {activeInspectTab === 'raw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Dokumen Bukti Forensik Asli (Firestore Payload)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyRawJson(inspectingLog)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRaw ? 'Tersalin!' : 'Salin JSON'}</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 text-emerald-400 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-80 scrollbar-thin">
                  <pre>{JSON.stringify(inspectingLog, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-mono text-slate-400">ID: {inspectingLog.id}</span>
              <Button variant="outline" size="sm" onClick={() => setInspectingLog(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. PRINT OFFICIAL DOCUMENT MODAL */}
      <AuditLogPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        logs={filteredLogs}
        settings={settings}
      />
    </div>
  );
};
