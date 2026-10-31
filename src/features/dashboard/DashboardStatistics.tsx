import React, { useId } from 'react';
import type { NavigationTab } from '../../types';

export interface DashboardStatistic {
  tab: NavigationTab;
  title: string;
  value: number | string;
  unit?: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  series?: number[] | null;
  chartLabel?: string;
  stage?: number;
  /** Per-card data may start after first paint, without marking all cards loading. */
  loading?: boolean;
  loadError?: boolean;
}

const standardNumberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const accessibleNumberFormatter = new Intl.NumberFormat('id-ID');
const compactNumberFormatter = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

const MiniTrend = React.memo(function MiniTrend({ series, label }: { series: number[] | null | undefined; label: string }) {
  const gradient = useId().replace(/:/g, '');
  if (!series) return <span className="statistic-no-chart" aria-label="Grafik belum tersedia karena waktu pencatatan belum lengkap"><span /></span>;
  const max = Math.max(1, ...series);
  const points = series.map((value, i) => [3 + i * 58 / Math.max(1, series.length - 1), 37 - value / max * 30]);
  let path = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i], [previousX, previousY] = points[i - 1], mid = (x + previousX) / 2;
    path += ` C${mid},${previousY} ${mid},${y} ${x},${y}`;
  }
  return <svg className="statistic-trend" viewBox="0 0 64 42" role="img" aria-label={label} data-series={series.join(',')}>
    <title>{label}</title><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".16" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <path d={`${path} L61,41 L3,41 Z`} fill={`url(#${gradient})`} />
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
});

export const DashboardStatistics = React.memo(function DashboardStatistics({ items, loading, onNavigate }: { items: DashboardStatistic[]; loading: boolean; onNavigate: (tab: NavigationTab) => void }) {
  if (!items.length) return null;
  return <section aria-label="Statistik hari ini" className="dashboard-statistics">
    {items.map(item => {
      const Icon = item.icon;
      const pending = loading || item.loading;
      const failed = !pending && item.loadError;
      const numeric = typeof item.value === 'number';
      const formatted = numeric ? ((item.value as number) >= 10000 ? compactNumberFormatter : standardNumberFormatter).format(item.value as number) : item.value;
      const accessibleValue = numeric ? accessibleNumberFormatter.format(item.value as number) : item.value;
      return <button key={item.tab} type="button" data-statistic={item.tab} data-value={item.value} className="dashboard-statistic" onClick={() => onNavigate(item.tab)}
        aria-label={`${item.title}: ${pending ? 'Memuat' : failed ? 'Data belum tersedia' : `${accessibleValue}${item.unit ? ` ${item.unit}` : ''}`}. ${item.detail}. Buka rincian.`}>
        <span className="statistic-heading"><span className="statistic-title">{item.title}</span>{item.stage === undefined ? <Icon className="statistic-icon" /> : <span className="statistic-stages" aria-hidden="true">{[1, 2, 3].map(stage => <span key={stage} data-complete={stage <= item.stage!} />)}</span>}</span>
        <span className="statistic-body">
          {pending ? <span className="statistic-skeleton" aria-hidden="true" /> : failed ? <span className="statistic-status">Belum tersambung</span> : <>
            <span data-long={numeric && String(formatted).length > 4 || undefined} className={`statistic-amount ${numeric ? '' : 'statistic-status'}`}><strong>{formatted}</strong>{item.unit && <span className="statistic-unit">{item.unit}</span>}</span>
            {numeric && <MiniTrend series={item.series} label={item.chartLabel || 'Akumulasi pencatatan hari ini'} />}
          </>}
        </span>
        <span className="statistic-detail">{item.detail}</span>
      </button>;
    })}
  </section>;
});
