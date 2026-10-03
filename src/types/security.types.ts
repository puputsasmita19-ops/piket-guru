export type EmergencyType = 'EARTHQUAKE' | 'FIRE' | 'SECURITY' | 'EVACUATION' | 'GENERAL';

export interface EmergencyAlert {
  id: string;
  type: EmergencyType;
  title: string;
  message: string;
  isActive: boolean;
  triggeredBy: string;
  triggeredByName: string;
  triggeredAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  soundAlert: boolean;
}

export interface SecurityCheckItem {
  id: string;
  category: 'AUTENTIKASI' | 'GEOFENCE' | 'DATABASE' | 'AUDIT' | 'DISASTER_RECOVERY';
  title: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  description: string;
  recommendation?: string;
}

export interface SecurityScoreReport {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  lastScanTime: string;
  checks: SecurityCheckItem[];
  scannedCollectionsCount: number;
  totalRecordsCount: number;
}

export interface CloudSnapshotRecord {
  id: string;
  timestamp: string;
  name: string;
  sizeBytes: number;
  totalRecords: number;
  collectionsSummary: Record<string, number>;
  createdBy: string;
  createdByName: string;
  status: 'BUILDING' | 'READY' | 'FAILED' | 'RESTORED' | 'ARCHIVED';
  hashFingerprint: string;
  digestAlgorithm?: string;
  digestProvenance?: string;
  isChunked?: boolean;
  totalChunks?: number;
  rawPayloadStr?: string;
  dataPayload?: any;
  error?: string;
}

export interface SchoolBellScheduleItem {
  id: string;
  time: string; // HH:mm
  label: string;
  description: string;
  toneType: 'MORNING_IN' | 'PERIOD_CHANGE' | 'BREAK' | 'DISMISSAL' | 'CUSTOM';
  isActive: boolean;
  days: number[]; // 1=Senin, 5=Jumat
}
