import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from '../../components/icons';
import type { DashboardInfoConfig, DashboardInfoPanel } from '../../types/dashboardInfo.types';

export interface DashboardFlashSlide {
  id: DashboardInfoPanel;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; title: string; detail?: string }[];
  emptyText: string;
  actionLabel: string;
  onAction: () => void;
}

/** Uses the dashboard's existing snapshots; rotating never fetches more data. */
export function DashboardFlashInfo({ slides, config, suspended = false }: { slides: DashboardFlashSlide[]; config: DashboardInfoConfig; suspended?: boolean }) {
  const [selectedId, setSelectedId] = useState<DashboardInfoPanel>('announcements');
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const index = Math.max(0, slides.findIndex(s => s.id === selectedId));
  const slide = slides[index];
  const ids = slides.map(s => s.id).join(',');
  const change = (delta: number) => setSelectedId(slides[(index + delta + slides.length) % slides.length].id);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReducedMotion(media.matches);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    if (!config.enabled || !config.autoPlay || suspended || paused || interacting || focused || hidden || reducedMotion || slides.length < 2) return;
    const timer = window.setTimeout(() => change(1), config.intervalMs);
    return () => window.clearTimeout(timer);
  }, [config.enabled, config.autoPlay, config.intervalMs, suspended, paused, interacting, focused, hidden, reducedMotion, ids, slide?.id]);
  if (!config.enabled || !slide) return null;
  const Icon = slide.icon;
  return <section className="dashboard-flash" aria-label="Flash info sekolah" aria-roledescription="carousel"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}>
    <div className="flash-heading"><span className="flash-eyebrow">FLASH INFO</span><span className="flash-page">{index + 1} / {slides.length}</span></div>
    <div key={slide.id} className="flash-slide" role="group" aria-roledescription="slide" aria-label={`${index + 1} dari ${slides.length}: ${slide.title}`}>
      <h2><Icon className="w-4 h-4 shrink-0" /><span>{slide.title}</span></h2>
      <div className="flash-content">{slide.items.length ? <ul>{slide.items.slice(0, 3).map(item => <li key={item.id}><p className="flash-item-title">{item.title}</p>{item.detail && <p className="flash-item-detail">{item.detail}</p>}</li>)}</ul> : <p className="flash-empty">{slide.emptyText}</p>}</div>
    </div>
    <div className="flash-controls">
      <button type="button" className="flash-open" onClick={slide.onAction}>{slide.actionLabel}<ChevronRight className="w-3.5 h-3.5 shrink-0" /></button>
      <div className="flex shrink-0 gap-1">
        <button type="button" className="flash-control" aria-label="Info sebelumnya" disabled={slides.length < 2} onClick={() => change(-1)}><ChevronLeft className="w-4 h-4" /></button>
        {config.autoPlay && !reducedMotion && slides.length > 1 && <button type="button" className="flash-control" aria-label={paused ? 'Putar flash info' : 'Jeda flash info'} aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>}
        <button type="button" className="flash-control" aria-label="Info berikutnya" disabled={slides.length < 2} onClick={() => change(1)}><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  </section>;
}
