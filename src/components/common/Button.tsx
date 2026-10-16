import React from 'react';
import { Loader2 } from '../icons';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'white' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-[var(--theme-primary)] text-[var(--theme-primary-contrast,#ffffff)] hover:brightness-95 active:brightness-90 shadow-sm shadow-[var(--theme-ring)] disabled:opacity-50',
    secondary:
      'bg-slate-800 text-white hover:bg-slate-900 active:bg-slate-950 dark:bg-slate-700 dark:hover:bg-slate-600',
    outline:
      'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 dark:border-[var(--theme-card-border)] dark:text-slate-200 dark:bg-[var(--theme-card-bg)] dark:hover:bg-[var(--theme-surface-subtle)]',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm shadow-rose-500/20 disabled:bg-rose-300',
    ghost:
      'text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-[var(--theme-surface-subtle)]',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm shadow-emerald-500/20 disabled:bg-emerald-300',
    white:
      'bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 shadow-sm border border-transparent disabled:bg-slate-100 disabled:text-slate-400',
    glass:
      'bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 backdrop-blur-sm',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm font-semibold rounded-xl gap-2',
    lg: 'px-5 py-2.5 text-base font-semibold rounded-xl gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      data-variant={variant}
      data-size={size}
      aria-busy={isLoading || undefined}
      className={`app-button inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] focus:ring-offset-1 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="animate-spin motion-reduce:animate-none h-4 w-4 text-current" />
          <span>{loadingText || 'Memproses...'}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
