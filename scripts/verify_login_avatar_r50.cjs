const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = name => fs.readFileSync(name, 'utf8');
const tests = [
 ['Label cari pengguna tersembunyi namun aksesibel', () => assert.match(source('src/features/auth/LoginPage.tsx'), /htmlFor="login-account-search" className="sr-only"/)],
 ['Tombol ID manual ikon dan aria-label', () => assert.match(source('src/features/auth/LoginPage.tsx'), /aria-label=\{isManualInput \? 'Kembali ke pencarian nama'/)],
 ['Ikon pencarian kembali', () => assert.match(source('src/features/auth/LoginPage.tsx'), /isManualInput \? <Search/)],
 ['Hanya akun terpilih memakai komponen foto', () => assert.equal((source('src/features/auth/LoginPage.tsx').match(/<LoginAvatar/g) || []).length, 1)],
 ['Foto publik hanya bila Admin mengizinkan', () => assert.match(source('src/features/auth/LoginAvatar.tsx'), /user\.loginAvatarVisible === true/)],
 ['Foto tetap ringan, lazy load', () => assert.match(source('src/features/auth/LoginAvatar.tsx'), /loading="lazy"/)],
 ['Avatar fallback ikon, bukan inisial', () => assert.match(source('src/features/auth/LoginAvatar.tsx'), /<User aria-hidden/)],
 ['Admin dapat mengatur visibilitas', () => assert.match(source('src/features/users/ProfilePhotoModal.tsx'), /setProfileLoginVisibility/)],
 ['Toggle memakai sesi Admin', () => assert.match(source('src/server/routes/profilePhotoRoutes.ts'), /login-visibility', requireAuth, requireAdmin/)],
 ['Endpoint foto publik hanya mengizinkan akun aktif', () => assert.match(source('src/server/routes/profilePhotoRoutes.ts'), /data\?\.isActive !== true \|\| data\?\.loginAvatarVisible !== true/)],
 ['Endpoint foto publik memeriksa file terkini', () => assert.match(source('src/server/routes/profilePhotoRoutes.ts'), /data\?\.avatarUrl !== photoPath\(uid, fileId\)/)],
 ['Upload foto baru mencabut izin publik', () => assert.match(source('src/server/routes/profilePhotoRoutes.ts'), /avatarUrl, loginAvatarVisible: false/)],
 ['Hapus foto mencabut izin publik', () => assert.match(source('src/server/routes/profilePhotoRoutes.ts'), /avatarUrl: null, loginAvatarVisible: false/)],
 ['Tahun disertakan di tanggal mobile', () => assert.match(source('src/components/common/AppClock.tsx'), /const compact = new Intl.DateTimeFormat\('id-ID', \{[^\n]*year: 'numeric'/)],
 ['Tipe data menyertakan visibilitas foto', () => assert.match(source('src/types/index.ts'), /loginAvatarVisible\?: boolean/)],
 ['Foto hanya dimuat saat dipilih', () => assert.match(source('src/features/auth/LoginPage.tsx'), /<LoginAvatar user=\{selectedUser\}/)],
];
const tsFiles = [
 'src/features/auth/LoginPage.tsx','src/features/auth/LoginAvatar.tsx','src/components/common/AppClock.tsx',
 'src/types/index.ts','src/server/routes/authRoutes.ts','src/server/routes/profilePhotoRoutes.ts',
 'src/services/auth/authService.ts','src/services/profile/profilePhotoService.ts',
 'src/features/users/ProfilePhotoModal.tsx','src/features/users/UserManagementView.tsx'
];
for (const name of tsFiles) tests.push([`TypeScript syntax: ${name}`, () => {
 const out = ts.transpileModule(source(name), {fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 const errors = (out.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,errors.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; '));
}]);
let count=0;
for(const [label,test] of tests){try{test(); console.log(`PASS ${++count}: ${label}`)}catch(e){console.error(`FAIL ${label}:`,e.message);process.exitCode=1}}
if(!process.exitCode) console.log(`R50: ${count}/${tests.length} structural and syntax checks passed`);
