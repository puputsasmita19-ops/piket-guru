import React, { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '../../components/common/UserAvatar';

/** Images are only requested when the roster modal row approaches the viewport. */
export const RosterTeacherAvatar: React.FC<{
  name: string;
  avatarUrl?: string | null;
  isPresent: boolean;
}> = React.memo(({ name, avatarUrl, isPresent }) => {
  const container = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '80px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <span ref={container} className={`inline-flex w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl overflow-hidden border ${isPresent ? 'border-emerald-200 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700'}`}>
      {visible
        ? <UserAvatar thumbnail user={{ fullName: name, avatarUrl }} className="w-full h-full rounded-xl text-sm" />
        : <span aria-hidden="true" className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm">{name.trim().charAt(0).toUpperCase() || 'G'}</span>}
    </span>
  );
});
