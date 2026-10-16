import { useEffect, useState } from 'react';

// A busy screen must explain a slow connection before two seconds elapse.
export const SLOW_FEEDBACK_MS = 1600;

export function useSlowOperation(busy: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), SLOW_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  return busy && slow;
}
