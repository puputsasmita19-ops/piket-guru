import React, { useEffect, useRef, useState } from 'react';
import { resolveLoginBackground, sanitizeLoginAppearance, type LoginAppearanceConfig } from '../../types/loginAppearance.types';

/** Built-in, same-origin media. Motion never blocks authentication or captures input. */
export function LoginBackdrop({ config, preview = false }: { config?: LoginAppearanceConfig; preview?: boolean }) {
  const value = sanitizeLoginAppearance(config), video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false), [allowed, setAllowed] = useState(false), [ready, setReady] = useState(false);
  const [fastConnection, setFastConnection] = useState(false);
  const background = resolveLoginBackground(value, fastConnection);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean; effectiveType?: string } }).connection;
    const update = () => {
      setActive(!document.hidden); setAllowed(!reduced.matches && !connection?.saveData);
      setFastConnection(connection?.effectiveType === '4g' && !connection.saveData && !reduced.matches);
    };
    update(); reduced.addEventListener('change', update); document.addEventListener('visibilitychange', update); connection?.addEventListener('change', update);
    return () => { reduced.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); connection?.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    if (preview || background !== 'ocean' || !value.motionEnabled || !allowed || !active || ready) return;
    // Keep the first login render free; fetch the clip after idle time, not on the critical path.
    let cancelled = false;
    const supportsIdle = typeof window.requestIdleCallback === 'function';
    const load = () => { if (!cancelled) setReady(true); };
    const id = supportsIdle ? window.requestIdleCallback(load, { timeout: 1800 }) : window.setTimeout(load, 700);
    return () => { cancelled = true; if (supportsIdle) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, [allowed, active, ready, preview, value.motionEnabled, background]);
  useEffect(() => {
    const el = video.current; if (!el) return;
    el.playbackRate = { slow: 0.6, normal: 1, fast: 1.25 }[value.speed];
    if (active && allowed && value.motionEnabled && ready) { try { void el.play()?.catch(() => {}); } catch { /* Poster remains visible. */ } } else el.pause();
  }, [active, allowed, ready, value.motionEnabled, value.speed, background]);
  if (!value.motionEnabled) return null;
  const animate = allowed && active && !preview;
  return <div aria-hidden="true" className="login-motion-backdrop" data-background={background} data-intensity={value.intensity} data-speed={value.speed} data-motion={animate ? 'running' : 'paused'}>
    {background === 'ocean' ? <video ref={video} className="login-ocean-video" muted loop playsInline preload="none" poster="/login-ocean-poster.jpg" src={ready && allowed && !preview ? '/login-ocean.mp4' : undefined} tabIndex={-1} disablePictureInPicture onCanPlay={() => { if (active && allowed) try { void video.current?.play()?.catch(() => {}); } catch { /* Poster remains visible. */ } }} /> : <div className="login-gradient-motion"><span /><span /><span /></div>}
    <div className="login-motion-wash" />
  </div>;
}
