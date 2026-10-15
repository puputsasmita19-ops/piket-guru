import React, { useState, useEffect } from 'react';
import { DriveClientService } from '../../services/drive/driveClientService';

interface AuthenticatedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackText?: string;
  fallbackIcon?: React.ReactNode;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  className,
  fallbackText,
  fallbackIcon,
  onError,
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    setHasError(false);

    if (!src) {
      setResolvedSrc('');
      return;
    }

    if (src.startsWith('data:image/') || src.startsWith('http') || src.includes('?token=')) {
      setResolvedSrc(src);
      return;
    }

    if (src.startsWith('/api/drive/photo/')) {
      DriveClientService.getAuthenticatedPhotoUrl(src)
        .then((authUrl) => {
          if (!isCancelled) {
            setResolvedSrc(authUrl);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setHasError(true);
          }
        });
    } else {
      setResolvedSrc(src);
    }

    return () => {
      isCancelled = true;
    };
  }, [src]);

  if (hasError || !src || !resolvedSrc) {
    if (fallbackIcon) return <>{fallbackIcon}</>;
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 ${className || ''}`}>
        <span className="text-[10px] italic p-1">{fallbackText || '-'}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt || ''}
      className={className}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
      {...props}
    />
  );
};
