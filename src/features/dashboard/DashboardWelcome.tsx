import React, { useEffect, useRef, useState } from 'react';
import { UserAvatar } from '../../components/common/UserAvatar';
import { OverflowName } from '../../components/common/OverflowName';
import type { NameMarqueeConfig } from '../../types/dashboardInfo.types';
import { useMinuteClock } from '../../hooks/useMinuteClock';
import { getDashboardWelcome, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';
import { WelcomeSentence } from './WelcomeSentence';

export const DashboardWelcome = React.memo(function DashboardWelcome({ config, nameMarquee, user }: {
  config?: DashboardWelcomeConfig;
  nameMarquee?: NameMarqueeConfig;
  user?: { fullName?: string; avatarUrl?: string | null } | null;
}) {
  const { greeting } = getDashboardWelcome(config, useMinuteClock());
  const name = user?.fullName?.trim() || 'selamat datang';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    const update = () => {
      const computed = getComputedStyle(heading);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      const needed = ctx.measureText(`Halo, ${name}`).width;
      setStacked(needed > heading.clientWidth - 3);
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (observer) observer.observe(heading);
    else window.addEventListener('resize', update);
    return () => { observer?.disconnect(); if (!observer) window.removeEventListener('resize', update); };
  }, [name]);
  return <section className="dashboard-welcome" aria-label="Sapaan dashboard">
    <div>
      <p className="dashboard-eyebrow">{greeting}</p>
      <h1 ref={headingRef} data-stacked={stacked ? 'true' : 'false'}>
        <span className="dashboard-hello-prefix">Halo, </span>
        <OverflowName name={name} config={nameMarquee} className="dashboard-user-name" />
      </h1>
    </div>
    <UserAvatar user={user} className="dashboard-avatar" />
    <WelcomeSentence config={config} className="dashboard-intro" heroLayout />
  </section>;
});
