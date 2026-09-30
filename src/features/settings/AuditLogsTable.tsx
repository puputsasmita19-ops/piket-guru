import React from 'react';
import { AuditLogRecord } from '../../types/master.types';
import { Badge } from '../../components/common/Badge';
import { formatIndonesianDate } from '../../utils/dateUtils';

interface AuditLogsTableProps {
  logs: AuditLogRecord[];
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ logs }) => {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
        <tr>
          <th className="p-4">Waktu</th>
          <th className="p-4">Pengguna</th>
          <th className="p-4">Modul</th>
          <th className="p-4">Aksi</th>
          <th className="p-4">Rincian Perubahan / Aktivitas</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {logs.slice(0, 50).map((log) => (
          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
            <td className="p-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
              {formatIndonesianDate(log.timestamp)}{' '}
              <span className="text-slate-400">
                {log.timestamp.includes('T') ? log.timestamp.split('T')[1]?.substring(0, 8) : ''}
              </span>
            </td>
            <td className="p-4 font-bold text-slate-900 dark:text-white">
              <div>{log.userName}</div>
              <span className="text-[10px] text-slate-400 font-mono font-normal">[{log.role}]</span>
            </td>
            <td className="p-4">
              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px]">
                {log.module}
              </span>
            </td>
            <td className="p-4">
              <Badge
                variant={
                  log.action === 'CREATE'
                    ? 'success'
                    : log.action === 'DELETE'
                    ? 'danger'
                    : log.action === 'UPDATE' || log.action === 'STATUS_CHANGE'
                    ? 'warning'
                    : 'info'
                }
                size="sm"
              >
                {log.action}
              </Badge>
            </td>
            <td className="p-4 text-slate-700 dark:text-slate-300 max-w-md truncate">
              {log.details}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
