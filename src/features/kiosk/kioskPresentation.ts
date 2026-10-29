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
