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
  // R59_PHOTO_OPTIMIZED: delay private Drive fetch until the preview nears the viewport.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [visibleDriveSrc, setVisibleDriveSrc] = useState<string>('');
  const isDrivePhoto = Boolean(src?.startsWith('/api/drive/photo/'));
  const isVisible = !isDrivePhoto || visibleDriveSrc === src;
  const statusCallback = useRef(onStatusChange);
  statusCallback.current = onStatusChange;

  useEffect(() => {
    if (!isDrivePhoto || isVisible) return;
    const target = viewportRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') { setVisibleDriveSrc(src!); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) { setVisibleDriveSrc(src!); observer.disconnect(); }
    }, { rootMargin: '250px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [src, isDrivePhoto, isVisible]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    let objectUrl = '';
    setHasError(false);
    setResolvedSrc('');
    statusCallback.current?.(src ? 'loading' : 'error');

    if (!src || !isVisible) {
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
  }, [src, isVisible]);

  if (hasError || !src || !isVisible || !resolvedSrc) {
    if (fallbackIcon) return <>{fallbackIcon}</>;
    return (
      <div ref={viewportRef} className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 ${className || ''}`}>
        <span className="text-[10px] italic p-1">{fallbackText || '-'}</span>
      </div>
    );
  }

  return (
    <img
      loading={props.loading || 'lazy'}
      decoding={props.decoding || 'async'}
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
