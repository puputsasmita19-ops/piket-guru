/**
 * Reserves a fixed number of numeric page slots so the controls never jump.
 * Null placeholders keep the width unchanged when the result has fewer pages.
 */
export function buildStablePagination(currentPage: number, totalPages: number, slotCount = 5): Array<number | null> {
  const pages = Math.max(1, Math.floor(Number.isFinite(totalPages) ? totalPages : 1));
  const slots = Math.max(1, Math.floor(Number.isFinite(slotCount) ? slotCount : 5));
  const current = Math.min(pages, Math.max(1, Math.floor(Number.isFinite(currentPage) ? currentPage : 1)));
  const count = Math.min(pages, slots);
  const start = Math.max(1, Math.min(current - Math.floor(count / 2), pages - count + 1));
  return [...Array.from({ length: count }, (_, index) => start + index), ...Array<null>(slots - count).fill(null)];
}
