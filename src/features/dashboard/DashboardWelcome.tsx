import React from 'react';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useMinuteClock } from '../../hooks/useMinuteClock';
import { getDashboardWelcome, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';
import { WelcomeSentence } from './WelcomeSentence';

export const DashboardWelcome = React.memo(function DashboardWelcome({ config, user }: {
  config?: DashboardWelcomeConfig;
  user?: { fullName?: string; avatarUrl?: string | null } | null;
}) {
  const { greeting } = getDashboardWelcome(config, useMinuteClock());
  return <section className="dashboard-welcome" aria-label="Sapaan dashboard">
    <div><p className="dashboard-eyebrow">{greeting}</p><h1>Halo, {user?.fullName?.trim() || 'selamat datang'}</h1></div>
    <UserAvatar user={user} className="dashboard-avatar" />
    <WelcomeSentence config={config} className="dashboard-intro" heroLayout />
  </section>;
});
