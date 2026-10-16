/*! Phosphor Icons geometry: Copyright (c) 2020 Phosphor Icons. MIT license: /licenses/phosphor-icons.txt */
import React, { forwardRef } from 'react';

export interface AppIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  title?: string;
}

/** Local SVG components: no icon font, CDN requests, or runtime icon library. */
export function createAppIcon(name: string, geometry: () => React.ReactNode) {
  const Component = forwardRef<SVGSVGElement, AppIconProps>(function AppIcon({ size = 20, color = 'currentColor', className = '', title, children, ...props }, ref) {
    const hasLabel = Boolean(title || props['aria-label'] || props['aria-labelledby']);
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256"
        fill={color} color={color} focusable="false" aria-hidden={hasLabel ? undefined : true}
        role={hasLabel ? 'img' : undefined} className={`app-icon app-icon-${name} ${className}`}
        data-icon={name} ref={ref} {...props}>
        {title && <title>{title}</title>}
        {geometry()}{children}
      </svg>
    );
  });
  Component.displayName = name;
  return Component;
}
