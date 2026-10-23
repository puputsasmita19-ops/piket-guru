/** Client UI guard only. Firestore Rules remain the authoritative edit boundary. */
export function mayEditOwnRecord(
  actor: { id: string; role: string } | null | undefined,
  record: Record<string, unknown> | null | undefined,
  ownerField: 'pelaporId' | 'petugasId' | 'petugasPiketId'
): boolean {
  if (!actor || !record) return false;
  if (actor.role === 'ADMIN') return true;
  // Legacy records lacking a stable UID are admin-only. Names are NOT unique identities.
  return typeof record[ownerField] === 'string' && record[ownerField] === actor.id;
}

export function assertRecordOwner(
  actor: { id: string; role: string } | null | undefined,
  record: Record<string, unknown>,
  ownerField: 'pelaporId' | 'petugasId' | 'petugasPiketId'
): void {
  if (!mayEditOwnRecord(actor, record, ownerField)) {
    throw new Error('Hanya pencatat asli atau Administrator yang boleh mengubah data ini.');
  }
}
