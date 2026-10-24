'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const login=read('src/features/auth/LoginPage.tsx');
const header=read('src/components/layout/Header.tsx');
const sidebar=read('src/components/layout/Sidebar.tsx');
const notif=read('src/types/notification.types.ts');
const styles=read('src/modern-soft.css');
const checks=[
 ['Login: search always displayed',login.includes('id="login-account-search"') && login.includes('Cari pengguna')],
 ['Login: selected user summary',login.includes('Akun terpilih')],
 ['Login: no duplicate old picker',!login.includes('Pilih Pengguna / Petugas Piket:')],
 ['Login: manual ID/PIN fallback',login.includes('Masukkan ID manual') && login.includes('handleSubmit()')],
 ['Login: Google icon-only button beneath PIN',login.indexOf('aria-label="Masuk dengan Google sebagai Administrator"')>login.indexOf('PIN / Password Field')],
 ['Login: no legacy security tagline',!login.includes('Otentikasi Aman • Enkripsi Salted SHA-256')],
 ['Header: all operational controls intact', ['<OfflineSyncBadge','<GuideHelpButton','<NotificationBell', "handleTogglePanel('theme')"].every(x=>header.includes(x))],
 ['Header: explicit palette control',header.includes('<Palette className=') && header.includes('data-r48-actions="true"')],
 ['Header: theme choices preserved', ["setTheme('light')","setTheme('dark')","setTheme('system')","setPastelTheme(item.id)"].every(x=>header.includes(x))],
 ['Sidebar: app logo', sidebar.includes('src="/icon.svg"') && sidebar.includes('PIKET GURU')],
 ['Notifications: includes own activity', !notif.includes("e.actorId !== user.id &&") && notif.includes("e.actorId === user.id ? 'Anda'")],
 ['Notifications: keeps permission gating', notif.includes('mayViewNotificationModule(user, e.module as NotificationModule)')],
 ['Mobile header: buttons kept visible',styles.includes('app-header-actions[data-r48-actions]') && styles.includes('visibility: visible !important')],
];
for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name)}
console.log(`${checks.length}/${checks.length} R48 structural checks passed`);
