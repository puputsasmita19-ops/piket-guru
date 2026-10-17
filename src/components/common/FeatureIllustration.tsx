import React from 'react';
import type { NavigationTab } from '../../types';
import { getModuleStyle } from '../../config/moduleAppearance';

/** Lightweight local duotone vectors, no remote images or icon requests. */
export function FeatureIllustration({ module, icon: Icon, className = '' }: {
  module: NavigationTab; icon: React.ComponentType<{ className?: string }>; className?: string;
}) {
  return <span data-module={module} style={getModuleStyle(module)} className={`feature-illustration ${className}`} aria-hidden="true">
    <span className="feature-illustration-shadow" />
    <span className="feature-illustration-sheet" />
    <Icon className="feature-illustration-glyph" />
    <span className="feature-illustration-dot" />
  </span>;
}
