import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDashboardWelcome, getWelcomeMessagePool, sanitizeDashboardWelcomeConfig, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';
import { DashboardOutlineControlIcon } from './DashboardOutlineControlIcon';

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
  return <span key={display.text} className="welcome-message-text" data-phase={display.phase} data-motion={animate && !reduced ? 'on' : 'off'}>{display.text}</span>;
}

export const WelcomeSentence = React.memo(function WelcomeSentence({ config: value, className = '', heroLayout = false }: {
  config?: DashboardWelcomeConfig;
  className?: string;
  heroLayout?: boolean;
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
  const control = canPause ? <button type="button"
    className={heroLayout ? 'welcome-message-pause welcome-message-pause-hero' : 'welcome-message-pause'}
    aria-pressed={pausedAt !== null}
    aria-label={pausedAt === null ? 'Jeda rotasi kalimat' : 'Lanjutkan rotasi kalimat'}
    title={pausedAt === null ? 'Jeda kalimat' : 'Lanjutkan kalimat'}
    onClick={() => setPausedAt(previous => previous === null ? now : null)}>
    <DashboardOutlineControlIcon symbol={pausedAt === null ? 'pause' : 'play'} />
  </button> : null;
  return <>
    <p className={`welcome-sentence ${className}`} style={{ '--welcome-exit-ms': `${config.transitionDurationMs * .4}ms`, '--welcome-enter-ms': `${config.transitionDurationMs * .6}ms` } as React.CSSProperties}>
      {!heroLayout && control}
      <span className="welcome-message" aria-live="off">
        {pool.map(text => <span key={text} className="welcome-message-measure" aria-hidden="true" data-text={text} />)}
        <TransitionText message={message} animate={config.animationEnabled} duration={config.transitionDurationMs} />
      </span>
    </p>
    {heroLayout && control}
  </>;
});
