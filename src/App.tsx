/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardView } from './features/dashboard/DashboardView';
import { CommandCenterPreview } from './features/command-center/CommandCenterPreview';
import { KioskPreview } from './features/kiosk/KioskPreview';
import { SchedulePreview } from './features/schedules/SchedulePreview';
import { AttendancePreview } from './features/attendance/AttendancePreview';
import { DutyBookPreview } from './features/duty-book/DutyBookPreview';
import { IncidentPreview } from './features/incidents/IncidentPreview';
import { StudentTardyPreview } from './features/student-tardiness/StudentTardyPreview';
import { SubstitutionPreview } from './features/substitutions/SubstitutionPreview';
import { StudentPermitsPreview } from './features/student-permits/StudentPermitsPreview';
import { VisitorPreview } from './features/visitors/VisitorPreview';
import { ReportsPreview } from './features/reports/ReportsPreview';
import { UsersPreview } from './features/users/UsersPreview';
import { SettingsPreview } from './features/settings/SettingsPreview';
import { PermissionGuard } from './components/auth/PermissionGuard';
import { PERMISSIONS } from './config/permissions';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeTab, setActiveTab } = useNavigation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-bold text-xl animate-pulse shadow-lg shadow-blue-500/30">
          P
        </div>
        <div className="text-xs text-slate-400 font-medium">Memuat Sesi Piket Guru...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <PermissionGuard permission={PERMISSIONS.DASHBOARD_VIEW}>
            <DashboardView onNavigateTab={setActiveTab} />
          </PermissionGuard>
        );
      case 'command-center':
        return (
          <PermissionGuard permission={PERMISSIONS.COMMAND_CENTER_VIEW}>
            <CommandCenterPreview />
          </PermissionGuard>
        );
      case 'kiosk':
        return (
          <PermissionGuard permission={PERMISSIONS.KIOSK_VIEW}>
            <KioskPreview />
          </PermissionGuard>
        );
      case 'schedules':
        return (
          <PermissionGuard permission={PERMISSIONS.SCHEDULE_VIEW}>
            <SchedulePreview />
          </PermissionGuard>
        );
      case 'attendance':
        return (
          <PermissionGuard permission={PERMISSIONS.ATTENDANCE_VIEW}>
            <AttendancePreview />
          </PermissionGuard>
        );
      case 'duty-book':
        return (
          <PermissionGuard permission={PERMISSIONS.DUTYBOOK_VIEW}>
            <DutyBookPreview />
          </PermissionGuard>
        );
      case 'incidents':
        return (
          <PermissionGuard permission={PERMISSIONS.INCIDENT_VIEW}>
            <IncidentPreview />
          </PermissionGuard>
        );
      case 'student-tardiness':
        return (
          <PermissionGuard permission={PERMISSIONS.STUDENT_TARDY_VIEW}>
            <StudentTardyPreview />
          </PermissionGuard>
        );
      case 'substitutions':
        return (
          <PermissionGuard permission={PERMISSIONS.SUBSTITUTIONS_VIEW}>
            <SubstitutionPreview />
          </PermissionGuard>
        );
      case 'student-permits':
        return (
          <PermissionGuard permission={PERMISSIONS.STUDENT_PERMITS_VIEW}>
            <StudentPermitsPreview />
          </PermissionGuard>
        );
      case 'visitors':
        return (
          <PermissionGuard permission={PERMISSIONS.VISITORS_VIEW}>
            <VisitorPreview />
          </PermissionGuard>
        );
      case 'reports':
        return (
          <PermissionGuard permission={PERMISSIONS.REPORTS_VIEW}>
            <ReportsPreview />
          </PermissionGuard>
        );
      case 'users':
        return (
          <PermissionGuard permission={PERMISSIONS.USERS_VIEW}>
            <UsersPreview />
          </PermissionGuard>
        );
      case 'settings':
        return (
          <PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}>
            <SettingsPreview />
          </PermissionGuard>
        );
      default:
        return <DashboardView onNavigateTab={setActiveTab} />;
    }
  };

  return <Layout>{renderActiveView()}</Layout>;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationProvider>
          <AppContent />
        </NavigationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
