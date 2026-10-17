import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from '../../components/icons';
import type { DashboardInfoConfig, DashboardInfoPanel } from '../../types/dashboardInfo.types';

export interface DashboardFlashSlide {
  id: DashboardInfoPanel | 'activity';
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; title: string; detail?: string }[];
  emptyText: string;
  description?: string;
  illustration?: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  expanded?: boolean;
}

/** One horizontal viewport. Rotating/swiping only changes presentation, never queries. */
export function DashboardFlashInfo({ slides, config, suspended = false, onAnnouncements }: { slides: DashboardFlashSlide[]; config: DashboardInfoConfig; suspended?: boolean; onAnnouncements: () => void }) {
  const [selectedId, setSelectedId] = useState<DashboardFlashSlide['id']>('activity');
  const [edge, setEdge] = useState<-1 | 0 | 1>(0);
  const [snap, setSnap] = useState(true);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const index = Math.max(0, slides.findIndex(s => s.id === selectedId));
  const slide = slides[index];
  const ids = slides.map(s => s.id).join(',');
  const trackIndex = slides.length > 1 ? edge === -1 ? 0 : edge === 1 ? slides.length + 1 : index + 1 : index;
  const change = (delta: number) => {
    if (slides.length < 2 || movingRef.current) return;
    const next = index + delta;
    movingRef.current = true;
    setMoving(true);
    setSnap(false);
    setEdge(next < 0 ? -1 : next >= slides.length ? 1 : 0);
    setSelectedId(slides[(next + slides.length) % slides.length].id);
  };
  const finishMove = () => {
    if (!movingRef.current) return;
    if (edge !== 0) {
      // The edge copy is identical: reset to the real card without crossing the other cards.
      setSnap(true); setEdge(0);
    } else {
      movingRef.current = false; setMoving(false);
    }
  };
  useEffect(() => {
    movingRef.current = false; setMoving(false); setEdge(0); setSnap(true);
  }, [ids]);
  useEffect(() => {
    if (!snap) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      setSnap(false); movingRef.current = false; setMoving(false);
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [snap]);
  useEffect(() => {
    if (!moving) return;
    // transitionend may be skipped by reduced-motion, background tabs or interrupted CSS.
    const fallback = window.setTimeout(finishMove, reducedMotion || hidden ? 0 : 750);
    return () => window.clearTimeout(fallback);
  }, [moving, edge, reducedMotion, hidden]);
  useEffect(() => {
    if (slides.length && !slides.some(item => item.id === selectedId)) setSelectedId(slides[0].id);
  }, [ids, selectedId]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    if (!config.enabled || !config.autoPlay || suspended || paused || interacting || focused || hidden || reducedMotion || dragging || moving || slides.length < 2) return;
    const timer = window.setTimeout(() => change(1), config.intervalMs);
    return () => window.clearTimeout(timer);
  }, [config.enabled, config.autoPlay, config.intervalMs, suspended, paused, interacting, focused, hidden, reducedMotion, dragging, moving, ids, slide?.id]);
  if (!slide) return null;
  const originals = slides.map((item, logicalIndex) => ({ item, logicalIndex, clone: false, key: item.id }));
  const cards = slides.length > 1 ? [
    { item: slides[slides.length - 1], logicalIndex: slides.length - 1, clone: true, key: 'loop-before' },
    ...originals,
    { item: slides[0], logicalIndex: 0, clone: true, key: 'loop-after' },
  ] : originals;
  return <section className="dashboard-flash" data-transitioning={moving} aria-label="Flash info sekolah" aria-roledescription="carousel"
    onPointerEnter={e => { if (e.pointerType === 'mouse') setInteracting(true); }} onPointerLeave={e => { if (e.pointerType === 'mouse') setInteracting(false); }}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
    onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); change(e.key === 'ArrowRight' ? 1 : -1); } }}>
    <div className="flash-heading"><span className="flash-eyebrow">{slide.id === 'activity' ? 'HARI INI' : 'FLASH INFO'}</span><button type="button" className="flash-announcements" onClick={onAnnouncements}>Papan pengumuman</button><span className="flash-page">{index + 1} / {slides.length}</span></div>
    <div className="flash-viewport"
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0 || (e.target as HTMLElement).closest('button, a, input')) return;
        gesture.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
        setDragging(true); e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={e => {
        const start = gesture.current;
        gesture.current = null; setDragging(false);
        if (!start || start.pointerId !== e.pointerId) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) change(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => { gesture.current = null; setDragging(false); }}>
      <div className={`flash-track ${snap ? 'flash-track-snap' : ''}`} style={{ transform: `translate3d(${-trackIndex * 100}%, 0, 0)` }}
        onTransitionEnd={e => { if (e.target === e.currentTarget && e.propertyName === 'transform') finishMove(); }}>
        {cards.map(({ item, logicalIndex, clone, key }, position) => {
          const Icon = item.icon;
          const active = trackIndex === position;
          return <div key={key} data-loop-clone={clone || undefined} className={`flash-slide ${item.id === 'activity' ? 'flash-activity-slide' : ''}`} role="group" aria-roledescription="slide" aria-label={`${logicalIndex + 1} dari ${slides.length}: ${item.title}`} aria-hidden={!active} inert={!active}>
            {item.id === 'activity' ? <div className="flash-activity">{item.illustration}<div className="min-w-0"><h2>{item.title}</h2><p className="flash-activity-description">{item.description}</p></div></div> : <>
              <h2><Icon className="w-4 h-4 shrink-0" /><span>{item.title}</span></h2>
              <div className="flash-content">{item.items.length ? <ul>{item.items.slice(0, 3).map(row => <li key={row.id}><p className="flash-item-title">{row.title}</p>{row.detail && <p className="flash-item-detail">{row.detail}</p>}</li>)}</ul> : <p className="flash-empty">{item.emptyText}</p>}</div>
            </>}
          </div>;
        })}
      </div>
    </div>
    <div className="flash-controls">
      <button type="button" className="flash-open" onClick={slide.onAction} aria-expanded={slide.id === 'activity' ? slide.expanded : undefined} aria-controls={slide.id === 'activity' ? 'personal-duty-details' : undefined}>{slide.actionLabel}<ChevronRight className="w-3.5 h-3.5 shrink-0" /></button>
      <div className="flex shrink-0 gap-1">
        <button type="button" className="flash-control" aria-label="Info sebelumnya" disabled={slides.length < 2} onClick={() => change(-1)}><ChevronLeft className="w-4 h-4" /></button>
        {config.autoPlay && !reducedMotion && slides.length > 1 && <button type="button" className="flash-control" aria-label={paused ? 'Putar flash info' : 'Jeda flash info'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>}
        <button type="button" className="flash-control" aria-label="Info berikutnya" disabled={slides.length < 2} onClick={() => change(1)}><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  </section>;
}
