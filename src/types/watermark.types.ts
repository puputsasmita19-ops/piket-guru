import type { LocationCoordinates } from '../services/location/locationService';

export type WatermarkModuleType = 'ATTENDANCE' | 'INCIDENT' | 'STUDENT_TARDY' | 'VISITOR';

export interface ModuleWatermarkSetting {
  enabled: boolean;
  showOfficerName: boolean;
  showCompactIdentity: boolean;
  showTimestamp: boolean;
  showEventDate: boolean;
  showGpsIfAvailable: boolean;
}

export type WatermarkFontSize = 'small' | 'medium' | 'large';
export type WatermarkPanelStyle = 'dark_solid' | 'dark_subtle' | 'navy_accent';

export interface DocumentationWatermarkConfig {
  showSchoolLogo: boolean;
  fontSize: WatermarkFontSize;
  panelStyle: WatermarkPanelStyle;
  modules: {
    incidents: ModuleWatermarkSetting;
    studentTardy: ModuleWatermarkSetting;
    visitors: ModuleWatermarkSetting;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_DOCUMENTATION_WATERMARK_CONFIG: DocumentationWatermarkConfig = {
  showSchoolLogo: true,
  fontSize: 'medium',
  panelStyle: 'dark_solid',
  modules: {
    incidents: {
      enabled: true,
      showOfficerName: true,
      showCompactIdentity: true,
      showTimestamp: true,
      showEventDate: true,
      showGpsIfAvailable: true,
    },
    studentTardy: {
      enabled: true,
      showOfficerName: true,
      showCompactIdentity: true,
      showTimestamp: true,
      showEventDate: true,
      showGpsIfAvailable: true,
    },
    visitors: {
      enabled: true,
      showOfficerName: true,
      showCompactIdentity: true,
      showTimestamp: true,
      showEventDate: true,
      showGpsIfAvailable: true,
    },
  },
};

export interface WatermarkPayload {
  module: WatermarkModuleType;
  schoolName: string;
  schoolLogoUrl?: string;
  officerName: string;
  officerId?: string;
  documentationTime: number; // ms timestamp WIB
  eventDate?: string; // YYYY-MM-DD
  eventTime?: string; // HH:mm
  isUploadedPhoto?: boolean;
  briefIdentity: string;
  coords?: LocationCoordinates | null;
  notes?: string;
  alreadyWatermarked?: boolean;
}

export interface PhotoRecapItem {
  id: string;
  sourceModule: WatermarkModuleType;
  sourceId: string;
  photoUrl: string;
  tanggalKejadian: string; // YYYY-MM-DD
  waktuKejadian?: string;
  tanggalDokumentasi?: string; // WIB formatted or ISO
  waktuDokumentasi?: string;
  petugasName?: string;
  title: string;
  briefIdentity: string;
  notes?: string;
  isLegacyUnwatermarked?: boolean;
  watermarkUnknown?: boolean;
}
