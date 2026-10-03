import { db } from '../src/services/firebase/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

async function main() {
  console.log('=== CURRENT PRODUCTION STATE AUDIT ===\n');

  // Check School Config
  const scDoc = await getDoc(doc(db, 'settings', 'school_config'));
  if (scDoc.exists()) {
    console.log('--- SCHOOL CONFIGURATION ---');
    console.log(JSON.stringify(scDoc.data(), null, 2));
  } else {
    console.log('--- SCHOOL CONFIGURATION: NOT FOUND ---');
  }

  // Check collections counts
  const cols = [
    'users', 'teachers', 'staff', 'rooms', 'students', 'schedules',
    'attendance', 'dutyBooks', 'incidents', 'studentTardiness',
    'substitutions', 'studentPermits', 'visitors', 'announcements',
    'incidentCategories', 'settings', 'auditLogs'
  ];

  console.log('\n--- COLLECTION RECORD COUNTS ---');
  for (const c of cols) {
    const snap = await getDocs(collection(db, c));
    console.log(`  ${c}: ${snap.docs.length}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
