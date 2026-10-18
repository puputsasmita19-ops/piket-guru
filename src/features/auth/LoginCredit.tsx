import React, { useState } from 'react';
import type { LoginAppearanceConfig } from '../../types/loginAppearance.types';

export function LoginCredit({ text, config }: { text: string; config: LoginAppearanceConfig }) {
  const [paused, setPaused] = useState(false);
  if (!config.runningCredit) return <p className="login-credit-static">{text}</p>;
  return <button type="button" className="login-credit" title={text + ' — ketuk untuk jeda/putar'} aria-label={`${paused ? 'Putar' : 'Jeda'} teks pengembang. ${text}`} aria-pressed={paused} onClick={() => setPaused(v => !v)} style={{ '--credit-duration': `${config.creditDuration}s` } as React.CSSProperties}>
    <span className="login-credit-track" data-paused={paused} aria-hidden="true"><span>{text}</span><span>{text}</span></span>
  </button>;
}
