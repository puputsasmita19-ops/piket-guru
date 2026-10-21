import React from 'react';

export const RealtimeMonitorLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src="/monitoring-piket-realtime-icon.png"
    alt=""
    aria-hidden="true"
    className={className || 'w-5 h-5'}
    draggable={false}
  />
);
