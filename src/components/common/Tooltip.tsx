import React from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Clean Tooltip wrapper component.
 * - Passes through the child element cleanly without hover popovers, portals, or scroll-locks.
 * - Preserves accessible `aria-label` and `title` attributes on the target element.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
}) => {
  const childProps = children.props as Record<string, any>;
  const existingLabel = childProps?.['aria-label'] || childProps?.title || '';
  const textContent = typeof content === 'string' ? content : '';
  const mergedLabel = existingLabel || textContent;

  return React.cloneElement(children, {
    'aria-label': mergedLabel || undefined,
    title: childProps?.title || textContent || undefined,
  } as React.HTMLAttributes<HTMLElement>);
};

export interface ContextualHelpProps {
  title?: string;
  content: string;
  className?: string;
}

export const ContextualHelp: React.FC<ContextualHelpProps> = () => {
  return null;
};
