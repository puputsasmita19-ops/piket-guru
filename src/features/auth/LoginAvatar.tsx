import React, { useEffect, useState } from 'react';
import { User } from '../../components/icons';
import type { UserSummaryItem } from '../../services/auth/authService';

/**
 * The login screen is public. Only fetch an avatar when the administrator has
 * explicitly allowed its public display for this active account. Loading one
 * selected card avoids downloading every teacher photo during account search.
 */
export function LoginAvatar({ user, compact = false }: { user: UserSummaryItem; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const match = /^\/api\/drive\/profile-photo\/([^/?#]+)\/([A-Za-z0-9_-]+)$/.exec(user.avatarUrl || '');
  const src = match && user.loginAvatarVisible === true && match[1] === encodeURIComponent(user.id)
    ? `/api/drive/login-avatar/${encodeURIComponent(user.id)}/${match[2]}`
    : '';
  useEffect(() => { setFailed(false); }, [src]);

  return <span
    className={`relative shrink-0 inline-flex items-center justify-center overflow-hidden rounded-xl bg-[var(--theme-primary-light)] text-[var(--theme-primary-text)] border border-[var(--theme-primary-border)]/40 ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
    aria-label={src && !failed ? `Foto profil ${user.fullName}` : `Profil ${user.fullName}`}
  >
    <User aria-hidden="true" className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
    {src && !failed && (
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />
    )}
  </span>;
}
