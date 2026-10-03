import { db } from '../src/services/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function main() {
  const d = await getDoc(doc(db, 'users', 'usr-admin-01'));
  if (d.exists()) {
    const data = d.data();
    const sanitized: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'pin' || k === 'pinHash' || k === 'pinSalt') {
        sanitized[k] = typeof v === 'string' ? `[REDACTED string len=${v.length}]` : v;
      } else {
        sanitized[k] = v;
      }
    }
    console.log('usr-admin-01 in Firestore:');
    console.log(JSON.stringify(sanitized, null, 2));
  } else {
    console.log('usr-admin-01 not found');
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
