import type { LobbyTvConfig, TvThemeOption } from '../../types/lobbyTv.types';

// Self-contained kiosk palette: TV appearance must not depend on the logged-in
// operator's dashboard theme or the browser's prefers-color-scheme setting.
const ACCENT: Record<TvThemeOption, { dark: string; light: string }> = {
  default: { dark: '#22d3ee', light: '#0e7490' },
  sky: { dark: '#38bdf8', light: '#0369a1' },
  mint: { dark: '#34d399', light: '#047857' },
  lavender: { dark: '#c4b5fd', light: '#6d28d9' },
  peach: { dark: '#fdba74', light: '#c2410c' },
  rose: { dark: '#fda4af', light: '#be123c' },
};

const SOFT: Record<TvThemeOption, { dark: string; light: string }> = {
  default: { dark: '#083344', light: '#cffafe' },
  sky: { dark: '#082f49', light: '#e0f2fe' },
  mint: { dark: '#052e2b', light: '#d1fae5' },
  lavender: { dark: '#2e1065', light: '#ede9fe' },
  peach: { dark: '#431407', light: '#ffedd5' },
  rose: { dark: '#4c0519', light: '#ffe4e6' },
};

export function getKioskTheme(config: Pick<LobbyTvConfig, 'colorMode' | 'theme'>) {
  const mode = config.colorMode === 'light' ? 'light' : 'dark';
  const theme = Object.hasOwn(ACCENT, config.theme) ? config.theme : 'default';
  const accent = ACCENT[theme][mode];
  return mode === 'light'
    ? { mode, accent, accentInk: '#ffffff', success: '#047857', warning: '#a16207', danger: '#be123c', background: '#f8fafc', card: '#ffffff', inset: '#f1f5f9', text: '#0f172a', muted: '#475569', subtle: '#64748b', border: '#cbd5e1', hover: '#e2e8f0', soft: SOFT[theme].light }
    : { mode, accent, accentInk: '#081426', success: '#34d399', warning: '#fbbf24', danger: '#fda4af', background: '#020617', card: '#0f172a', inset: '#1e293b', text: '#ffffff', muted: '#cbd5e1', subtle: '#94a3b8', border: '#334155', hover: '#334155', soft: SOFT[theme].dark };
}
