import React, { useEffect, useRef, useState } from 'react';
import { DashboardOutlineControlIcon } from './DashboardOutlineControlIcon';
import type { DashboardInfoConfig, DashboardInfoPanel } from '../../types/dashboardInfo.types';
import { announcementPreview } from '../../utils/announcementPreview';

export interface DashboardFlashSlide {
  id: DashboardInfoPanel | 'activity';
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    id: string;
    title: string;
    detail?: string;
    absentTeacher?: string;
    subjectAndClass?: string;
    lessonPeriod?: string;
    reason?: string;
    replacementTeacher?: string;
    assignmentStatus?: string;
    task?: string;
  }[];
  emptyText: string;
  description?: string;
  caption?: string;
  illustration?: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  expanded?: boolean;
  controls?: string;
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
  const togglePlayback = () => {
    if (paused) {
      // Play is an explicit request to resume, even if its button retains focus/hover.
      // Keep DOM focus in place so keyboard and screen-reader users do not lose their position.
      setFocused(false);
      setInteracting(false);
      setPaused(false);
    } else setPaused(true);
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
    onPointerDownCapture={e => { setFocused(false); if (e.pointerType !== 'mouse') setInteracting(false); }}
    onKeyDownCapture={() => setFocused(true)}
    onFocusCapture={e => setFocused((e.target as HTMLElement).matches(':focus-visible'))} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
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
          return <div key={key} data-slide-id={item.id} data-loop-clone={clone || undefined} className={`flash-slide ${item.id === 'activity' ? 'flash-activity-slide' : ''} ${item.id === 'operations' ? 'flash-operations-slide' : ''} ${item.id === 'announcements' ? 'flash-announcement-slide' : ''} ${item.id === 'substitutions' ? 'flash-substitution-slide' : ''}`} role="group" aria-roledescription="slide" aria-label={`${logicalIndex + 1} dari ${slides.length}: ${item.title}`} aria-hidden={!active} inert={!active}>
            {item.id === 'activity' ? <div className="flash-activity">{item.illustration}<div className="min-w-0"><h2>{item.title}</h2><p className="flash-activity-description">{item.description}</p></div></div> : <>
              <h2><Icon className="w-4 h-4 shrink-0" /><span>{item.title}</span></h2>
              {item.caption && <p className="flash-slide-caption">{item.caption}</p>}
              <div className="flash-content">{item.items.length ? <>
                <ul className={item.id === 'operations' ? 'flash-operations-list' : item.id === 'substitutions' ? 'flash-inval-list' : 'flash-preview-list'}>
                  {item.items.slice(0, item.id === 'announcements' || item.id === 'substitutions' ? 1 : 3).map(row =>
                    <li key={row.id} data-info-id={row.id}>
                      {item.id === 'substitutions' ? (
                        <div className="flash-inval-panels" tabIndex={0} role="group" aria-label="Informasi guru berhalangan dan guru pengganti; gulir untuk membaca seluruh keterangan dan tugas">
                          <section className="flash-inval-panel flash-inval-absence" aria-label="Guru berhalangan">
                            <p className="flash-inval-label">Guru berhalangan</p>
                            <p className="flash-inval-name">{row.absentTeacher}</p>
                            <p className="flash-inval-context">{row.subjectAndClass}</p>
                            <p className="flash-inval-context">{row.lessonPeriod}</p>
                            <div className="flash-inval-detail">
                              <p className="flash-inval-label">Keterangan berhalangan hadir</p>
                              <p className="flash-inval-copy flash-inval-reason">{row.reason}</p>
                            </div>
                          </section>
                          <section className="flash-inval-panel flash-inval-cover" aria-label="Guru pengganti / inval">
                            <p className="flash-inval-label">Guru pengganti / inval</p>
                            <p className="flash-inval-name flash-inval-replacement">{row.replacementTeacher}</p>
                            <p className="flash-inval-status">{row.assignmentStatus}</p>
                            <div className="flash-inval-detail">
                              <p className="flash-inval-label">Tindak lanjut / tugas kelas</p>
                              <p className="flash-inval-copy flash-inval-task">{row.task}</p>
                            </div>
                          </section>
                        </div>
                      ) : <>
                        <p className="flash-item-title">{item.id === 'announcements' ? announcementPreview(row.title || '', 120) : row.title}</p>
                        {row.detail && <p className="flash-item-detail">{item.id === 'announcements' ? announcementPreview(row.detail) : row.detail}</p>}
                      </>}
                    </li>
                  )}
                </ul>
                {item.id === 'announcements' && item.items.length > 1 && <p className="flash-announcement-more">+{item.items.length - 1} pengumuman lainnya</p>}
                {item.id === 'substitutions' && item.items.length > 1 && <p className="flash-inval-more">+{item.items.length - 1} penugasan lain · Buka rincian untuk semua tugas</p>}
              </> : <p className="flash-empty">{item.emptyText}</p>}</div>
            </>}
          </div>;
        })}
      </div>
    </div>
    <div className="flash-controls">
      <button type="button" className="flash-open" onClick={slide.onAction} aria-expanded={slide.expanded} aria-controls={slide.controls}>
        {slide.actionLabel}<DashboardOutlineControlIcon symbol="next" className="w-4 h-4 shrink-0" />
      </button>
      <div className="flash-control-group" role="group" aria-label="Kontrol Flash Info">
        <button type="button" className="flash-control" aria-label="Info sebelumnya" disabled={slides.length < 2} onClick={() => change(-1)}>
          <DashboardOutlineControlIcon symbol="previous" />
        </button>
        {config.autoPlay && !reducedMotion && slides.length > 1 && (
          <button type="button" className="flash-control" aria-label={paused ? 'Putar flash info' : 'Jeda flash info'} aria-pressed={paused} onClick={togglePlayback}>
            <DashboardOutlineControlIcon symbol={paused ? 'play' : 'pause'} />
          </button>
        )}
        <button type="button" className="flash-control" aria-label="Info berikutnya" disabled={slides.length < 2} onClick={() => change(1)}>
          <DashboardOutlineControlIcon symbol="next" />
        </button>
      </div>
    </div>
  </section>;
}
