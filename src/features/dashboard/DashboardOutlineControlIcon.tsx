import React from 'react';

type Direction = 'previous' | 'next' | 'pause' | 'play';

/** R73: actual outline SVG strokes; icon-font/filled glyphs cannot be thinned with CSS. */
export const DashboardOutlineControlIcon = React.memo(function DashboardOutlineControlIcon({
  symbol,
  className = '',
}: {
  symbol: Direction;
  className?: string;
}) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    className={`dashboard-outline-control-icon ${className}`}
    width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {symbol === 'previous' ? <path d="m15 18-6-6 6-6" /> : null}
    {symbol === 'next' ? <path d="m9 18 6-6-6-6" /> : null}
    {symbol === 'pause' ? <><path d="M9 5v14" /><path d="M15 5v14" /></> : null}
    {symbol === 'play' ? <path d="m8 5 11 7-11 7z" /> : null}
  </svg>;
});
