export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  notes: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}
export interface SubjectCatalog {
  id: 'catalog';
  entries: SubjectRecord[];
  updatedAt: string;
  updatedBy: string;
}
export const MAX_SUBJECTS = 500;
export const subjectKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
export function isSubjectCatalog(value: unknown): value is SubjectCatalog {
  if (!value || typeof value !== 'object') return false;
  const catalog = value as SubjectCatalog;
  if (catalog.id !== 'catalog' || !Array.isArray(catalog.entries) || catalog.entries.length > MAX_SUBJECTS) return false;
  const ids = new Set<string>(), names = new Set<string>(), codes = new Set<string>();
  return catalog.entries.every(row => {
    if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.name !== 'string' || !subjectKey(row.name) || row.name.length > 120 || names.has(subjectKey(row.name))) return false;
    if (typeof row.code !== 'string' || row.code.length > 30 || (row.code && codes.has(subjectKey(row.code)))) return false;
    if (typeof row.notes !== 'string' || row.notes.length > 240 || typeof row.isActive !== 'boolean' || typeof row.updatedAt !== 'string' || !row.updatedAt || typeof row.updatedBy !== 'string') return false;
    ids.add(row.id); names.add(subjectKey(row.name)); if (row.code) codes.add(subjectKey(row.code)); return true;
  });
}
