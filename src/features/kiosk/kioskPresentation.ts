import type { LobbyTvConfig, TvPanelId } from '../../types/lobbyTv.types';
import { sanitizeLobbyTvConfig } from '../../types/lobbyTv.types';

/** Shared pure rules used by the kiosk and regression tests. Order is administrator-defined. */
export function getKioskPanels(value?: Partial<LobbyTvConfig> | null): TvPanelId[] {
  return sanitizeLobbyTvConfig(value).enabledPanels;
}
export function kioskSlideIntervalMs(value?: Partial<LobbyTvConfig> | null): number {
  return sanitizeLobbyTvConfig(value).slideIntervalSec * 1000;
}
export function kioskTickerText(value?: Partial<LobbyTvConfig> | null): string {
  return sanitizeLobbyTvConfig(value).tickerMessages.join('  •  ');
}

/** Readable page sizes: long lists are paged instead of shrinking text/scrolling silently. */
export function kioskPanelPageSize(panel: TvPanelId, density: LobbyTvConfig['densityScale']): number {
  if (panel === 'duty_teachers' || panel === 'visitors') return density === 'large' ? 4 : density === 'compact' ? 9 : 6;
  if (panel === 'substitutions' || panel === 'announcements') return density === 'large' ? 2 : density === 'compact' ? 6 : 4;
  return 1;
}

export interface KioskFrame { panel: TvPanelId; page: number; pages: number }
/** Keeps all configured panel order and every list item, including multiple pages. */
export function getKioskFrames(
  panels: readonly TvPanelId[],
  counts: Partial<Record<TvPanelId, number>>,
  density: LobbyTvConfig['densityScale'],
): KioskFrame[] {
  return panels.flatMap(panel => {
    const size = kioskPanelPageSize(panel, density);
    const isList = panel === 'duty_teachers' || panel === 'substitutions' || panel === 'visitors' || panel === 'announcements';
    const pages = isList ? Math.max(1, Math.ceil(Math.max(0, counts[panel] ?? 0) / size)) : 1;
    return Array.from({ length: pages }, (_, page) => ({ panel, page, pages }));
  });
}
