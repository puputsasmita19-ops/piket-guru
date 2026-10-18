import React from 'react';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useMinuteClock } from '../../hooks/useMinuteClock';
import { getDashboardWelcome, type DashboardWelcomeConfig } from '../../types/dashboardWelcome.types';

export const DashboardWelcome = React.memo(function DashboardWelcome({ config, user }: {
  config?: DashboardWelcomeConfig;
  user?: { fullName?: string; avatarUrl?: string | null } | null;
}) {
  const { greeting, message } = getDashboardWelcome(config, useMinuteClock());
  return <section className="dashboard-welcome" aria-label="Sapaan dashboard">
    <div><p className="dashboard-eyebrow">{greeting}</p><h1>Halo, {user?.fullName?.trim() || 'selamat datang'}</h1></div>
    <UserAvatar user={user} className="dashboard-avatar" />
    {message && <p className="dashboard-intro">{message}</p>}
  </section>;
});
