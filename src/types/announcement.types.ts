import { BaseEntityMetadata } from './index';

export type AnnouncementPriority = 'INFO' | 'PENTING' | 'DARURAT';

export interface AnnouncementConfig {
  allowPublishedEditing: boolean;
  showUpdateInfo: boolean;
}

export function sanitizeAnnouncementConfig(value?: Partial<AnnouncementConfig> | null): AnnouncementConfig {
  return {
    allowPublishedEditing: value?.allowPublishedEditing !== false,
    showUpdateInfo: value?.showUpdateInfo !== false,
  };
}

export interface AnnouncementSaveInput {
  id?: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetRole?: string;
  /** Snapshot captured when the edit form opens; never replace with a live revision. */
  expectedState?: Pick<AnnouncementRecord, 'updatedAt'>;
}

export interface AnnouncementRecord extends BaseEntityMetadata {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  authorName: string;
  authorRole: string;
  date: string;
  targetRole?: string; // 'SEMUA' | 'GURU' | 'TENDIK' | 'SATPAM'
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  createdBy: string;
}
