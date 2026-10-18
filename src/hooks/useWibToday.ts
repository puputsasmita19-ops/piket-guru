import { useEffect, useState } from 'react';
import { getTodayISODate } from '../utils/dateUtils';
export function useWibToday() {
  const [today, setToday] = useState(getTodayISODate);
  useEffect(() => { const update = () => setToday(getTodayISODate()); const timer = setInterval(update, 15000); document.addEventListener('visibilitychange', update); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); }; }, []);
  return today;
}
