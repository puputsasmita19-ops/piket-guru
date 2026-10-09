import { adminDb } from '../src/server/firebaseAdmin';

async function inspect() {
  console.log('=== INSPECTING GURU-UJI-001 & ORPHAN RESERVATIONS ===');
  if (!adminDb) {
    console.error('adminDb not initialized');
    return;
  }

  // 1. Check login_ids/GURU-UJI-001
  const loginIdDoc = await adminDb.collection('login_ids').doc('GURU-UJI-001').get();
  console.log('Document login_ids/GURU-UJI-001 exists:', loginIdDoc.exists);
  let targetUserId = null;
  if (loginIdDoc.exists) {
    const data = loginIdDoc.data();
    targetUserId = data?.userId;
    console.log('login_ids/GURU-UJI-001 data:', {
      loginId: data?.loginId,
      userId: data?.userId,
      createdAt: data?.createdAt,
      updatedAt: data?.updatedAt,
    });
  }

  // 2. Check if targetUserId exists in users collection
  if (targetUserId) {
    const userDoc = await adminDb.collection('users').doc(targetUserId).get();
    console.log(`Document users/${targetUserId} exists:`, userDoc.exists);
    if (userDoc.exists) {
      const uData = userDoc.data();
      console.log(`User data for ${targetUserId}:`, {
        id: uData?.id,
        loginId: uData?.loginId,
        fullName: uData?.fullName,
        role: uData?.role,
        isActive: uData?.isActive,
      });
    }
  }

  // 3. Check if any document in users has loginId == 'GURU-UJI-001'
  const queryByLoginId = await adminDb.collection('users').where('loginId', '==', 'GURU-UJI-001').get();
  console.log(`Users with loginId == 'GURU-UJI-001' count:`, queryByLoginId.size);
  queryByLoginId.docs.forEach((d) => {
    const uData = d.data();
    console.log(`- Found user doc: ${d.id}`, {
      id: uData?.id,
      fullName: uData?.fullName,
      role: uData?.role,
      isActive: uData?.isActive,
    });
  });

  // 4. List all login_ids in the collection to see what reservations exist
  const allLoginIds = await adminDb.collection('login_ids').get();
  console.log(`\nTotal login_ids documents in Firestore:`, allLoginIds.size);
  for (const doc of allLoginIds.docs) {
    const data = doc.data();
    const userExists = await adminDb.collection('users').doc(data.userId).get().then((s) => s.exists).catch(() => false);
    console.log(`- login_ids/${doc.id}: userId=${data.userId}, userExistsInDb=${userExists}`);
  }
}

inspect().catch(console.error);
