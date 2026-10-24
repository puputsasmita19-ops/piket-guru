import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  Briefcase,
  Building2,
  Tag,
  History,
  ShieldCheck,
} from '../../components/icons';
import { UserManagementView } from './UserManagementView';
import { MasterDataTabs } from '../master/MasterDataTabs';

type MainUserTab = 'users' | 'master';

export const UsersPreview: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<MainUserTab>('users');

  return (
    <div data-tour="users-container" className="space-y-6">
      {/* Header section */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Manajemen Pengguna & Master Data
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola akun, data sekolah, dan hak akses pengguna.</p>
        </div>

        {/* Master vs User Switcher */}
        <div className="page-actions grid grid-cols-2 gap-1.5 w-full sm:w-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMainTab('users')}
            aria-pressed={activeMainTab === 'users'}
            className={`min-h-11 min-w-0 px-2.5 py-2 rounded-lg border text-xs leading-snug font-bold text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)] ${
              activeMainTab === 'users'
                ? 'border-[var(--theme-primary-border)] bg-white dark:bg-slate-900 text-[var(--theme-primary-text)] shadow-xs'
                : 'border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 hover:border-[var(--theme-primary-border)] hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            Akun & Pengguna
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('master')}
            aria-pressed={activeMainTab === 'master'}
            className={`min-h-11 min-w-0 px-2.5 py-2 rounded-lg border text-xs leading-snug font-bold text-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)] ${
              activeMainTab === 'master'
                ? 'border-[var(--theme-primary-border)] bg-white dark:bg-slate-900 text-[var(--theme-primary-text)] shadow-xs'
                : 'border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 hover:border-[var(--theme-primary-border)] hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            Master Data & Audit
          </button>
        </div>
      </div>

      {activeMainTab === 'users' ? <UserManagementView /> : <MasterDataTabs />}
    </div>
  );
};
