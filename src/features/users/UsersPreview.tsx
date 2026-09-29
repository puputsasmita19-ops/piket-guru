import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  Briefcase,
  Building2,
  Tag,
  History,
  ShieldCheck,
} from 'lucide-react';
import { UserManagementView } from './UserManagementView';
import { MasterDataTabs } from '../master/MasterDataTabs';

type MainUserTab = 'users' | 'master';

export const UsersPreview: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<MainUserTab>('users');

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Manajemen Pengguna & Master Data
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pengelolaan akun petugas piket, hak akses Role RBAC, Reset PIN, dan data referensi terpusat
          </p>
        </div>

        {/* Master vs User Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveMainTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Akun & Pengguna
          </button>
          <button
            onClick={() => setActiveMainTab('master')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'master'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
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
