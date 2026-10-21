// Focused, non-browser regression checks for the R10 attendance patch.
// Run from repository root: node scripts/verify_attendance_round10.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const camera = fs.readFileSync('src/components/camera/CameraCaptureModal.tsx', 'utf8');
const attendance = fs.readFileSync('src/features/attendance/AttendancePreview.tsx', 'utf8');
const gps = fs.readFileSync('src/services/location/locationService.ts', 'utf8');
const admin = fs.readFileSync('src/features/attendance/AdminAttendanceDialog.tsx', 'utf8');

let checks = 0;
function check(label, condition) {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${String(checks).padStart(2, '0')}  ${label}`);
}
for (const [file, source] of [
  ['CameraCaptureModal.tsx', camera],
  ['AttendancePreview.tsx', attendance],
]) {
  const parse = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  check(`${file}: sintaks TSX valid`, parse.parseDiagnostics.length === 0);
  const out = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  check(`${file}: transpile lokal berhasil`, (out.diagnostics || []).length === 0);
}
check('Kamera presensi menggunakan resolusi ideal lebih ringan', camera.includes('prepareCapture ? 640 : 800') && camera.includes('prepareCapture ? 480 : 600'));
check('Kamera tidak mengambil ulang stream jika lensa masih aktif', camera.includes('streamModeRef.current === mode') && camera.includes("track.readyState === 'live'"));
check('Ambil ulang memasang kembali stream lama pada elemen video', camera.includes('video.srcObject = streamRef.current') && camera.includes('[capturedImage, isOpen]'));
check('Jepret hanya aktif saat pratinjau siap', camera.includes('!cameraReady || !!cameraError') && camera.includes('onPlaying='));
check('Kamera dihentikan saat dialog ditutup', camera.includes('streamRef.current?.getTracks().forEach((track) => track.stop())'));
check('Kamera dijeda saat pratinjau foto', camera.includes('track.enabled = false') && camera.includes('track.enabled = true'));
check('Modal kamera tidak mounted ketika ditutup', attendance.includes('{isCameraModalOpen && <CameraCaptureModal'));
check('Jadwal harian dimemoisasi', attendance.includes('const todayUserSchedules = React.useMemo('));
check('Rekap riwayat tidak dihitung di tab presensi', attendance.includes("activeTab !== 'riwayat' || history.range.error ? []"));
check('Pemilihan shift dan swafoto hanya saat check-in', attendance.includes('{!existingAttendanceToday && <>'));
check('Swafoto mobile menjadi tombol aksesibel', attendance.includes('>Ambil Swafoto</span>') && attendance.includes('type="button"'));
check('Validasi GPS dan watermark tetap dipakai', attendance.includes('LocationService.ensureFreshPosition(') && attendance.includes('stampCheckInSelfie(') && gps.includes('MAX_ATTENDANCE_ACCURACY_METERS = 50'));
check('Edit/hapus admin R8 tetap ada', attendance.includes('hasRole(\'ADMIN\')') && attendance.includes('AdminAttendanceDialog') && attendance.includes("mode: 'edit'") && attendance.includes("mode: 'delete'") && admin.includes('AdminAttendanceSelection'));
console.log(`\n${checks} pemeriksaan terarah berhasil (sintaks dan invariants source; bukan uji perangkat/Firebase).`);
