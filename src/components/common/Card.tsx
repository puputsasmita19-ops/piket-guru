import React from 'react';
import type { NavigationTab } from '../../types';
import { getModuleStyle } from '../../config/moduleAppearance';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  id?: string;
  'data-tour'?: string;
  module?: NavigationTab;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  id,
  'data-tour': dataTour,
  module,
}) => {
  return (
    <div
      id={id}
      data-tour={dataTour}
      data-module={module}
      style={getModuleStyle(module)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); }
      } : undefined}
      className={`app-card ${module ? 'module-summary-card' : ''} min-w-0 bg-white dark:bg-[var(--theme-card-bg)] rounded-2xl border border-slate-200/80 dark:border-[var(--theme-card-border)] shadow-sm ${
        hoverable ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-[var(--theme-primary-border)] transition-all duration-200 cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, className = '' }) => (
  <div className={`app-card-header p-4 sm:p-5 border-b border-slate-100 dark:border-[var(--theme-card-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 ${className}`}>
    <div className="min-w-0 flex-1">
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight break-words">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
    </div>
    {action && <div className="app-card-actions shrink-0 self-start sm:self-auto">{action}</div>}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
