import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import type { SchoolSettings } from '../types';
import { getHistoryRange, todayWib, type HistoryPeriodValue } from '../utils/historyPeriod';

export function useHistoryPeriod(settings: SchoolSettings) {
  const [today, setToday] = useState(todayWib);
  const [value, setValue] = useState<HistoryPeriodValue>(() => ({ mode: 'month', anchor: '', semester: 'current', from: todayWib(), to: todayWib() }));
  useEffect(() => { const refresh = () => setToday(todayWib()); const timer = setInterval(refresh, 15000); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); }; }, []);
  const range = getHistoryRange(value, today, settings.academicSemester);
  const constraints = useMemo(() => range.error ? [] : range.start === range.end ? [where('tanggal', '==', range.start)] : [where('tanggal', '>=', range.start), where('tanggal', '<=', range.end)], [range.start, range.end, range.error]);
  return { value, setValue, range, constraints, today, key: `${range.start}:${range.end}:${range.error}` };
}

export function useHistoryPagination<T>(records: T[], key: string, pageSize = 15) {
  const [requestedPage, setPage] = useState(1);
  useEffect(() => setPage(1), [key]);
  const pages = Math.max(1, Math.ceil(records.length / pageSize)), page = Math.min(requestedPage, pages);
  return { records: records.slice((page - 1) * pageSize, page * pageSize), page, pages, setPage, total: records.length, pageSize };
}
