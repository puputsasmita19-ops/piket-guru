/** Stateless guards shared by staff and QR visitor registration. */
export const MAX_VISITOR_GROUP = 12;

export function normalizeVisitorNames(raw: unknown, fallback: unknown): string[] {
  const items = Array.isArray(raw) ? raw : [fallback];
  if (items.length < 1 || items.length > MAX_VISITOR_GROUP) throw new Error('Rombongan maksimal 12 tamu dalam satu registrasi.');
  const names = items.map(item => typeof item === 'string' ? item.trim().replace(/\s+/g, ' ').slice(0, 120) : '');
  if (names.some(name => name.length < 2)) throw new Error('Nama setiap tamu wajib diisi (minimal 2 karakter).');
  if (new Set(names.map(name => name.toLocaleLowerCase('id-ID'))).size !== names.length) throw new Error('Nama tamu dalam rombongan tidak boleh sama.');
  return names;
}

export function formatVisitorBadge(date: string, number: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(number) || number < 1 || number > 99999999) {
    throw new Error('Tanggal atau nomor urut badge tidak valid.');
  }
  return `TAMU-${date.replace(/-/g, '')}-${String(number).padStart(4, '0')}`;
}
