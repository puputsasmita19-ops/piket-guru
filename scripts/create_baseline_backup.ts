import { BackupService } from '../src/services/backup/backupService';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('--- Creating PRODUCTION DATA ENTRY BASELINE BACKUP ---');
  
  const adminActor = {
    id: 'usr-admin-01',
    nip: '198503152010011002',
    fullName: 'Administrator Sistem',
    role: 'ADMIN' as const,
    email: 'admin@sekolah.sch.id',
    phone: '081234567890',
    isActive: true,
    permissions: ['*'],
  };

  const backup = await BackupService.createFullBackup(adminActor);
  const validation = BackupService.validateBackupSchema(backup);

  if (!validation.isValid) {
    console.error('Backup validation failed:', validation.error);
    process.exit(1);
  }

  const backupPath = path.join(process.cwd(), 'backups', 'PRODUCTION_DATA_ENTRY_BASELINE_BACKUP_2026-10-02.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`[SUCCESS] PRODUCTION DATA ENTRY BASELINE BACKUP created.`);
  console.log(`Location: ${backupPath}`);
  console.log(`Total Collections: ${backup.metadata.totalCollections}`);
  console.log(`Total Records: ${backup.metadata.totalRecords}`);
  console.log(`Format Version: ${backup.formatVersion}`);
  console.log(`Timestamp: ${backup.timestamp}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create baseline backup:', err);
  process.exit(1);
});
