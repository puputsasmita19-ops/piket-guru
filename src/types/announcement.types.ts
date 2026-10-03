import { BaseEntityMetadata } from './index';

export type AnnouncementPriority = 'INFO' | 'PENTING' | 'DARURAT';

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
  createdBy: string;
}
