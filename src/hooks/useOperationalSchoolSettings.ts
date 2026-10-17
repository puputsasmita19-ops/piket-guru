import { useEffect, useState } from 'react';
import type { SchoolSettings } from '../types';
import { DEFAULT_SCHOOL_SETTINGS } from '../config/constants';
import { FirestoreService } from '../services/firebase/firestoreService';

export function useOperationalSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings>({ ...DEFAULT_SCHOOL_SETTINGS,
    schoolName: '', npsn: '', address: '', logoUrl: '', principalName: '', principalIdNumber: '', coordinatorName: '', coordinatorIdNumber: '' });
  useEffect(() => FirestoreService.subscribeToDocument<SchoolSettings>('settings', 'school_config', data => {
    if (data) setSettings(data);
  }), []);
  return settings;
}
