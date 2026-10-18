import { useAutomaticSync } from './hooks/useAutomaticSync';
import React, { lazy, Suspense } from 'react';
import { useNavigation } from './contexts/NavigationContext';
import { ViewErrorBoundary } from './components/common/ViewErrorBoundary';
import { PageLoading } from './components/common/PageLoading';
import { Layout } from './components/layout/Layout';
import { MobileExitConfirmModal } from './components/common/MobileExitConfirmModal';
import { DashboardView } from './features/dashboard/DashboardView';
const CommandCenterPreview = lazy(() => import('./features/command-center/CommandCenterPreview').then((module) => ({ default: module.CommandCenterPreview })));
const KioskPreview = lazy(() => import('./features/kiosk/KioskPreview').then((module) => ({ default: module.KioskPreview })));
const SchedulePreview = lazy(() => import('./features/schedules/SchedulePreview').then((module) => ({ default: module.SchedulePreview })));
const AttendancePreview = lazy(() => import('./features/attendance/AttendancePreview').then((module) => ({ default: module.AttendancePreview })));
const DutyBookPreview = lazy(() => import('./features/duty-book/DutyBookPreview').then((module) => ({ default: module.DutyBookPreview })));
const IncidentPreview = lazy(() => import('./features/incidents/IncidentPreview').then((module) => ({ default: module.IncidentPreview })));
const StudentTardyPreview = lazy(() => import('./features/student-tardiness/StudentTardyPreview').then((module) => ({ default: module.StudentTardyPreview })));
const SubstitutionPreview = lazy(() => import('./features/substitutions/SubstitutionPreview').then((module) => ({ default: module.SubstitutionPreview })));
const StudentPermitsPreview = lazy(() => import('./features/student-permits/StudentPermitsPreview').then((module) => ({ default: module.StudentPermitsPreview })));
const VisitorPreview = lazy(() => import('./features/visitors/VisitorPreview').then((module) => ({ default: module.VisitorPreview })));
const ReportsPreview = lazy(() => import('./features/reports/ReportsPreview').then((module) => ({ default: module.ReportsPreview })));
const UsersPreview = lazy(() => import('./features/users/UsersPreview').then((module) => ({ default: module.UsersPreview })));
const SettingsPreview = lazy(() => import('./features/settings/SettingsPreview').then((module) => ({ default: module.SettingsPreview })));
import { PermissionGuard } from './components/auth/PermissionGuard';
import { PERMISSIONS } from './config/permissions';


export default function AuthenticatedShell() {
  useAutomaticSync();
  const { activeTab, setActiveTab } = useNavigation();
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

  return (
    <Layout>
      <ViewErrorBoundary resetKey={activeTab} onGoHome={() => setActiveTab('dashboard')}>
        <Suspense fallback={<PageLoading label="Memuat halaman…" />}>{renderActiveView()}</Suspense>
      </ViewErrorBoundary>
      <MobileExitConfirmModal />
    </Layout>
  );
};
