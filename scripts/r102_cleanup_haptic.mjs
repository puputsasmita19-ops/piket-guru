import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const loginFile = join(root, 'src/features/auth/LoginPage.tsx');
const unused = join(root, 'src/features/auth/pinHaptics.ts');
if (!existsSync(unused)) { console.log('File haptic lama sudah tidak ada.'); process.exit(0); }
const loginSource = readFileSync(loginFile, 'utf8');
if (loginSource.includes('pinHaptics')) {
  console.error('Dibatalkan: halaman login masih menggunakan modul haptic.');
  process.exitCode = 1;
} else {
  rmSync(unused);
  console.log('Modul haptic yang tidak dipakai telah dihapus: src/features/auth/pinHaptics.ts');
}
