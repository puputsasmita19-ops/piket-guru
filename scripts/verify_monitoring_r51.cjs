const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const load = p => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
const check = (label, result) => checks.push({ label, pass: Boolean(result) });

const shell = load('src/AuthenticatedShell.tsx');
const nav = load('src/contexts/NavigationContext.tsx');
const sidebar = load('src/components/layout/Sidebar.tsx');
const types = load('src/types/index.ts');
const appearance = load('src/config/moduleAppearance.ts');
const monitor = load('src/features/attendance/AdminAttendanceDashboard.tsx');
const dialog = load('src/features/attendance/AdminAttendanceDialog.tsx');
const service = load('src/services/firebase/adminAttendanceService.ts');
const mobile = load('src/components/layout/MobileNav.tsx');

check('NavigationTab has attendance-monitor', types.includes("| 'attendance-monitor'"));
check('Hash navigation allows monitoring', nav.includes("'attendance-monitor',"));
check('Appearance map includes monitoring', appearance.includes("'attendance-monitor':"));
check('Sidebar registers monitoring once', (sidebar.match(/id: 'attendance-monitor'/g) || []).length === 1);
check('Monitoring under admin section', sidebar.indexOf("id: 'attendance-monitor'") > sidebar.indexOf('const adminMenuItems:'));
check('Sidebar still checks role ADMIN', sidebar.includes("item.id !== 'attendance-monitor' || hasRole('ADMIN')"));
check('Sidebar still checks attendance view-all permission', sidebar.includes('PERMISSIONS.ATTENDANCE_VIEW_ALL'));
check('Search alias includes monitoring', sidebar.includes("'attendance-monitor': 'monitor realtime"));
check('Shell renders monitoring route', shell.includes("case 'attendance-monitor':"));
check('Shell enforces admin role', shell.includes("return hasRole('ADMIN')"));
check('Shell enforces view-all permission', shell.includes('permission={PERMISSIONS.ATTENDANCE_VIEW_ALL}'));
check('Monitoring component exists and has realtime listener', monitor.includes("subscribeToCollection<AttendanceRecord>('attendance'"));
check('Monitoring has grid/list controls', monitor.includes("setMonitorView('grid')") && monitor.includes("setMonitorView('list')"));
check('Monitoring has independent scroll area', monitor.includes('max-h-[34rem] overflow-y-auto'));
check('Monitoring shows duty book activity', monitor.includes('Jurnal Kegiatan Piket Hari Ini'));
check('Monitoring has bounded period history', monitor.includes('useHistoryPeriod(school)'));
check('Monitoring uses admin guard', monitor.includes("if (!admin) return"));
check('Correction dialog requires admin', dialog.includes("!hasRole('ADMIN')"));
check('Correction requires a reason', service.includes('reason.length < 10'));
check('Correction uses Firestore transaction & audit', service.includes('runTransaction(') && service.includes("doc(db, 'auditLogs'"));
check('Correction checks current admin role in transaction', service.includes("profileSnap.data().role !== 'ADMIN'"));
check('Monitoring icon component exists', fs.existsSync(path.join(root,'src/components/icons/RealtimeMonitorLogo.tsx')));
check('Mobile retains Lainnya drawer', mobile.includes('onOpenMore') && mobile.includes('Lainnya'));

let ok = true;
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} | ${c.label}`);
  if (!c.pass) ok = false;
}
console.log(`R51: ${checks.filter(c => c.pass).length}/${checks.length} checks passed.`);
process.exit(ok ? 0 : 1);
