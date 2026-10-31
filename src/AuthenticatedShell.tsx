import { useAutomaticSync } from './hooks/useAutomaticSync';
import React, { lazy, Suspense, useEffect } from 'react';
import { markAuthenticatedShellVisible } from './features/auth/loginDiagnostics';
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
import { useAuth } from './contexts/AuthContext';
const AdminAttendanceDashboard = lazy(() => import('./features/attendance/AdminAttendanceDashboard').then(m => ({ default: m.AdminAttendanceDashboard })));


export default function AuthenticatedShell() {
  useEffect(() => {
    // Two paint frames: shell can be visible after the mandatory auth and JS load.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(markAuthenticatedShellVisible);
    });
    let secondFrame = 0;
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
  }, []);
  useAutomaticSync();
  const { activeTab, setActiveTab } = useNavigation();
  const { hasRole, hasPermission, currentUser } = useAuth();

  useEffect(() => {
    let cancelled = false;
    // Start one shared GPS fix before the lazy Presensi page loads, only if
    // permission was already granted. Lazy-import after auth so GPS code does
    // not increase the critical login/dashboard JavaScript bundle.
    if (currentUser?.id && hasPermission(PERMISSIONS.ATTENDANCE_VIEW) &&
        (activeTab === 'dashboard' || activeTab === 'attendance')) {
      void import('./services/location/gpsFastWarmup').then(({ prewarmAttendanceGpsIfGranted }) => {
        if (!cancelled) return prewarmAttendanceGpsIfGranted();
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [activeTab, currentUser?.id, hasPermission]);
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
      case 'attendance-monitor':
        return hasRole('ADMIN') ? (
          <PermissionGuard permission={PERMISSIONS.ATTENDANCE_VIEW_ALL}>
            <AdminAttendanceDashboard />
          </PermissionGuard>
        ) : (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Hanya Administrator yang dapat membuka Monitoring Piket Realtime.</div>
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
