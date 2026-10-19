import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getDashboardWelcome, getWelcomeMessagePool, sanitizeDashboardWelcomeConfig, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return reduced;
}

/** One timer per visible sentence, only at a real rotation boundary. No network IO. */
function useWelcomeClock(mode: DashboardWelcomeConfig['mode'], intervalSeconds: number, active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || (mode !== 'interval' && mode !== 'daily')) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const time = Date.now(); setNow(time);
      const period = mode === 'daily' ? 86400000 : intervalSeconds * 1000;
      const localTime = mode === 'daily' ? time + 7 * 3600000 : time;
      timer = setTimeout(update, period - (localTime % period) + 20);
    };
    update(); document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [mode, intervalSeconds, active]);
  return now;
}

function TransitionText({ message, animate, duration }: { message: string; animate: boolean; duration: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState({ text: message, phase: 'idle' });
  const current = useRef(display); current.current = display;
  const textRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const text = textRef.current, sentence = text?.closest<HTMLElement>('.welcome-sentence');
    if (!text || !sentence) return;
    const alignControl = () => {
      const style = getComputedStyle(text);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
      // Use the visible text, not the hidden space reserved for longer templates.
      const lineOffset = text.clientHeight > lineHeight * 1.5 ? lineHeight : 0;
      sentence.style.setProperty('--welcome-control-top', `${lineOffset + (lineHeight - 20) / 2}px`);
    };
    alignControl();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(alignControl) : null;
    observer?.observe(text);
    window.addEventListener('resize', alignControl);
    return () => { observer?.disconnect(); window.removeEventListener('resize', alignControl); };
  }, [display.text]);
  useEffect(() => {
    let enterTimer: ReturnType<typeof setTimeout>, idleTimer: ReturnType<typeof setTimeout>;
    if (!animate || reduced || document.hidden || current.current.text === message) {
      setDisplay({ text: message, phase: 'idle' });
    } else {
      setDisplay(previous => ({ ...previous, phase: 'exit' }));
      enterTimer = setTimeout(() => {
        setDisplay({ text: message, phase: 'enter' });
        idleTimer = setTimeout(() => setDisplay({ text: message, phase: 'idle' }), duration * .6);
      }, duration * .4);
    }
    return () => { clearTimeout(enterTimer); clearTimeout(idleTimer); };
  }, [message, animate, duration, reduced]);
  return <span key={display.text} ref={textRef} className="welcome-message-text" data-phase={display.phase} data-motion={animate && !reduced ? 'on' : 'off'}>{display.text}</span>;
}

export const WelcomeSentence = React.memo(function WelcomeSentence({ config: value, className = '' }: {
  config?: DashboardWelcomeConfig;
  className?: string;
}) {
  const config = useMemo(() => sanitizeDashboardWelcomeConfig(value), [value]);
  const pool = useMemo(() => getWelcomeMessagePool(config), [config]);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const signature = JSON.stringify(config);
  useEffect(() => setPausedAt(null), [signature]);
  const now = useWelcomeClock(config.mode, config.intervalSeconds, config.enabled && pausedAt === null);
  const { message } = getDashboardWelcome(config, pausedAt ?? now);
  const canPause = config.mode === 'interval' && pool.length > 1;
  if (!message) return null;
  return <p className={`welcome-sentence ${className}`} style={{ '--welcome-exit-ms': `${config.transitionDurationMs * .4}ms`, '--welcome-enter-ms': `${config.transitionDurationMs * .6}ms` } as React.CSSProperties}>
    <span className="welcome-message" aria-live="off">
      {/* CSS-generated hidden copies reserve the tallest line wrap in this pool.
          They have no accessible text and do not produce repeated visible lines. */}
      {pool.map(text => <span key={text} className="welcome-message-measure" aria-hidden="true" data-text={text} />)}
      <TransitionText message={message} animate={config.animationEnabled} duration={config.transitionDurationMs} />
    </span>
    {canPause && <button type="button" className="welcome-message-pause" aria-pressed={pausedAt !== null}
      aria-label={pausedAt === null ? 'Jeda rotasi kalimat' : 'Lanjutkan rotasi kalimat'}
      title={pausedAt === null ? 'Jeda kalimat' : 'Lanjutkan kalimat'}
      onClick={() => setPausedAt(previous => previous === null ? now : null)}>
      <svg className="welcome-control-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        {pausedAt === null ? <path d="M7 4v12M13 4v12" /> : <path d="m7 4 9 6-9 6Z" />}
      </svg>
    </button>}
  </p>;
});
