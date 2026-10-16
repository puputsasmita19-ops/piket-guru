import React, { useState, useEffect, useRef } from 'react';
import { DriveClientService } from '../../services/drive/driveClientService';

interface AuthenticatedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackText?: string;
  fallbackIcon?: React.ReactNode;
  onStatusChange?: (status: 'loading' | 'loaded' | 'error') => void;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  className,
  fallbackText,
  fallbackIcon,
  onError,
  onLoad,
  onStatusChange,
  ...props
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    let objectUrl = '';
    setHasError(false);
    setResolvedSrc('');
    statusCallback.current?.(src ? 'loading' : 'error');

    if (!src) {
      setResolvedSrc('');
      return;
    }

    if (src.startsWith('data:image/') || src.startsWith('http') || src.startsWith('blob:')) {
      setResolvedSrc(src);
      return;
    }

    if (src.startsWith('/api/drive/photo/')) {
      DriveClientService.getAuthenticatedPhotoUrl(src.split('?')[0], controller.signal)
        .then((authUrl) => {
          objectUrl = authUrl;
          if (!isCancelled) {
            setResolvedSrc(authUrl);
          } else if (authUrl.startsWith('blob:')) {
            URL.revokeObjectURL(authUrl);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setHasError(true);
            statusCallback.current?.('error');
          }
        });
    } else {
      setResolvedSrc(src);
    }

    return () => {
      isCancelled = true;
      controller.abort();
      if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
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
        statusCallback.current?.('error');
        if (onError) onError(e);
      }}
      onLoad={(e) => {
        statusCallback.current?.('loaded');
        onLoad?.(e);
      }}
      {...props}
    />
  );
};
