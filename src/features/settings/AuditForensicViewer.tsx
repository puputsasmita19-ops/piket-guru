import React, { useState } from 'react';
import {
  Search,
  Download,
  Printer,
  ShieldCheck,
  Eye,
  Filter,
  AlertTriangle,
  Flame,
  KeyRound,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { AuditLogPrintModal } from './AuditLogPrintModal';
import { AuditLogRecord } from '../../types/master.types';
import { SchoolSettings } from '../../types';
import { ExportUtils } from '../../utils/exportUtils';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface AuditForensicViewerProps {
  logs: AuditLogRecord[];
  settings: SchoolSettings;
}

export const AuditForensicViewer: React.FC<AuditForensicViewerProps> = ({ logs, settings }) => {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('SEMUA');
  const [actionFilter, setActionFilter] = useState('SEMUA');
  const [inspectingLog, setInspectingLog] = useState<AuditLogRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const matchMod = moduleFilter === 'SEMUA' || log.module === moduleFilter;
    const matchAct = actionFilter === 'SEMUA' || log.action === actionFilter;
    const matchSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.module.toLowerCase().includes(search.toLowerCase());

    return matchMod && matchAct && matchSearch;
  });

  const handleExportCsv = () => {
    const headers = [
      'Waktu',
      'Pengguna',
      'Peran/Role',
      'Aksi',
      'Modul',
      'Rincian Aktivitas',
      'ID Rekaman Terkait',
    ];
    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.userName,
      log.role,
      log.action,
      log.module,
      log.details,
      log.recordId || '-',
    ]);

    ExportUtils.exportToCsv(`Audit_Logs_Forensik_${Date.now()}`, headers, rows);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge variant="success" size="sm">CREATE</Badge>;
      case 'DELETE':
        return <Badge variant="danger" size="sm">DELETE</Badge>;
      case 'UPDATE':
      case 'STATUS_CHANGE':
        return <Badge variant="warning" size="sm">{action}</Badge>;
      case 'EMERGENCY':
        return (
          <Badge variant="danger" size="sm" icon={<Flame className="w-3 h-3" />}>
            EMERGENCY
          </Badge>
        );
      case 'SECURITY':
        return (
          <Badge variant="warning" size="sm" icon={<KeyRound className="w-3 h-3" />}>
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

  return (
    <div className="space-y-4">
      {/* Control Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari aktivitas, nama pengguna, kata kunci..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Modul</option>
                <option value="USERS">USERS</option>
                <option value="SCHEDULES">SCHEDULES</option>
                <option value="ATTENDANCE">ATTENDANCE</option>
                <option value="DUTY_BOOK">DUTY_BOOK</option>
                <option value="INCIDENTS">INCIDENTS</option>
                <option value="TARDINESS">TARDINESS</option>
                <option value="PERMITS">PERMITS</option>
                <option value="SUBSTITUTIONS">SUBSTITUTIONS</option>
                <option value="VISITORS">VISITORS</option>
                <option value="SETTINGS">SETTINGS</option>
                <option value="SECURITY">SECURITY</option>
                <option value="SYSTEM">SYSTEM</option>
              </select>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Aksi</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="EMERGENCY">EMERGENCY</option>
                <option value="SECURITY">SECURITY</option>
                <option value="BACKUP">BACKUP</option>
                <option value="RESTORE">RESTORE</option>
                <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                <option value="LOGIN">LOGIN</option>
              </select>

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
                Ekspor CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card>
        <CardHeader
          title={`Jejak Audit Forensik & Rekam Jejak Sistem (${filteredLogs.length})`}
          subtitle="Pencatatan real-time terhadap seluruh penambahan, pengubahan, penghapusan, dan aksi darurat"
        />
        <CardContent className="p-0">
          <div className="max-h-[580px] overflow-y-auto overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold shadow-xs">
                <tr>
                  <th className="p-4 w-36 whitespace-nowrap">Waktu Kejadian</th>
                  <th className="p-4 whitespace-nowrap">Pengguna</th>
                  <th className="p-4 whitespace-nowrap">Modul</th>
                  <th className="p-4 whitespace-nowrap">Aksi</th>
                  <th className="p-4 whitespace-nowrap">Rincian Perubahan</th>
                  <th className="p-4 text-center w-16 whitespace-nowrap">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.slice(0, 100).map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      <div>{formatIndonesianDate(log.timestamp)}</div>
                      <span className="text-slate-400">
                        {log.timestamp.includes('T') ? log.timestamp.split('T')[1]?.substring(0, 8) : ''} WIB
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <div>{log.userName}</div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        [{log.role}]
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] text-slate-700 dark:text-slate-300">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300 max-w-sm sm:max-w-md truncate">
                      {log.details}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setInspectingLog(log)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                        title="Lihat Raw Metadata"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* RAW JSON INSPECTION MODAL */}
      {inspectingLog && (
        <Modal
          isOpen={!!inspectingLog}
          onClose={() => setInspectingLog(null)}
          title="Inspeksi Metadata Log Audit Forensik"
          maxWidth="md"
        >
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
              <pre>{JSON.stringify(inspectingLog, null, 2)}</pre>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setInspectingLog(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PRINT OFFICIAL MODAL */}
      <AuditLogPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        logs={filteredLogs}
        settings={settings}
      />
    </div>
  );
};
