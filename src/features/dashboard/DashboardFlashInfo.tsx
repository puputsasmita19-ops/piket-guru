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
  const change = (delta: number) => {
    if (slides.length > 1) setSelectedId(slides[(index + delta + slides.length) % slides.length].id);
  };
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
    if (!config.enabled || !config.autoPlay || suspended || paused || interacting || focused || hidden || reducedMotion || dragging || slides.length < 2) return;
    const timer = window.setTimeout(() => change(1), config.intervalMs);
    return () => window.clearTimeout(timer);
  }, [config.enabled, config.autoPlay, config.intervalMs, suspended, paused, interacting, focused, hidden, reducedMotion, dragging, ids, slide?.id]);
  if (!slide) return null;
  return <section className="dashboard-flash" aria-label="Flash info sekolah" aria-roledescription="carousel"
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
      <div className="flash-track" style={{ transform: `translate3d(${-index * 100}%, 0, 0)` }}>
        {slides.map((item, position) => {
          const Icon = item.icon;
          const active = index === position;
          return <div key={item.id} className={`flash-slide ${item.id === 'activity' ? 'flash-activity-slide' : ''}`} role="group" aria-roledescription="slide" aria-label={`${position + 1} dari ${slides.length}: ${item.title}`} aria-hidden={!active} inert={!active}>
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
