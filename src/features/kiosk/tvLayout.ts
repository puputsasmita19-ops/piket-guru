import type { TvDensityScale, TvPanelId } from '../../types/lobbyTv.types';

export function tvTypography(width: number, height: number, density: TvDensityScale) {
  const factor = density === 'large' ? 1.2 : density === 'compact' ? .85 : 1;
  const scale = Math.max(.6, Math.min(2.4, Math.min(width / 1920, height / 1080) * factor));
  return { scale, title: Math.max(20, 44 * scale), name: Math.max(22, 38 * scale),
    body: Math.max(18, 30 * scale), detail: Math.max(16, 26 * scale), small: Math.max(13, 21 * scale),
    brand: Math.max(20, 36 * scale), clock: Math.max(32, 72 * scale), metric: Math.max(56, 132 * scale),
    gap: Math.max(12, 22 * scale), padding: Math.max(14, 28 * scale) };
}

export function tvPageCapacity(panel: TvPanelId, width: number, height: number, scale: number, density: TvDensityScale) {
  const columns = panel === 'substitutions'
    ? width >= 850 && density !== 'large' ? 2 : 1
    : width < 700 ? 1 : width < 1500 || density !== 'compact' ? 2 : 3;
  const cardHeight = (panel === 'substitutions' ? 490 : panel === 'visitors' ? 350 : 250) * scale;
  const gap = Math.max(12, 22 * scale);
  const available = Math.max(0, height - Math.max(90, 140 * scale));
  const rows = Math.max(1, Math.min(2, Math.floor((available + gap) / (cardHeight + gap))));
  return { columns, size: columns * rows };
}

export function tvChunks<T>(rows: T[], size: number): T[][] {
  const pageSize = Math.max(1, Math.floor(size) || 1);
  if (!rows.length) return [[]];
  const pages: T[][] = [];
  for (let start = 0; start < rows.length; start += pageSize) pages.push(rows.slice(start, start + pageSize));
  return pages;
}

/** Split plain-text messages at word boundaries; no message is dropped after a preview cap. */
export function tvTextPages(value: string, maxCharacters: number): string[] {
  let remaining = Array.from((value || '').replace(/\s+/g, ' ').trim());
  const size = Math.max(40, Math.floor(maxCharacters) || 40), pages: string[] = [];
  while (remaining.length > size) {
    let end = size;
    const lastSpace = remaining.slice(0, size).lastIndexOf(' ');
    if (lastSpace > size * .5) end = lastSpace;
    pages.push(remaining.slice(0, end).join('').trim());
    remaining = remaining.slice(end);
    while (remaining[0] === ' ') remaining.shift();
  }
  if (remaining.length || !pages.length) pages.push(remaining.join(''));
  return pages;
}

export function tvAnnouncementBudget(width: number, height: number, type: ReturnType<typeof tvTypography>) {
  const columns = Math.max(10, Math.floor((width - type.padding * 2) / (type.body * .65)));
  const lines = Math.max(2, Math.floor((height - type.title * 3 - type.name * 4 - type.small * 3 - type.padding * 2) / (type.body * 1.5)));
  return Math.max(40, Math.floor(columns * lines * .68));
}
