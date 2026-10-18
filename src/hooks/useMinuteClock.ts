import { useEffect, useState } from 'react';

/** Refresh this small view at minute boundaries, and immediately on returning to it. */
export function useMinuteClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      if (!document.hidden) setNow(Date.now());
      timer = setTimeout(update, 60000 - (Date.now() % 60000) + 20);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return now;
}
