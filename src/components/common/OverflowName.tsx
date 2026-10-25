import React, { useEffect, useRef, useState } from 'react';
import { sanitizeNameMarqueeConfig, type NameMarqueeConfig } from '../../types/dashboardInfo.types';
/** Animate only genuine overflow; no timers, no measuring hidden names in advance. */
export function OverflowName({ name, config, className = '' }: { name: string; config?: NameMarqueeConfig | null; className?: string }) {
  const settings = sanitizeNameMarqueeConfig(config);
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const update = () => setOverflow(Boolean(box.current && text.current && text.current.scrollWidth > box.current.clientWidth + 2));
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (box.current) observer?.observe(box.current);
    if (text.current) observer?.observe(text.current);
    if (!observer && typeof window !== 'undefined') window.addEventListener('resize', update);
    return () => { observer?.disconnect(); if (!observer && typeof window !== 'undefined') window.removeEventListener('resize', update); };
  }, [name]);
  const scrolling = settings.enabled && overflow;
  return <span ref={box} className={`overflow-name ${className}`} role="text" aria-label={name} title={name}
      data-scrolling={scrolling ? 'true' : 'false'} style={{ '--name-scroll-duration': `${settings.durationSeconds}s` } as React.CSSProperties}>
    <span className="overflow-name-track">
      <span ref={text} className="overflow-name-copy" aria-hidden="true">{name}</span>
      {scrolling && <span className="overflow-name-copy overflow-name-clone" aria-hidden="true">{name}</span>}
    </span>
  </span>;
}
