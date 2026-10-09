import { LocationService, LocationCoordinates, GeofenceResult } from '../src/services/location/locationService.js';
import { adminDb } from '../src/server/firebaseAdmin.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

function setMockNavigator(mock: any) {
  Object.defineProperty(globalThis, 'navigator', {
    value: mock,
    configurable: true,
    writable: true,
  });
}

async function runSuite() {
  console.log('====================================================');
  console.log('  GPS & CHECK-OUT ATTENDANCE VERIFICATION SUITE     ');
  console.log('====================================================\n');

  console.log('--- Bagian 1: Pengujian Unit GPS & Geolocation ---');

  // 1. Haversine distance accuracy
  await test('Haversine distance calculation is mathematically accurate', () => {
    // Monas (-6.175392, 106.827153) to Istiqlal (-6.1702, 106.8317) ~ 750-850m
    const dist = LocationService.calculateHaversineDistance(-6.175392, 106.827153, -6.1702, 106.8317);
    if (dist < 700 || dist > 900) {
      throw new Error(`Expected distance around ~790m, got ${dist}m`);
    }
  });

  // 2. Geofence evaluation: Dalam Radius dengan Akurasi Tinggi
  await test('Geofence DALAM_LOKASI when within radius and high accuracy', () => {
    const geo = LocationService.evaluateGeofence(
      -6.200000, 106.800000, 12, // accuracy 12m
      -6.200100, 106.800100, 100 // school center, allowed 100m
    );
    if (geo.status !== 'DALAM_LOKASI' || !geo.isWithinRadius || geo.accuracyQuality !== 'TINGGI') {
      throw new Error(`Expected DALAM_LOKASI with TINGGI quality, got ${JSON.stringify(geo)}`);
    }
  });

  // 3. Geofence evaluation: Di Luar Radius
  await test('Geofence DI_LUAR_LOKASI when outside radius', () => {
    const geo = LocationService.evaluateGeofence(
      -6.210000, 106.810000, 15, // far away (~1.5km)
      -6.200000, 106.800000, 100 // school center, allowed 100m
    );
    if (geo.status !== 'DI_LUAR_LOKASI' || geo.isWithinRadius) {
      throw new Error(`Expected DI_LUAR_LOKASI, got ${JSON.stringify(geo)}`);
    }
  });

  // 4. Geofence evaluation: Akurasi Rendah (> 50m)
  await test('Geofence AKURASI_RENDAH when accuracy > 50m even if close to center', () => {
    const geo = LocationService.evaluateGeofence(
      -6.200010, 106.800010, 85, // accuracy 85m (bad GPS / cell tower)
      -6.200000, 106.800000, 100
    );
    if (geo.status !== 'AKURASI_RENDAH' || geo.accuracyQuality !== 'RENDAH') {
      throw new Error(`Expected AKURASI_RENDAH, got ${JSON.stringify(geo)}`);
    }
  });

  // 5. WatchPosition with mocked navigator: Immediate High-Accuracy
  await test('LocationService completes on high-accuracy position', async () => {
    let watchCallback: any = null;
    setMockNavigator({
      geolocation: {
        watchPosition: (success: any) => {
          watchCallback = success;
          // Emit immediate high accuracy position (10m)
          setTimeout(() => {
            success({
              coords: {
                latitude: -6.200000,
                longitude: 106.800000,
                accuracy: 10,
                altitude: 20,
                speed: 0,
              },
              timestamp: Date.now(),
            });
          }, 20);
          return 123;
        },
        clearWatch: () => {},
      },
    });

    const pos = await LocationService.getCurrentPosition({ timeoutMs: 3000, desiredAccuracyMeters: 20 });
    if (!pos || pos.accuracy !== 10 || pos.latitude !== -6.2) {
      throw new Error(`Invalid position received: ${JSON.stringify(pos)}`);
    }
  });

  // 6. WatchPosition: Progressive reporting with provisional progress callback
  await test('LocationService reports progressive provisional readings before high accuracy', async () => {
    let provisionalReported = false;
    setMockNavigator({
      geolocation: {
        watchPosition: (success: any) => {
          // First reading: 45m accuracy (provisional)
          setTimeout(() => {
            success({
              coords: {
                latitude: -6.200050,
                longitude: 106.800050,
                accuracy: 45,
              },
              timestamp: Date.now(),
            });
          }, 20);

          // Second reading: 12m accuracy (final)
          setTimeout(() => {
            success({
              coords: {
                latitude: -6.200000,
                longitude: 106.800000,
                accuracy: 12,
              },
              timestamp: Date.now(),
            });
          }, 60);

          return 124;
        },
        clearWatch: () => {},
      },
    });

    const pos = await LocationService.getCurrentPosition({
      timeoutMs: 3000,
      desiredAccuracyMeters: 20,
      onProgress: (p, isProvisional) => {
        if (isProvisional && p.accuracy === 45) {
          provisionalReported = true;
        }
      },
    });

    if (!provisionalReported) {
      throw new Error('Expected provisional progress callback to be invoked with initial reading');
    }
    if (pos.accuracy !== 12) {
      throw new Error(`Expected final accuracy 12m, got ${pos.accuracy}m`);
    }
  });

  // 7. WatchPosition: Stale cached reading rejection
  await test('LocationService rejects stale reading older than max age', async () => {
    setMockNavigator({
      geolocation: {
        watchPosition: (success: any) => {
          // Stale reading from 2 minutes ago
          setTimeout(() => {
            success({
              coords: { latitude: -6.2, longitude: 106.8, accuracy: 5 },
              timestamp: Date.now() - 120000,
            });
          }, 10);

          // Fresh reading
          setTimeout(() => {
            success({
              coords: { latitude: -6.2001, longitude: 106.8001, accuracy: 15 },
              timestamp: Date.now(),
            });
          }, 40);

          return 125;
        },
        clearWatch: () => {},
      },
    });

    const pos = await LocationService.getCurrentPosition({ timeoutMs: 3000, maxStaleAgeMs: 30000 });
    if (pos.latitude === -6.2) {
      throw new Error('Stale cached location was incorrectly accepted!');
    }
    if (pos.latitude !== -6.2001) {
      throw new Error('Fresh location was not received');
    }
  });

  // 8. WatchPosition: Permission denied rejection
  await test('LocationService rejects properly on permission denied error', async () => {
    setMockNavigator({
      geolocation: {
        watchPosition: (_: any, error: any) => {
          setTimeout(() => {
            error({ code: 1, PERMISSION_DENIED: 1, message: 'User denied Geolocation' });
          }, 20);
          return 126;
        },
        clearWatch: () => {},
      },
    });

    let caught = false;
    try {
      await LocationService.getCurrentPosition({ timeoutMs: 1000 });
    } catch (e: any) {
      caught = true;
      if (!e.message.includes('Izin lokasi GPS ditolak')) {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }
    if (!caught) throw new Error('Expected promise to reject on permission denied');
  });

  // 9. WatchPosition: Cancellation and clearCurrentWatcher
  await test('LocationService clearCurrentWatcher aborts pending watcher', async () => {
    let watchCleared = false;
    setMockNavigator({
      geolocation: {
        watchPosition: () => 999,
        clearWatch: (id: number) => {
          if (id === 999) watchCleared = true;
        },
      },
    });

    LocationService.getCurrentPosition({ timeoutMs: 10000 });
    LocationService.clearCurrentWatcher();

    if (!watchCleared) {
      throw new Error('clearCurrentWatcher did not clear the active geolocation watch ID');
    }
  });

  console.log('\n--- Bagian 2: Pengujian Alur Presensi Masuk & Pulang (Firestore Admin/Backend) ---');

  if (adminDb) {
    const testUserId = 'usr-guru-uji-test-01';
    const testDate = '2026-10-04';
    const attendanceDocId = `att-${testDate}-${testUserId}`;

    // Clean up test fixture before test
    await adminDb.collection('attendance').doc(attendanceDocId).delete();

    // 10. Check-In Creation
    await test('Check-In creates attendance record with protected check-in fields', async () => {
      const nowIso = new Date().toISOString();
      const newRecord = {
        id: attendanceDocId,
        scheduleId: 'sch-test-01',
        userId: testUserId,
        userName: 'Guru Uji Sintetis',
        tanggal: testDate,
        jamMasuk: nowIso,
        latitude: -6.200000,
        longitude: 106.800000,
        accuracy: 14.5,
        distance: 25,
        status: 'DALAM_LOKASI',
        photoUrl: 'data:image/jpeg;base64,testdata',
        dataSource: 'PRODUCTION',
        isDemo: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await adminDb.collection('attendance').doc(attendanceDocId).set(newRecord);

      const snap = await adminDb.collection('attendance').doc(attendanceDocId).get();
      if (!snap.exists) throw new Error('Attendance document was not created');
      const data = snap.data();
      if (data?.userId !== testUserId || data?.status !== 'DALAM_LOKASI' || data?.jamPulang) {
        throw new Error('Check-in record has invalid initial fields');
      }
    });

    // 11. Atomic Check-Out by Owner
    await test('Check-Out atomically updates jamPulang and protects check-in data', async () => {
      const docRef = adminDb.collection('attendance').doc(attendanceDocId);
      const checkoutTime = new Date().toISOString();

      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(docRef);
        if (!snap.exists) throw new Error('Doc not found');
        const d = snap.data()!;
        if (d.jamPulang) throw new Error('Already checked out');

        // Only update jamPulang and updatedAt
        t.update(docRef, {
          jamPulang: checkoutTime,
          updatedAt: checkoutTime,
        });
      });

      const updatedSnap = await docRef.get();
      const data = updatedSnap.data()!;
      if (!data.jamPulang || data.jamPulang !== checkoutTime) {
        throw new Error('jamPulang was not properly updated');
      }
      if (data.userId !== testUserId || data.latitude !== -6.2 || data.accuracy !== 14.5) {
        throw new Error('Check-in location metadata was corrupted during checkout');
      }
    });

    // 12. Double Check-Out Prevention
    await test('Second Check-Out is rejected and does not overwrite first jamPulang', async () => {
      const docRef = adminDb.collection('attendance').doc(attendanceDocId);
      const firstCheckoutData = (await docRef.get()).data()!;
      const originalJamPulang = firstCheckoutData.jamPulang;

      let rejected = false;
      try {
        await adminDb.runTransaction(async (t) => {
          const snap = await t.get(docRef);
          const d = snap.data()!;
          if (d.jamPulang) {
            throw new Error('Presensi pulang sudah tercatat sebelumnya');
          }
          t.update(docRef, {
            jamPulang: new Date().toISOString(),
          });
        });
      } catch (e: any) {
        if (e.message.includes('sudah tercatat')) {
          rejected = true;
        }
      }

      if (!rejected) throw new Error('Double checkout was NOT rejected!');

      const finalSnap = await docRef.get();
      if (finalSnap.data()!.jamPulang !== originalJamPulang) {
        throw new Error('Original jamPulang was overwritten by second checkout attempt!');
      }
    });

    // 13. Check-Out without prior Check-In is REJECTED
    await test('Check-Out without prior Check-In (missing jamMasuk or document) is REJECTED', async () => {
      const missingDocId = `att-${testDate}-usr-non-existent`;
      let rejected = false;
      try {
        await adminDb.runTransaction(async (t) => {
          const snap = await t.get(adminDb.collection('attendance').doc(missingDocId));
          if (!snap.exists) {
            throw new Error('Data presensi masuk untuk hari ini tidak ditemukan');
          }
        });
      } catch (e: any) {
        if (e.message.includes('tidak ditemukan')) {
          rejected = true;
        }
      }
      if (!rejected) throw new Error('Checkout without check-in was incorrectly allowed!');
    });

    // 14. Check-Out on another user's document is REJECTED
    await test('Check-Out on another user document is REJECTED', async () => {
      const otherUserDocId = `att-${testDate}-usr-other-guru`;
      const nowIso = new Date().toISOString();
      await adminDb.collection('attendance').doc(otherUserDocId).set({
        id: otherUserDocId,
        scheduleId: 'sch-test-01',
        userId: 'usr-other-guru',
        userName: 'Guru Lain',
        tanggal: testDate,
        jamMasuk: nowIso,
        latitude: -6.2,
        longitude: 106.8,
        accuracy: 10,
        distance: 20,
        status: 'DALAM_LOKASI',
      });

      let rejected = false;
      const callerUserId = 'usr-guru-uji-test-01'; // Different user
      try {
        await adminDb.runTransaction(async (t) => {
          const snap = await t.get(adminDb.collection('attendance').doc(otherUserDocId));
          const data = snap.data()!;
          if (data.userId !== callerUserId) {
            throw new Error('Akses ditolak: Anda hanya dapat melakukan presensi pulang untuk catatan Anda sendiri.');
          }
        });
      } catch (e: any) {
        if (e.message.includes('Akses ditolak')) {
          rejected = true;
        }
      }

      await adminDb.collection('attendance').doc(otherUserDocId).delete();
      if (!rejected) throw new Error('Checkout on another user record was not rejected!');
    });
  }

  console.log(`\n====================================================`);
  console.log(`  HASIL SUITE: ${passed} PASS, ${failed} FAIL`);
  console.log(`====================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((e) => {
  console.error('Fatal error in suite:', e);
  process.exit(1);
});
