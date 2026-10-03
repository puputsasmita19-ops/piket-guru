import * as fs from 'fs';

const prePurge = JSON.parse(fs.readFileSync('backups/BACKUP_PRE_PURGE_2026-10-02.json', 'utf8'));
console.log('Users in pre-purge backup:');
prePurge.data.users.forEach((u: any) => {
  const fields = Object.keys(u);
  const pinVal = u.pin ? `[REDACTED string len=${u.pin.length}]` : undefined;
  const pinHash = u.pinHash ? `[REDACTED hash len=${u.pinHash.length}]` : undefined;
  console.log(`- ID: ${u.id}, role: ${u.role}, fields: [${fields.join(', ')}], pin: ${pinVal}, pinHash: ${pinHash}`);
});
